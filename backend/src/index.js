import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { createClient } from '@libsql/client/web'

const app = new Hono()

app.use('/api/*', cors({ origin: (o) => o || '*' }))
app.use('/verify/*', cors({ origin: (o) => o || '*' }))

// --- turso client (cached per url) ---
const clients = new Map()
const turso = (c) => {
  const url = c.env?.TURSO_DATABASE_URL
  if (!url) return null
  if (!clients.has(url)) clients.set(url, createClient({ url, authToken: c.env?.TURSO_AUTH_TOKEN }))
  return clients.get(url)
}

// --- store: Turso only (no mock data) ---
const parseApp = (r) => r && { ...r, photos: JSON.parse(r.photos || '[]') }
const parseInst = (r) => r && { ...r, documents: JSON.parse(r.documents || '[]') }

const store = (c) => {
  const db = turso(c)
  if (!db) throw new Error('db not configured')
  const q = (sql, args = []) => db.execute({ sql, args })
  const first = async (sql, args) => (await q(sql, args)).rows[0] || null
  const all = async (sql, args) => (await q(sql, args)).rows
  const audit = async (actor, action, ref = '') => { await q('INSERT INTO audit_logs (at, actor, action, ref) VALUES (?, ?, ?, ?)', [new Date().toISOString(), actor, action, ref]) }
  return {
    audit, auditList: async () => await all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100'),
    user: async (email) => await first('SELECT uid, email, role FROM users WHERE email = ?', [email]),
    saveUser: async (u) => { await q('INSERT INTO users (uid, email, role) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET uid = excluded.uid', [u.uid, u.email, u.role]) },
    setRole: async (email, role) => { await q('UPDATE users SET role = ? WHERE email = ?', [role, email]); return { email, role } },
    users: async () => await all('SELECT uid, email, role FROM users'),
    officers: async () => await all("SELECT uid, email, role FROM users WHERE role IN ('LMO','GATC')"),
    instruments: async (email, role) => (await all(role === 'Owner' ? 'SELECT * FROM instruments WHERE ownerEmail = ?' : 'SELECT * FROM instruments', role === 'Owner' ? [email] : [])).map(parseInst),
    createInstrument: async (i) => { const r = await first('SELECT COUNT(*) AS n FROM instruments'); const inst = { id: `WM-${1026 + (r?.n || 0)}`, status: 'Unverified', documents: [], ...i }; await q('INSERT INTO instruments (id, ownerEmail, type, manufacturer, serial, capacity, location, validUntil, status, documents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [inst.id, inst.ownerEmail, inst.type, inst.manufacturer || '', inst.serial || '', inst.capacity || '', inst.location || '', inst.validUntil || '', inst.status, JSON.stringify(inst.documents)]); return inst },
    nextId: async () => { const r = await first('SELECT COUNT(*) AS n FROM applications'); return `VM-${1024 + (r?.n || 0)}` },
    createApp: async (a) => { await q('INSERT INTO applications (id, instrumentId, status, location, ownerEmail, createdAt, photos, previousCertNo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [a.id, a.instrumentId, a.status, a.location, a.ownerEmail, a.createdAt, JSON.stringify(a.photos || []), a.previousCertNo || '']); return a },
    getApp: async (id) => parseApp(await first('SELECT * FROM applications WHERE id = ?', [id])),
    deleteApp: async (id) => { await q('DELETE FROM applications WHERE id = ?', [id]) },
    queue: async () => (await all('SELECT * FROM applications ORDER BY createdAt DESC')).map(parseApp),
    mine: async (email) => (await all('SELECT * FROM applications WHERE ownerEmail = ? ORDER BY createdAt DESC', [email])).map(parseApp),
    saveApp: async (a) => { await q('UPDATE applications SET status = ?, officerEmail = ?, assignedOfficer = ?, scheduledAt = ?, confirmed = ?, observed = ?, tolerance = ?, result = ?, remarks = ?, photos = ?, certNo = ? WHERE id = ?', [a.status, a.officerEmail || '', a.assignedOfficer || '', a.scheduledAt || '', a.confirmed || '', a.observed ?? null, a.tolerance ?? null, a.result || '', a.remarks || '', JSON.stringify(a.photos || []), a.certNo || '', a.id]); return a },
    saveCert: async (cert) => { await q('INSERT OR REPLACE INTO certificates (certNo, applicationId, instrumentId, verifyDate, validUntil, officerEmail) VALUES (?, ?, ?, ?, ?, ?)', [cert.certNo, cert.applicationId, cert.instrumentId, cert.verifyDate, cert.validUntil, cert.officerEmail]) },
    getCert: async (no) => await first('SELECT * FROM certificates WHERE certNo = ?', [no]),
    myCerts: async (email) => await all('SELECT c.* FROM certificates c JOIN applications a ON a.id = c.applicationId WHERE a.ownerEmail = ?', [email]),
  }
}

const auth = async (c, next) => {
  const pid = c.env?.FIREBASE_PROJECT_ID
  if (!pid) return c.json({ error: 'auth not configured' }, 500)
  const hdr = c.req.header('Authorization') || ''
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null
  if (!token) return c.json({ error: 'unauthorized' }, 401)
  const s = store(c)
  try {
    const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))
    const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${pid}`, audience: pid })
    const u = (await s.user(payload.email)) || { uid: payload.user_id, email: payload.email, role: 'Owner' }
    await s.saveUser(u)
    c.set('user', u)
    return next()
  } catch {
    return c.json({ error: 'unauthorized' }, 401)
  }
}
const adminOnly = async (c, next) => {
  if (c.get('user').role !== 'Admin') return c.json({ error: 'admin only' }, 403)
  return next()
}
const officerOnly = async (c, next) => {
  if (!['LMO', 'GATC', 'Admin'].includes(c.get('user').role)) return c.json({ error: 'officer only' }, 403)
  return next()
}

app.get('/', (c) => c.json({ ok: true, service: 'verifymet-api', db: 'turso' }))
app.onError((err, c) => c.json({ error: err.message || 'internal error' }, 500))
app.post('/api/me/sync', auth, (c) => c.json(c.get('user')))

// --- owner ---
app.get('/api/instruments', auth, async (c) => {
  const u = c.get('user')
  return c.json(await store(c).instruments(u.email, u.role))
})
app.post('/api/instruments', auth, async (c) => {
  const u = c.get('user')
  const s = store(c)
  const b = await c.req.json()
  const inst = await s.createInstrument({ ownerEmail: u.email, type: b.type, manufacturer: b.manufacturer, serial: b.serial, capacity: b.capacity, location: b.location, validUntil: b.validUntil || '', documents: b.documents || [] })
  await s.audit(u.email, 'instrument.added', inst.id)
  return c.json(inst, 201)
})
app.post('/api/applications', auth, async (c) => {
  const u = c.get('user')
  const s = store(c)
  const b = await c.req.json()
  const app = { id: await s.nextId(), instrumentId: b.instrumentId, status: 'Submitted', location: b.location || '', ownerEmail: u.email, createdAt: new Date().toISOString(), photos: b.photos || [], previousCertNo: b.previousCertNo || '' }
  await s.createApp(app)
  await s.audit(u.email, 'application.submitted', app.id)
  return c.json(app, 201)
})
// one-click re-verification: instrument + location + previous cert auto-filled
app.post('/api/applications/reverify', auth, async (c) => {
  const u = c.get('user')
  const s = store(c)
  const b = await c.req.json()
  const insts = await s.instruments(u.email, u.role)
  const inst = insts.find((i) => i.id === b.instrumentId)
  if (!inst) return c.json({ error: 'instrument not found' }, 404)
  const certs = await s.myCerts(u.email)
  const prev = certs.filter((x) => x.instrumentId === inst.id).sort((x, y) => y.certNo.localeCompare(x.certNo))[0]
  const app = { id: await s.nextId(), instrumentId: inst.id, status: 'Submitted', location: inst.location || '', ownerEmail: u.email, createdAt: new Date().toISOString(), photos: [], previousCertNo: prev ? prev.certNo : '' }
  await s.createApp(app)
  await s.audit(u.email, 'application.reverify', `${app.id}←${app.previousCertNo}`)
  return c.json(app, 201)
})
app.get('/api/applications/:id', auth, async (c) => {
  const a = await store(c).getApp(c.req.param('id'))
  return a ? c.json(a) : c.json({ error: 'not found' }, 404)
})
app.get('/api/my/applications', auth, async (c) => c.json(await store(c).mine(c.get('user').email)))
app.get('/api/my/certificates', auth, async (c) => c.json(await store(c).myCerts(c.get('user').email)))
app.post('/api/applications/:id/confirm-schedule', auth, async (c) => {
  const s = store(c)
  const a = await s.getApp(c.req.param('id'))
  if (!a) return c.json({ error: 'not found' }, 404)
  if (a.ownerEmail !== c.get('user').email) return c.json({ error: 'not your application' }, 403)
  if (a.status !== 'Scheduled') return c.json({ error: `nothing to confirm while ${a.status}` }, 400)
  a.confirmed = 'yes'
  a.status = 'Inspection' // owner confirmed → visible to officer, ready for field visit
  await s.saveApp(a)
  await s.audit(c.get('user').email, 'schedule.confirmed', a.id)
  return c.json(a)
})
// owner cancels a pending application: the row is removed entirely
app.post('/api/applications/:id/cancel', auth, async (c) => {
  const s = store(c)
  const a = await s.getApp(c.req.param('id'))
  if (!a) return c.json({ error: 'not found' }, 404)
  if (a.ownerEmail !== c.get('user').email) return c.json({ error: 'not your application' }, 403)
  if (!['Submitted', 'Scheduled', 'Inspection'].includes(a.status)) return c.json({ error: `cannot cancel when ${a.status}` }, 400)
  await s.deleteApp(a.id)
  await s.audit(c.get('user').email, 'application.cancelled', a.id)
  return c.json({ deleted: a.id })
})

// --- officer ---
app.get('/api/officer/queue', auth, officerOnly, async (c) => {
  const u = c.get('user')
  const q = await store(c).queue()
  return c.json(u.role === 'Admin' ? q : q.filter((a) => !a.assignedOfficer || a.assignedOfficer === u.email))
})
app.post('/api/applications/:id/schedule', auth, officerOnly, async (c) => {
  const s = store(c)
  const a = await s.getApp(c.req.param('id'))
  if (!a) return c.json({ error: 'not found' }, 404)
  const b = await c.req.json().catch(() => ({}))
  if (a.status === 'Cancelled') return c.json({ error: 'application was cancelled' }, 400)
  a.status = 'Scheduled'
  a.scheduledAt = b.scheduledAt || a.scheduledAt
  await s.saveApp(a)
  await s.audit(c.get('user').email, 'application.scheduled', a.id)
  return c.json(a)
})
app.post('/api/applications/:id/verify', auth, officerOnly, async (c) => {
  const s = store(c)
  const a = await s.getApp(c.req.param('id'))
  if (!a) return c.json({ error: 'not found' }, 404)
  const u = c.get('user')
  const b = await c.req.json()
  if (a.status === 'Cancelled') return c.json({ error: 'application was cancelled' }, 400)
  Object.assign(a, { observed: b.observed, tolerance: b.tolerance, result: b.result, remarks: b.remarks || '', photos: b.photos || [], officerEmail: u.email, status: b.result === 'PASS' ? 'Verified' : 'Failed' })
  let cert = null
  if (b.result === 'PASS') {
    cert = { certNo: a.id.replace('VM-', 'VM-CERT-'), applicationId: a.id, instrumentId: a.instrumentId, verifyDate: new Date().toISOString().slice(0, 10), validUntil: '2026-11-15', officerEmail: u.email }
    await s.saveCert(cert)
    a.status = 'Certificate Issued'
    a.certNo = cert.certNo
  }
  await s.saveApp(a)
  await s.audit(u.email, b.result === 'PASS' ? 'certificate.issued' : 'application.rejected', a.id)
  return c.json({ application: a, certificate: cert })
})

// --- admin ---
app.get('/api/admin/overview', auth, adminOnly, async (c) => {
  const s = store(c)
  const [apps, insts, users] = [await s.queue(), await s.instruments('', 'Admin'), await s.users()]
  const byStatus = {}
  for (const a of apps) byStatus[a.status] = (byStatus[a.status] || 0) + 1
  const soon = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10)
  const expiring = insts.filter((i) => i.validUntil && i.validUntil < soon).sort((x, y) => x.validUntil.localeCompare(y.validUntil))
  return c.json({ totalApps: apps.length, totalInstruments: insts.length, totalUsers: users.length, byStatus, expiring })
})
app.get('/api/admin/users', auth, adminOnly, async (c) => c.json(await store(c).users()))
app.post('/api/admin/users', auth, adminOnly, async (c) => {
  const s = store(c)
  const b = await c.req.json()
  const u = (await s.user(b.email)) || { uid: b.email, email: b.email, role: b.role || 'Owner' }
  u.role = b.role || u.role
  await s.saveUser(u)
  await s.audit(c.get('user').email, 'user.upserted', `${u.email}:${u.role}`)
  return c.json(u)
})
app.post('/api/applications/:id/assign', auth, adminOnly, async (c) => {
  const s = store(c)
  const a = await s.getApp(c.req.param('id'))
  if (!a) return c.json({ error: 'not found' }, 404)
  const b = await c.req.json()
  a.assignedOfficer = b.officerEmail
  await s.saveApp(a)
  await s.audit(c.get('user').email, 'application.assigned', `${a.id}→${b.officerEmail}`)
  return c.json(a)
})
app.get('/api/admin/audit', auth, adminOnly, async (c) => c.json(await store(c).auditList()))

// --- public QR (no auth) ---
app.get('/api/certificates/:certNo', async (c) => {
  const cert = await store(c).getCert(c.req.param('certNo'))
  return cert ? c.json({ ...cert, status: 'VALID' }) : c.json({ error: 'invalid' }, 404)
})
app.get('/verify/:certNo', async (c) => {
  const cert = await store(c).getCert(c.req.param('certNo'))
  return cert ? c.json({ valid: true, ...cert, status: 'VALID' }) : c.json({ valid: false }, 404)
})

export default app
