// ライブのタネの育ち具合を、プランターの植物で描く。
// stage: 0 種（育ち待ち） → 1 芽（相談中） → 2 若葉（日程を決め中） → 3 つぼみ（予約済み） → 4 花（開催済み）
// scale: 同じ段階の中での需要の大きさ（0.8〜1.2）。需要が高いほど植物が少し大きい
const LEAF = 'var(--teal)'
export default function Planter({ stage = 0, scale = 1, size = 44, title }) {
  const s = Math.max(0.8, Math.min(1.2, scale))
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={title} style={{ flexShrink: 0, overflow: 'visible' }}>
      {title && <title>{title}</title>}
      {/* 植物（鉢のふちを根元にして拡大縮小） */}
      <g transform={`translate(24 30) scale(${s}) translate(-24 -30)`}>
        {stage === 0 && <ellipse cx="24" cy="26.6" rx="3.4" ry="2.4" fill="#8A5A2B" />}
        {stage >= 1 && <path d={stage === 1 ? 'M24 30V23' : stage === 2 ? 'M24 30V17' : 'M24 30V12'} stroke={LEAF} strokeWidth="2" strokeLinecap="round" fill="none" />}
        {stage === 1 && <>
          <path d="M24 24c-3-1-5-3-5-5 3 0 5 2 5 5z" fill={LEAF} />
          <path d="M24 24c3-1 5-3 5-5-3 0-5 2-5 5z" fill={LEAF} />
        </>}
        {stage >= 2 && <>
          <path d="M24 25c-5-1-8-4-8-7 4 0 7 3 8 7z" fill={LEAF} />
          <path d="M24 21c5-1 8-4 8-7-4 0-7 3-8 7z" fill={LEAF} />
        </>}
        {stage === 3 && <path d="M24 5c-3 2-4 5-3 8h6c1-3 0-6-3-8z" fill="var(--shu)" />}
        {stage === 4 && <g transform="translate(24 9)">
          {[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx="0" cy="-4.2" rx="3" ry="4.4" fill="#E9A3B4" transform={`rotate(${a})`} />)}
          <circle r="2.2" fill="#E0B84A" />
        </g>}
      </g>
      {/* 鉢 */}
      <path d="M9 30h30l-3.5 14h-23z" fill="#B5673F" />
      <rect x="7" y="28" width="34" height="4.5" rx="1.5" fill="#9A5534" />
      <rect x="10" y="28.8" width="28" height="1.6" rx=".8" fill="#5E3B22" />
    </svg>
  )
}
