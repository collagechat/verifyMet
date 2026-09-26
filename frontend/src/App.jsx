import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase.js'
import { api } from './api.js'
import { btn, btnSec, btnLight, inp, cardSm, badge, badgeY, lbl, h2, sub, code, wrap } from './ui.jsx'
import Owner from './screens/Owner.jsx'
import Officer from './screens/Officer.jsx'
import Admin from './screens/Admin.jsx'

const PIPELINE = `Apply → Schedule → Inspect → Verify → Certify → Track`

const Nav = ({ user, go, onLogout }) => (
  <nav className="h-16 flex items-center border-b border-hairline sticky top-0 bg-canvas z-10">
    <div className="max-w-[1280px] mx-auto px-6 w-full flex items-center gap-7">
      <span className="font-medium text-lg">Verify<span className="text-primary">Met</span></span>
      <a className="text-body text-sm font-medium no-underline hover:text-ink" href="#/" onClick={() => go('home')}>Home</a>
      {user?.role === 'Owner' && <a className="text-body text-sm font-medium no-underline hover:text-ink" href="#/" onClick={() => go('owner')}>Workspace</a>}
      {['LMO', 'GATC'].includes(user?.role) && <a className="text-body text-sm font-medium no-underline hover:text-ink" href="#/" onClick={() => go('officer')}>Queue</a>}
      {user?.role === 'Admin' && <a className="text-body text-sm font-medium no-underline hover:text-ink" href="#/" onClick={() => go('admin')}>Monitor</a>}
      <span className="flex-1" />
      {user ? <span className={badge}>{user.email} · {user.role}</span> : <span className={badgeY}>DIGITAL VERIFICATION</span>}
      {user && <button className={btnSec} style={{ padding: '8px 16px' }} onClick={onLogout}>Logout</button>}
    </div>
  </nav>
)

const Foot = () => (
  <footer className="text-muted text-sm py-16 border-t border-hairline mt-24">
    <div className="max-w-[1280px] mx-auto px-6">VerifyMet — Online Verification System for Weighing &amp; Measuring Instruments · Legal Metrology</div>
  </footer>
)

