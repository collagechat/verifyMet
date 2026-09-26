// Shared Tailwind tokens (DESIGN.md — Airtable editorial system)
export const btn = 'inline-block bg-primary text-white text-base font-medium rounded-xl px-6 py-4 cursor-pointer no-underline hover:bg-primary-active'
export const btnSec = 'inline-block bg-white text-ink text-base font-medium rounded-xl px-6 py-4 cursor-pointer border border-hairline'
export const btnLight = 'inline-block bg-white text-ink text-base font-medium rounded-xl px-6 py-4 cursor-pointer no-underline'
export const inp = 'bg-white text-ink border border-hairline rounded-md px-4 py-3 h-11 text-sm w-full max-w-md focus:outline-2 focus:outline-blue'
export const cardSm = 'bg-white border border-hairline rounded-[10px] p-6 my-4'
export const badge = 'inline-block bg-elevated border border-hairline rounded-full px-3 py-1 text-[13px] font-medium'
export const badgeY = 'inline-block bg-navy text-white text-xs font-medium tracking-[1.5px] rounded-full px-3 py-1'
export const lbl = 'text-xs font-medium tracking-[1.5px] text-muted uppercase'
export const h2 = 'text-[32px] font-normal'
export const sub = 'text-body text-sm leading-relaxed'
export const code = 'bg-navy text-white rounded-xl p-12 font-mono text-sm leading-relaxed overflow-x-auto'
export const wrap = 'max-w-[1280px] mx-auto px-12'
export const th = 'p-2.5 border-b border-hairline'
export const td = 'p-3 border-b border-hairline'

export const STEPS = ['Submitted', 'Scheduled', 'Inspection', 'Verified', 'Certificate Issued']

export const StepBar = ({ status }) => {
  const idx = STEPS.indexOf(status) >= 0 ? STEPS.indexOf(status) : status === 'Failed' ? -1 : 0
  return (
    <div className="flex gap-1.5 my-4 flex-wrap">
      {STEPS.map((s, i) => (
        <span key={s} className={i <= idx ? 'flex-1 min-w-[90px] text-center text-xs font-medium px-1.5 py-2 bg-primary text-white border border-primary rounded-lg' : 'flex-1 min-w-[90px] text-center text-xs font-medium px-1.5 py-2 bg-white text-muted border border-hairline rounded-lg'}>{s}</span>
      ))}
    </div>
  )
}

export const Tabs = ({ tabs, cur, set }) => (
  <div className="flex gap-2 flex-wrap my-4">
    {tabs.map((t) => (
      <button key={t} onClick={() => set(t)} className={t === cur ? 'bg-elevated text-ink text-sm font-medium rounded-lg px-3.5 py-2 border border-hairline cursor-pointer' : 'bg-transparent text-muted text-sm font-medium rounded-lg px-3.5 py-2 cursor-pointer'}>{t}</button>
    ))}
  </div>
)
