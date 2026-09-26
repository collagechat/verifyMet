import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { btn, btnSec, inp, cardSm, badge, badgeY, lbl, h2, sub, wrap, th, td, Tabs } from '../ui.jsx'

// Admin: users → instruments → applications/assign → expiry/renewals → reports/audit
export default function Admin({ user, hdrs }) {
  const [tab, setTab] = useState('Overview')
  const [ov, setOv] = useState(null)
  const [users, setUsers] = useState([])
  const [insts, setInsts] = useState([])
  const [apps, setApps] = useState([])
  const [officers, setOfficers] = useState([])
  const [audit, setAudit] = useState([])
  const [f, setF] = useState({})

  const load = async () => {
    const h = await hdrs()
    setOv(await api('/api/admin/overview', h).catch(() => null))
    setUsers(await api('/api/admin/users', h).catch(() => []))
    setInsts(await api('/api/instruments', h).catch(() => []))
    setApps(await api('/api/officer/queue', h).catch(() => []))
    setAudit(await api('/api/admin/audit', h).catch(() => []))
    const us = await api('/api/admin/users', h).catch(() => [])
    setOfficers(us.filter((u) => u.role === 'LMO' || u.role === 'GATC'))
  }
  useEffect(() => { load() }, [])

  const upsertUser = async (e) => {
    e.preventDefault()
    const h = await hdrs()
    await api('/api/admin/users', { method: 'POST', body: { email: f.email, role: f.role || 'Owner' }, ...h })
    setF({})
    load()
  }

  const assign = async (id, officerEmail) => {
    if (!officerEmail) return
    const h = await hdrs()
    await api(`/api/applications/${id}/assign`, { method: 'POST', body: { officerEmail }, ...h })
    load()
  }

  return (
    <div className={`${wrap} py-12`}>
      <span className={lbl}>Admin · {user.email}</span>
      <h2 className={h2}>System monitor</h2>
      <Tabs tabs={['Overview', 'Users', 'Instruments', 'Applications', 'Expiry', 'Audit']} cur={tab} set={setTab} />

      {tab === 'Overview' && ov && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[['Applications', ov.totalApps], ['Instruments', ov.totalInstruments], ['Users', ov.totalUsers], ['Expiring ≤60d', ov.expiring.length]].map(([t, n]) => (
              <div className={cardSm} key={t}><div className="text-[44px] font-normal text-ink leading-none">{n}</div><div className={sub}>{t}</div></div>
            ))}
          </div>
          <div className={cardSm}><span className={lbl}>By status</span><p className={sub}>{Object.entries(ov.byStatus).map(([s, n]) => `${s}: ${n}`).join(' · ') || '—'}</p></div>
        </div>
      )}

      {tab === 'Users' && (
        <div>
          <form onSubmit={upsertUser} className={cardSm}>
            <span className={lbl}>Manage users & officers</span><br /><br />
            <input className={inp} placeholder="email" value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} required />{' '}
            <select className={inp} style={{ maxWidth: 160 }} value={f.role || 'Owner'} onChange={(e) => setF({ ...f, role: e.target.value })}>
              <option>Owner</option><option>LMO</option><option>GATC</option><option>Admin</option>
            </select>{' '}
            <button className={btn}>Add / Set role</button>
          </form>
          <div className={cardSm}><table className="w-full border-collapse text-sm">
            <thead><tr className="text-muted text-left font-medium"><th className={th}>Email</th><th className={th}>Role</th></tr></thead>
            <tbody>{users.map((u) => <tr key={u.email}><td className={td}>{u.email}</td><td className={td}><span className={badge}>{u.role}</span></td></tr>)}</tbody></table></div>
        </div>
      )}

      {tab === 'Instruments' && (
        <div className={cardSm}><span className={lbl}>All instruments / centres</span>
          <table className="w-full border-collapse text-sm"><thead><tr className="text-muted text-left font-medium">
            <th className={th}>ID</th><th className={th}>Type</th><th className={th}>Owner</th><th className={th}>Location</th><th className={th}>Valid until</th><th className={th}>Status</th></tr></thead>
            <tbody>{insts.map((i) => <tr key={i.id}><td className={td}>{i.id}</td><td className={td}>{i.type}</td><td className={td}>{i.ownerEmail}</td><td className={td}>{i.location}</td><td className={td}>{i.validUntil || '—'}</td><td className={td}>{i.status}</td></tr>)}</tbody></table></div>
      )}

      {tab === 'Applications' && (
        <div className={cardSm}><span className={lbl}>Monitor + assign</span>
          <table className="w-full border-collapse text-sm"><thead><tr className="text-muted text-left font-medium">
            <th className={th}>App</th><th className={th}>Instrument</th><th className={th}>Status</th><th className={th}>Officer</th><th className={th}>Assign</th></tr></thead>
            <tbody>{apps.map((a) => (
              <tr key={a.id}><td className={td}>{a.id}</td><td className={td}>{a.instrumentId}</td><td className={td}>{a.status}</td><td className={td}>{a.assignedOfficer || '—'}</td>
                <td className={td}><select className={inp} style={{ maxWidth: 200 }} defaultValue="" onChange={(e) => assign(a.id, e.target.value)}>
                  <option value="">Assign…</option>{officers.map((o) => <option key={o.email} value={o.email}>{o.email} ({o.role})</option>)}
                </select></td></tr>
            ))}</tbody></table></div>
      )}

      {tab === 'Expiry' && (
        <div className={cardSm}><span className={lbl}>Expiry & renewals (≤ 60 days)</span>
          {ov?.expiring.map((i) => <p className={sub} key={i.id}><b>{i.id}</b> · {i.type} · {i.ownerEmail} · valid until {i.validUntil} · {i.status}</p>) || <p className={sub}>—</p>}
        </div>
      )}

      {tab === 'Audit' && (
        <div className={cardSm}><span className={lbl}>Reports & audit log</span>
          <table className="w-full border-collapse text-sm"><thead><tr className="text-muted text-left font-medium">
            <th className={th}>Time</th><th className={th}>Actor</th><th className={th}>Action</th><th className={th}>Ref</th></tr></thead>
            <tbody>{audit.map((l) => <tr key={l.id}><td className={td}>{l.at?.slice(0, 19).replace('T', ' ')}</td><td className={td}>{l.actor}</td><td className={td}><span className={badge}>{l.action}</span></td><td className={td}>{l.ref}</td></tr>)}</tbody></table></div>
      )}
    </div>
  )
}
