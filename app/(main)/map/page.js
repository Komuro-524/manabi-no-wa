import Link from '@/components/Link'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'

// 知識地図（簡易）。円＝正式タグ（大きさ＝カード枚数）、線＝同じライブで一緒に語られた。読めるデータ（RLS）だけで描く
export default async function MapPage() {
  const me = await currentUser()
  const db = await supabaseServer()
  const { data, error } = await db.rpc('knowledge_map_stats')
  if (error) throw new Error('知識地図を取得できませんでした。DBの更新状態をご確認ください')
  const nodes = data.nodes
  const mine = new Set(nodes.filter(n => n.mine).map(n => n.id))
  // 画面にぴったり収まるよう、横長の座標で描いて SVG を枠いっぱいに縮める（スクロールさせない）
  const W = 1000, H = 560, cx = W / 2, cy = H / 2 - 10
  const inner = nodes.slice(1, 7), outer = nodes.slice(7)
  nodes.forEach((n, i) => {
    let x = cx, y = cy
    if (i > 0) {
      const ring = i < 7 ? inner : outer
      const idx = ring.indexOf(n), cnt = Math.max(1, ring.length)
      const [rx, ry] = i < 7 ? [230, 150] : [430, 225]
      const ang = (idx / cnt) * Math.PI * 2 + (i < 7 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / cnt)
      x = cx + rx * Math.cos(ang); y = cy + ry * Math.sin(ang)
    }
    n.x = Math.round(x); n.y = Math.round(y)
    n.r = 12 + Math.min(26, n.cards * 4)   // 円は小さめ。文字は円の下に出す
  })
  const byId = new Map(nodes.map(n => [n.id, n]))
  const edges = data.edges.map(e => ({ a: byId.get(e.a), b: byId.get(e.b), w: e.w }))
  const COLOR = { '分野': ['#E2E9F0', '#1B3A5C'], '技術': ['#E6EDDC', '#3C5C34'], '業務': ['#F3E8CE', '#8C6A0C'] }

  return (
    <>
      <Topbar me={me} title="知識地図" sub="円が大きいほど知見カードが多い。線は同じライブで一緒に語られたタグ" />
      <div className="body" style={{ overflow: 'hidden' }}>
        <div className="card sh" style={{ padding: 8, flexGrow: 1, minHeight: 0, display: 'flex' }}>
          {nodes.length === 0 ? <div className="empty">まだ正式なタグがありません</div> : (
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label="タグのつながり">
              {edges.map((e, i) => <line key={i} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} stroke="#D8BE7C" strokeWidth={1 + e.w} opacity=".7" />)}
              {nodes.map(n => {
                const [bg, fg] = COLOR[n.kind] ?? COLOR['分野']
                return (
                  <Link key={n.id} href={`/cards?tag=${n.id}`}>
                    <title>{`${n.name}：知見カード${n.cards}枚・${n.people}人`}</title>
                    <circle cx={n.x} cy={n.y} r={n.r} fill={bg} stroke={mine.has(n.id) ? '#A83B2E' : fg} strokeWidth={mine.has(n.id) ? 3 : 1.5} />
                    <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={fg}>{n.cards}</text>
                    <text x={n.x} y={n.y + n.r + 16} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1C2B3D"
                      stroke="#FFFFFF" strokeWidth="4" strokeLinejoin="round" style={{ paintOrder: 'stroke' }}>{n.name}</text>
                  </Link>
                )
              })}
            </svg>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {Object.entries(COLOR).map(([k, [bg, fg]]) => <span key={k} className="chip" style={{ background: bg, color: fg }}>{k}</span>)}
          <span className="chip" style={{ background: '#FFF', color: 'var(--shu)', border: '2px solid var(--shu)' }}>あなたのタグ</span>
          <span className="sub">全{data.total}タグ中、カードの多い順に最大60タグを表示。円の中の数字＝知見カードの枚数。円を押すと、そのタグのカードへ</span>
        </div>
      </div>
    </>
  )
}
