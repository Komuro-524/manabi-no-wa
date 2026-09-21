// 画面を切り替えた瞬間に出す仮の表示（データを読み終わるまで）
export default function Loading() {
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ height: 30, width: 260, borderRadius: 8, background: 'var(--bar)' }} />
      {[0, 1, 2].map(i => <div key={i} className="card" style={{ height: 96, opacity: .6 }} />)}
      <span className="sub">読み込み中…</span>
    </div>
  )
}
