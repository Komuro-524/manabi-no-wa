// 画面を切り替えている間に出すポップアップ（データを読み終わるまで）
export default function Loading() {
  return (
    <div className="overlay" role="status" aria-live="polite">
      <div className="card" style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: '0 12px 32px rgba(28,43,61,.18)' }}>
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <circle cx="28" cy="28" r="22" fill="none" stroke="var(--bar)" strokeWidth="6" />
          <circle cx="28" cy="28" r="22" fill="none" stroke="var(--shu)" strokeWidth="6" strokeLinecap="round" strokeDasharray="40 140" className="spin" style={{ transformOrigin: '28px 28px' }} />
          <circle cx="28" cy="28" r="9" fill="var(--ai-on)" opacity=".85" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700 }}>読み込み中…</span>
      </div>
    </div>
  )
}
