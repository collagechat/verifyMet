import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase.js'
import { api } from './api.js'
import { btn, inp, cardSm, badge, badgeY, lbl, h2, sub, wrap } from './ui.jsx'
import Owner from './screens/Owner.jsx'
import Officer from './screens/Officer.jsx'
import Admin from './screens/Admin.jsx'

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
  const [mode, setMode] = useState('login') // login | signup (Owner tab only)
  const [loginTab, setLoginTab] = useState('Owner') // Owner | Officer | Admin
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
      if (mode === 'signup' && loginTab !== 'Owner') throw new Error('registration is owner-only — ask your admin for officer access')
      const c = mode === 'signup'
        ? await createUserWithEmailAndPassword(auth, email, pass)
        : await signInWithEmailAndPassword(auth, email, pass)
      const token = await c.user.getIdToken()
      const me = await api('/api/me/sync', { method: 'POST', token })
      const ok = loginTab === 'Owner' ? me.role === 'Owner' : loginTab === 'Officer' ? ['LMO', 'GATC'].includes(me.role) : me.role === 'Admin'
      if (!ok) {
        await signOut(auth)
        throw new Error(`this account is ${me.role} — use the ${me.role === 'Owner' ? 'Owner' : ['LMO', 'GATC'].includes(me.role) ? 'Officer' : 'Admin'} login`)
      }
      setUser(me)
      setRoute(me.role === 'Admin' ? 'admin' : me.role === 'Owner' ? 'owner' : 'officer')
    } catch (e) {
      setErr((e.message || 'login failed').replace('auth/', '').replace(/-/g, ' '))
    }
  }

  const openCert = (no) => { setCertNo(no); setRoute('cert') }
  const doLogout = async () => { await signOut(auth); setUser(null); go('home') }

  const body = () => {
    if (route === 'qr') return <QrPage certNo={certNo} />
    if (route === 'cert' && certNo) return <CertPage certNo={certNo} />
    if (!ready) return <div className={wrap}><p className={sub}>Restoring session…</p></div>

    if (!user || route === 'home') {
      const tabs = ['Owner', 'Officer', 'Admin']
      const titles = { Owner: 'Owner Login', Officer: 'Officer Login · LMO / GATC', Admin: 'Admin Login' }
      const notes = {
        Owner: 'Register your instruments, apply for verification, track status and receive QR certificates.',
        Officer: 'For Legal Metrology Officers and test centres. Review assigned work, inspect and certify.',
        Admin: 'Monitor users, applications, expiry and the full audit trail.',
      }
      return (
        <div className="max-w-md mx-auto px-6 py-16">
          <div className="text-center">
            <span className={badgeY}>VERIFYMET</span>
            <h1 className="font-normal text-[32px] mt-4">{titles[loginTab]}</h1>
            <p className={sub}>{notes[loginTab]}</p>
          </div>
          <div className="flex gap-2 justify-center my-4">
            {tabs.map((t) => (
              <button key={t} onClick={() => { setLoginTab(t); setMode('login'); setErr('') }} className={t === loginTab ? 'bg-elevated text-ink text-sm font-medium rounded-lg px-3.5 py-2 border border-hairline cursor-pointer' : 'bg-transparent text-muted text-sm font-medium rounded-lg px-3.5 py-2 cursor-pointer'}>{t}</button>
            ))}
          </div>
          <div className={cardSm}>
            <form onSubmit={(e) => { e.preventDefault(); doLogin(login.email, login.pass) }}>
              <input className={inp} value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} placeholder="email" /><br /><br />
              <input className={inp} type="password" value={login.pass} onChange={(e) => setLogin({ ...login, pass: e.target.value })} placeholder="password" /><br /><br />
              {err && <p className="text-rose text-sm">{err}</p>}
              <button className={btn} style={{ width: '100%' }}>{mode === 'signup' ? 'Register →' : 'Login →'}</button>
            </form>
            {loginTab === 'Owner' && (
              <p className="text-center"><button type="button" className="text-blue text-sm no-underline bg-transparent border-0 cursor-pointer" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>{mode === 'signup' ? 'Have an account? Login' : 'New here? Register'}</button></p>
            )}
          </div>
        </div>
      )
    }

    const role = String(user.role || '').trim()
    if (route === 'owner' || role === 'Owner') return <Owner user={user} hdrs={hdrs} openCert={openCert} />
    if (route === 'officer' || ['LMO', 'GATC'].includes(role)) return <Officer user={user} hdrs={hdrs} openCert={openCert} />
    if (route === 'admin' || role === 'Admin') return <Admin user={user} hdrs={hdrs} />
    return (
      <div className={wrap}><div className={cardSm}>
        <h2 className={h2}>Account issue</h2>
        <p className={sub}>Your account has an unknown role ({role || 'none'}). Ask your admin to set Owner, LMO, GATC or Admin, then log in again.</p>
        <button className={btnSec} onClick={doLogout}>Logout</button>
      </div></div>
    )
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
