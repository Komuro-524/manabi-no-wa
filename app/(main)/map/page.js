import Link from '@/components/Link'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'
import { fetchAll } from '@/lib/fetch-all.mjs'
import MapCanvas from './MapCanvas'

// 知識地図（簡易）。円＝正式タグ（大きさ＝カード枚数）、線＝同じライブで一緒に語られた。読めるデータ（RLS）だけで描く
export default async function MapPage({ searchParams }) {
  const sp = await searchParams
  const me = await currentUser()
  const db = await supabaseServer()
  const [{ data: tags }, { data: cards }, { data: ut }] = await Promise.all([
    db.from('tags').select('id, name, kind').eq('status', 'official'),
    // ★ 年月で増える。上限で黙って欠けないようページを送って読む（本来はDB側で集計する: DESIGN §12）
    fetchAll(() => db.from('knowledge_cards').select('tag_id, live_id').order('id')),
    fetchAll(() => db.from('user_tags').select('tag_id, user_id, kind').order('id')),
  ])
  const cardN = new Map(), people = new Map(), livesOf = new Map()
  for (const c of cards ?? []) {
    cardN.set(c.tag_id, (cardN.get(c.tag_id) ?? 0) + 1)
    if (!livesOf.has(c.tag_id)) livesOf.set(c.tag_id, new Set()); livesOf.get(c.tag_id).add(c.live_id)
  }
  for (const u of ut ?? []) { if (!people.has(u.tag_id)) people.set(u.tag_id, new Set()); people.get(u.tag_id).add(u.user_id) }
  const mine = new Set((ut ?? []).filter(u => u.user_id === me.id).map(u => u.tag_id))
  const nodes = (tags ?? []).map(t => ({ ...t, cards: cardN.get(t.id) ?? 0, people: people.get(t.id)?.size ?? 0 }))
    .sort((a, b) => b.cards - a.cards)
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
  const edges = []
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = livesOf.get(nodes[i].id), b = livesOf.get(nodes[j].id)
    if (!a || !b) continue
    const shared = [...a].filter(x => b.has(x)).length
    if (shared) edges.push([nodes[i].id, nodes[j].id, shared])
  }
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
          <span className="sub">円の中の数字＝知見カードの枚数。円を押すと、そのタグのカードへ。ドラッグで移動・ホイールで拡大縮小</span>
        </div>
      </div>
    </>
  )
}
