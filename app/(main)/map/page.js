import Link from '@/components/Link'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'
import MapCanvas from './MapCanvas'

// 知識地図（簡易）。円＝正式タグ（大きさ＝カード枚数）、線＝同じライブで一緒に語られた。読めるデータ（RLS）だけで描く
export default async function MapPage({ searchParams }) {
  const sp = await searchParams
  const me = await currentUser()
  const db = await supabaseServer()
  // 集計はDB側（knowledge_map_stats: 0016）。本人のRLSで読める分だけを数え、カードの多い順に最大60タグ
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
  const edges = (data.edges ?? []).map(e => [e.a, e.b, Number(e.w)])

  return (
    <>
      <Topbar me={me} title="知識地図" sub="円が大きいほど知見カードが多い。線は同じライブで一緒に語られたタグ" />
      <div className="body" style={{ overflow: 'hidden' }}>
        {nodes.length === 0 ? <div className="card sh empty">まだ正式なタグがありません</div> : (
          <MapCanvas W={W} H={H} initialQ={String(sp?.q ?? '').slice(0, 40)} mine={[...mine]}
            nodes={nodes.map(({ id, name, kind, x, y, r, cards, people }) => ({ id, name, kind, x, y, r, cards, people }))} edges={edges} />
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="chip" style={{ background: '#FFF', color: 'var(--shu)', border: '2px solid var(--shu)' }}>あなたのタグ</span>
          <span className="sub">円の中の数字＝知見カードの枚数。円を押すと、そのタグのカードへ。ドラッグで移動・ホイールで拡大縮小。全{data.total}タグ中、カードの多い順に最大60タグ</span>
        </div>
      </div>
    </>
  )
}