export default function App() {
  const [user, setUser] = useState(null)
  const [route, setRoute] = useState('home')
  const [certNo, setCertNo] = useState(null)
  const [login, setLogin] = useState({ email: '', pass: '' })
  const [mode, setMode] = useState('login') // login | signup (new users land as Owner)
  const [err, setErr] = useState('')
  const [ready, setReady] = useState(false) // true after first auth-state check
  const go = (r) => { setRoute(r); window.location.hash = '#/' }

  // restore persisted Firebase session on load / refresh
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser && !window.location.hash.startsWith('#/verify/')) {
          const token = await fbUser.getIdToken()
          const me = await api('/api/me/sync', { method: 'POST', token })
          setUser(me)
          setRoute((r) => (r === 'home' ? (me.role === 'Admin' ? 'admin' : me.role === 'Owner' ? 'owner' : 'officer') : r))
        }
      } catch {} finally {
        setReady(true)
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const h = () => {
      const m = window.location.hash.match(/#\/verify\/(.+)/i)
      if (m) { setCertNo(m[1].toUpperCase()); setRoute('qr') }
    }
    h()
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  const hdrs = async () => ({ token: await auth.currentUser.getIdToken() })

  const doLogin = async (email, pass) => {
    setErr('')
    try {
      const c = mode === 'signup'
        ? await createUserWithEmailAndPassword(auth, email, pass)
        : await signInWithEmailAndPassword(auth, email, pass)
      const token = await c.user.getIdToken()
      const me = await api('/api/me/sync', { method: 'POST', token })
      setUser(me)
      setRoute(me.role === 'Admin' ? 'admin' : me.role === 'Owner' ? 'owner' : 'officer')
    } catch (e) {
      setErr(e.code?.replace('auth/', '').replaceAll('-', ' ') || 'login failed')
    }
  }

  const openCert = (no) => { setCertNo(no); setRoute('cert') }
  const doLogout = async () => { await signOut(auth); setUser(null); go('home') }

  const body = () => {
    if (route === 'qr') return <QrPage certNo={certNo} />
    if (route === 'cert' && certNo) return <CertPage certNo={certNo} />
    if (!ready) return <div className={wrap}><p className={sub}>Restoring session…</p></div>

    if (!user || route === 'home') {
      return (
        <div className={wrap}>
          <div className="grid grid-cols-1 md:grid-cols-[7fr_5fr] gap-8 items-center py-12 md:py-24">
            <div>
              <span className={badgeY}>LEGAL METROLOGY · DIGITAL VERIFICATION</span>
              <h1 className="font-normal leading-[1.2] m-0 text-4xl md:text-[40px]">Weighing machines, verified online.</h1>
              <p className={sub}>Owner applies → Officer reviews & inspects → Result recorded → QR certificate → Admin monitors the entire system.</p>
              <p>
                <form onSubmit={(e) => { e.preventDefault(); doLogin(login.email, login.pass) }}>
                  <input className={inp} value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} placeholder="email" /><br /><br />
                  <input className={inp} type="password" value={login.pass} onChange={(e) => setLogin({ ...login, pass: e.target.value })} placeholder="password" /><br /><br />
                  {err && <p className="text-rose text-sm">{err}</p>}
                  <button className={btn}>{mode === 'signup' ? 'Register →' : 'Login →'}</button>{' '}
                  <button type="button" className={btnSec} onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>{mode === 'signup' ? 'Have an account? Login' : 'New here? Register'}</button>
                </form>
              </p>
            </div>
            <div>
              <div className={code}><span className="text-white/60">-- verification pipeline</span><br /><span className="text-[#f4d35e]">{PIPELINE}</span><br /><br /><span className="text-[#8ab4ff]">SELECT</span> status <span className="text-[#8ab4ff]">FROM</span> certificates<br /><span className="text-[#8ab4ff]">WHERE</span> instrument = <span className="text-[#f4d35e]">'WM-1024'</span>;<br /><span className="text-white/60">-- → VALID · until 15 Nov 2026</span></div>
              <div className="flex gap-8 mt-6">
                <div><div className="text-[44px] font-normal text-ink leading-none">3</div><div className={sub}>roles, one system</div></div>
                <div><div className="text-[44px] font-normal text-ink leading-none">1</div><div className={sub}>QR scan to VALID</div></div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[['Owner', 'Register → add instruments → apply → upload docs → track → receive QR certificate.', 'bg-cream'], ['Officer (LMO/GATC)', 'Assigned queue → inspect → record measurements → approve/reject → certificate.', 'bg-peach'], ['Admin', 'Users → instruments → assign → expiry & renewals → audit logs.', 'bg-mint']].map(([t, d, bg]) => (
              <div className={`${bg} rounded-[10px] p-6 my-4`} key={t}><h3 className="text-lg font-medium">{t}</h3><p className="text-body text-sm leading-relaxed">{d}</p></div>
            ))}
          </div>
          <div className="bg-coral text-white rounded-xl px-12 py-12 my-12"><h2 className={h2}>One weighing machine. Zero paperwork.</h2><p>Register above as Owner and run your first instrument through the full journey.</p><br /><button className={btnLight} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Get started →</button></div>
        </div>
      )
    }

    if (route === 'owner' || user.role === 'Owner') return <Owner user={user} hdrs={hdrs} openCert={openCert} />
    if (route === 'officer' || ['LMO', 'GATC'].includes(user.role)) return <Officer user={user} hdrs={hdrs} openCert={openCert} />
    if (route === 'admin' || user.role === 'Admin') return <Admin user={user} hdrs={hdrs} />
    return null
  }

  return <div><Nav user={user} go={go} onLogout={doLogout} />{body()}<Foot /></div>
}

function QrPage({ certNo }) {
  const [res, setRes] = useState(null)
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/verify/${certNo}`)
      .then((r) => r.json()).then(setRes).catch(() => setRes({ valid: false }))
  }, [certNo])
  return (
    <div className={`${wrap} py-16`}>
      <span className={badgeY}>PUBLIC VERIFICATION</span>
      {res?.valid ? (
        <div><h2 className={h2}><span className="text-emerald">✓</span> Certificate Verified</h2>
          <div className={cardSm}>
            <p><span className={lbl}>Instrument</span><br />{res.instrumentId}</p>
            <p><span className={lbl}>Certificate</span><br />{res.certNo}</p>
            <p><span className={lbl}>Status</span><br /><span className="text-emerald font-medium">VALID</span> · Verified {res.verifyDate} · Valid until {res.validUntil}</p>
          </div></div>
      ) : <h2 className={h2}>Checking…</h2>}
    </div>
  )
}

function CertPage({ certNo }) {
  const url = `${window.location.origin}${window.location.pathname}#/verify/${certNo}`
  return (
    <div className={`${wrap} py-12`}>
      <span className={badgeY}>CERTIFICATE ISSUED</span>
      <h2 className={h2}>VERIFYMET — Digital Verification Certificate</h2>
      <div className={cardSm}>
        <p><span className={lbl}>Certificate</span><br />{certNo}</p>
        <div className="bg-white inline-block p-3 rounded-xl"><QRCodeSVG value={url} size={160} /></div>
        <p><a className="text-blue no-underline" href={`#/verify/${certNo}`}>Open QR verification page →</a></p>
      </div>
    </div>
  )
}
