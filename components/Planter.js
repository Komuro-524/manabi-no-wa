// ライブのタネの育ち具合を、植物ひとつで描く（鉢は描かない。鉢＝列の枠そのもの）。
// stage: 0 種（育ち待ち） → 1 芽（相談中） → 2 葉（日程を決め中） → 3 つぼみ（予約済み） → 4 花（開催済み）
// scale: 同じ段階の中での需要の大きさ（0.8〜1.2）。需要が高いほど少し大きい
const LEAF = '#4E7A3F', STEM = '#3C5C34'
export default function Planter({ stage = 0, scale = 1, size = 44, title }) {
  const s = Math.max(0.8, Math.min(1.2, scale))
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={title} style={{ flexShrink: 0, overflow: 'visible' }}>
      {title && <title>{title}</title>}
      <g transform={`translate(24 44) scale(${s}) translate(-24 -44)`}>
        {stage === 0 && <g transform="rotate(-20 24 30)">
          <ellipse cx="24" cy="30" rx="8.5" ry="12" fill="#8A5A2B" />
          <path d="M24 21c-2 4-2 14 0 18" stroke="#6B4320" strokeWidth="1.4" fill="none" />
          <ellipse cx="21.5" cy="26" rx="1.6" ry="3" fill="#B98552" opacity=".7" />
        </g>}
        {stage >= 1 && <path d={stage === 1 ? 'M24 44V30' : stage === 2 ? 'M24 44V20' : 'M24 44V13'} stroke={STEM} strokeWidth="2.4" strokeLinecap="round" fill="none" />}
        {stage === 1 && <>
          <path d="M24 32c-5-1-8-5-8-9 5 0 8 4 8 9z" fill={LEAF} />
          <path d="M24 32c5-1 8-5 8-9-5 0-8 4-8 9z" fill={LEAF} />
        </>}
        {stage >= 2 && <>
          <path d="M24 38c-7-1-11-6-11-11 6 0 10 5 11 11z" fill={LEAF} />
          <path d="M24 30c7-1 11-6 11-11-6 0-10 5-11 11z" fill={LEAF} />
          {stage === 2 && <path d="M24 22c-4-1-6-4-6-7 4 0 6 3 6 7z" fill={LEAF} />}
        </>}
        {stage === 3 && <path d="M24 3c-4 3-5 7-4 11h8c1-4 0-8-4-11z" fill="#A83B2E" />}
        {stage === 4 && <g transform="translate(24 10)">
          {[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx="0" cy="-5" rx="3.6" ry="5.2" fill="#E9A3B4" transform={`rotate(${a})`} />)}
          <circle r="2.8" fill="#E0B84A" />
        </g>}
      </g>
    </svg>
  )
}
