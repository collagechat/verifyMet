import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { uploadPhoto } from '../firebase.js'
import { btn, btnSec, inp, cardSm, badge, lbl, h2, sub, wrap, th, td, Tabs, StepBar } from '../ui.jsx'

// Owner: Register/Login(done in App) → Add Instrument → Apply → Upload Docs → Schedule → Track → Certificate → QR
export default function Owner({ user, hdrs, openCert }) {
  const [tab, setTab] = useState('Instruments')
  const [insts, setInsts] = useState([])
  const [apps, setApps] = useState([])
  const [certs, setCerts] = useState([])
  const [f, setF] = useState({})
  const [applyFor, setApplyFor] = useState(null)
  const [qr, setQr] = useState('')

  const load = async () => {
    const h = await hdrs()
    setInsts(await api('/api/instruments', h).catch(() => []))
    setApps(await api('/api/my/applications', h).catch(() => []))
    setCerts(await api('/api/my/certificates', h).catch(() => []))
  }
  useEffect(() => {
    load()
    const t = setInterval(load, 8000) // live updates without refresh
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [])

  const docs = async () => {
    const files = f.files || []
    const urls = []
    for (const file of files) urls.push((await uploadPhoto(file)) || 'cloudinary:pending')
    return urls
  }

  const addInst = async (e) => {
    e.preventDefault()
    const h = await hdrs()
    await api('/api/instruments', { method: 'POST', body: { type: f.type, manufacturer: f.manufacturer, serial: f.serial, capacity: f.capacity, location: f.location, validUntil: f.validUntil, documents: await docs() }, ...h })
    setF({})
    load()
  }

  const apply = async (e) => {
    e.preventDefault()
    const h = await hdrs()
    const app = await api('/api/applications', { method: 'POST', body: { instrumentId: applyFor, location: f.location, photos: await docs() }, ...h })
    setApplyFor(null)
    setF({})
    load()
    setTab('Track')
  }

  const confirm = async (id) => {
    const h = await hdrs()
    await api(`/api/applications/${id}/confirm-schedule`, { method: 'POST', ...h }).catch(() => {})
    load()
  }

  const checkQr = async (e) => {
    e.preventDefault()
    const no = qr.trim().toUpperCase()
    if (no) window.location.hash = `#/verify/${no}`
  }

  return (
    <div className={`${wrap} py-12`}>
      <span className={lbl}>Owner · {user.email}</span>
      <h2 className={h2}>Owner workspace</h2>
      <Tabs tabs={['Instruments', 'Apply', 'Track', 'Certificates', 'Scan QR']} cur={tab} set={setTab} />

      {tab === 'Instruments' && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insts.length === 0 && <p className={sub}>No instruments yet — add your first one below.</p>}
            {insts.map((i) => (
              <div className={cardSm} key={i.id}>
                <span className={badge}>{i.id}</span>
                <h3 className="text-lg font-medium">{i.type}</h3>
                <p className={sub}>Serial: {i.serial || '—'} · {i.capacity || ''}<br />{i.location || ''} · Valid until: {i.validUntil || '—'}<br />Status: {i.status}</p>
                <button className={btnSec} onClick={() => { setApplyFor(i.id); setTab('Apply') }}>Apply for Verification</button>
              </div>
            ))}
          </div>
          <form onSubmit={addInst} className={cardSm}>
            <h3 className="text-lg font-medium">Add Instrument</h3>
            <input className={inp} placeholder="Type (Weighing Machine…)" value={f.type || ''} onChange={(e) => setF({ ...f, type: e.target.value })} required /><br /><br />
            <input className={inp} placeholder="Manufacturer" value={f.manufacturer || ''} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} /><br /><br />
            <input className={inp} placeholder="Model / Serial" value={f.serial || ''} onChange={(e) => setF({ ...f, serial: e.target.value })} /><br /><br />
            <input className={inp} placeholder="Capacity" value={f.capacity || ''} onChange={(e) => setF({ ...f, capacity: e.target.value })} /><br /><br />
            <input className={inp} placeholder="Location" value={f.location || ''} onChange={(e) => setF({ ...f, location: e.target.value })} /><br /><br />
            <input className={inp} type="date" value={f.validUntil || ''} onChange={(e) => setF({ ...f, validUntil: e.target.value })} /><br /><br />
            <input className={inp} type="file" multiple accept="image/*,.pdf" onChange={(e) => setF({ ...f, files: [...e.target.files] })} /><br /><br />
            <button className={btn}>Add Instrument</button>
          </form>
        </div>
      )}

      {tab === 'Apply' && (
        <form onSubmit={apply} className={cardSm}>
          <h3 className="text-lg font-medium">Apply for Verification</h3>
          <select className={inp} value={applyFor || ''} onChange={(e) => setApplyFor(e.target.value)} required>
            <option value="">Select instrument…</option>
            {insts.map((i) => <option key={i.id} value={i.id}>{i.id} · {i.type}</option>)}
          </select><br /><br />
          <input className={inp} placeholder="Location" value={f.location || ''} onChange={(e) => setF({ ...f, location: e.target.value })} /><br /><br />
          <input className={inp} type="file" multiple accept="image/*,.pdf" onChange={(e) => setF({ ...f, files: [...e.target.files] })} /><br /><br />
          <button className={btn}>Submit Application →</button>
        </form>
      )}

      {tab === 'Track' && apps.length === 0 && <p className={sub}>No applications yet — apply for verification first.</p>}
      {tab === 'Track' && apps.map((a) => (
        <div className={cardSm} key={a.id}>
          <span className={badge}>{a.id}</span> <b>{a.instrumentId}</b> · {a.location}
          <StepBar status={a.status} />
          <p className={sub}>Status: <b>{a.status}</b>{a.scheduledAt ? <> · Inspection: {a.scheduledAt} <button className={btnSec} onClick={() => confirm(a.id)}>Confirm</button></> : null}{a.officerEmail ? ` · Officer: ${a.officerEmail}` : ''}</p>
        </div>
      ))}

      {tab === 'Certificates' && certs.length === 0 && <p className={sub}>No certificates yet — they appear here after officer approval.</p>}
      {tab === 'Certificates' && certs.map((c) => (
        <div className={cardSm} key={c.certNo}>
          <span className={badge}>{c.certNo}</span> <b>{c.instrumentId}</b> · Valid until {c.validUntil}<br /><br />
          <button className={btn} onClick={() => openCert(c.certNo)}>Open Certificate →</button>
        </div>
      ))}

      {tab === 'Scan QR' && (
        <form onSubmit={checkQr} className={cardSm}>
          <h3 className="text-lg font-medium">Verify a certificate</h3>
          <p className={sub}>Enter the certificate number from the QR (e.g. VM-CERT-1024).</p>
          <input className={inp} placeholder="VM-CERT-…" value={qr} onChange={(e) => setQr(e.target.value)} /><br /><br />
          <button className={btn}>Verify →</button>
        </form>
      )}
    </div>
  )
}
