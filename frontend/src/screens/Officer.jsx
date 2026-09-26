import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { uploadPhoto } from '../firebase.js'
import { btn, btnSec, inp, cardSm, badge, lbl, h2, sub, code, wrap, th, td, Tabs } from '../ui.jsx'

// Officer (LMO/GATC): queue → details → schedule → measure → photos → approve/reject → cert
export default function Officer({ user, hdrs, openCert }) {
  const [tab, setTab] = useState('Queue')
  const [apps, setApps] = useState([])
  const [sel, setSel] = useState(null)
  const [f, setF] = useState({})
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')

  const load = async () => {
    const h = await hdrs()
    setApps(await api('/api/officer/queue', h).catch(() => []))
  }
  useEffect(() => {
    load()
    const t = setInterval(load, 8000) // live updates without refresh
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [])

  const schedule = async () => {
    setErr('')
    try {
      if (!f.scheduledAt) throw new Error('pick an inspection date first')
      const h = await hdrs()
      const a = await api(`/api/applications/${sel.id}/schedule`, { method: 'POST', body: { scheduledAt: f.scheduledAt }, ...h })
      setSel(a)
      load()
    } catch (e) { setErr(e.message) }
  }

  const decide = async (result) => {
    setErr('')
    try {
      const observed = parseFloat(f.observed)
      const tolerance = parseFloat(f.tolerance)
      if (Number.isNaN(observed) || Number.isNaN(tolerance)) throw new Error('enter observed measurement and tolerance as numbers')
      const h = await hdrs()
      const urls = []
      for (const file of f.files || []) urls.push((await uploadPhoto(file)) || 'cloudinary:pending')
      const out = await api(`/api/applications/${sel.id}/verify`, {
        method: 'POST',
        body: { observed, tolerance, result, remarks: f.remarks, photos: urls }, ...h,
      })
      setRes(out)
      load()
      if (out.certificate) openCert(out.certificate.certNo)
    } catch (e) { setErr(e.message) }
  }

  const shown = tab === 'Scheduled' ? apps.filter((a) => a.status === 'Scheduled') : tab === 'Done' ? apps.filter((a) => ['Certificate Issued', 'Failed', 'Cancelled'].includes(a.status)) : apps.filter((a) => !['Certificate Issued', 'Failed', 'Cancelled'].includes(a.status))

  if (sel) {
    return (
      <div className={`${wrap} py-12`}>
        <button className={btnSec} onClick={() => { setSel(null); setRes(null); setErr('') }}>← Queue</button>
        <h2 className={h2}>{sel.id} · {sel.instrumentId}</h2>
        {err && <p className="text-rose text-sm">{err}</p>}
        <div className={code}>Location: {sel.location} · GPS 28.61, 77.20<br />Owner: {sel.ownerEmail}<br />Status: {sel.status}{sel.previousCertNo ? ` · Re-verification · prev ${sel.previousCertNo}` : ''}{sel.scheduledAt ? ` · Inspection: ${sel.scheduledAt}` : ''}{sel.confirmed ? ' · owner confirmed ✓' : ''}</div><br />
        <div className={cardSm}>
          <span className={lbl}>Schedule inspection</span><br /><br />
          <input className={inp} type="date" value={f.scheduledAt || ''} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} />{' '}
          <button className={btnSec} onClick={schedule}>Schedule</button>
        </div>
        <div className={cardSm}>
          <span className={lbl}>Record measurements</span><br /><br />
          <input className={inp} placeholder="Observed measurement" value={f.observed || ''} onChange={(e) => setF({ ...f, observed: e.target.value })} /><br /><br />
          <input className={inp} placeholder="Permissible tolerance" value={f.tolerance || ''} onChange={(e) => setF({ ...f, tolerance: e.target.value })} /><br /><br />
          <input className={inp} placeholder="Remarks" value={f.remarks || ''} onChange={(e) => setF({ ...f, remarks: e.target.value })} /><br /><br />
          <input className={inp} type="file" multiple accept="image/*" onChange={(e) => setF({ ...f, files: [...e.target.files] })} /><br /><br />
          <button className={btn} onClick={() => decide('PASS')}>✓ Approve — Generate Certificate</button>{' '}
          <button className={btnSec} onClick={() => decide('FAIL')}>Reject</button>
          {f.observed && f.tolerance && (
            <p className={sub}>Test result: {Math.abs(parseFloat(f.observed) - 500) <= parseFloat(f.tolerance) ? 'within tolerance ✓' : 'OUT of tolerance ✗'} (ref 500)</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`${wrap} py-12`}>
      <span className={lbl}>Officer · {user.email} ({user.role})</span>
      <h2 className={h2}>Assigned applications</h2>
      <Tabs tabs={['Queue', 'Scheduled', 'Done']} cur={tab} set={setTab} />
      <div className={cardSm}>
        <table className="w-full border-collapse text-sm"><thead><tr className="text-muted text-left font-medium">
          <th className={th}>Application</th><th className={th}>Instrument</th><th className={th}>Location</th><th className={th}>Status</th><th className={th} /></tr></thead>
          <tbody>{shown.map((a) => (
            <tr key={a.id}><td className={td}>{a.id}</td><td className={td}>{a.instrumentId}</td><td className={td}>{a.location}</td><td className={td}>{a.status}</td>
              <td className={td}><button className={btnSec} onClick={() => setSel(a)}>Open</button></td></tr>
          ))}</tbody></table>
        {shown.length === 0 && <p className={sub}>Nothing here.</p>}
      </div>
    </div>
  )
}
