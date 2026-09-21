// 画面を切り替えている間に出すポップアップ。まなびのわのロゴ（輪＋朱色のカード）を回す
// ★ 画面のクリックを邪魔しない（pointer-events: none）。すぐ終わる切り替えでは出さない（少し遅れて表示）
export default function Loading() {
  return (
    <div className="overlay loader-delay" role="status" aria-live="polite" style={{ pointerEvents: 'none' }}>
      <div className="card" style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: '0 12px 32px rgba(28,43,61,.18)' }}>
        <svg width="72" height="72" viewBox="0 0 120 120" aria-hidden="true">
          <rect width="120" height="120" rx="22" fill="#222222" />
          {/* 朱色のカード（ロゴと同じく傾けて、輪の内側に置く） */}
          <rect x="47" y="42" width="30" height="40" rx="3" fill="#D93A1A" transform="rotate(-40 62 62)" className="card-bob" />
          {/* 輪：ロゴと同じく一か所が開いた太い輪。これを回す */}
          <g className="spin" style={{ transformOrigin: '60px 60px', animationDuration: '1.1s' }}>
            <path d="M60 22 A38 38 0 1 1 26 77" fill="none" stroke="#F7F3E8" strokeWidth="12" strokeLinecap="round" />
          </g>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700 }}>読み込み中…</span>
      </div>
    </div>
  )
}
