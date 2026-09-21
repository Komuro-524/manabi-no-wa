// 画面の上に出す「いま何が動いているか」の帯
const TONE = {
  work: ['var(--amber-bg)', 'var(--amber)'], ok: ['var(--teal-bg)', 'var(--teal)'],
  warn: ['var(--shu-bg)', 'var(--shu)'], info: ['var(--blue-bg)', 'var(--blue)'],
}
export default function StatusBar({ tone = 'work', title, text, spinning, children }) {
  const [bg, fg] = TONE[tone] ?? TONE.work
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: bg, color: fg, borderRadius: 12, padding: '12px 16px' }}>
      {spinning && <span className="spin" style={{ width: 16, height: 16, borderRadius: 999, border: `2.5px solid ${fg}`, borderTopColor: 'transparent', flexShrink: 0 }} />}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
        <b style={{ fontSize: 14 }}>{title}</b>
        {text && <span style={{ fontSize: 12, opacity: .9 }}>{text}</span>}
      </span>
      {children}
    </div>
  )
}
