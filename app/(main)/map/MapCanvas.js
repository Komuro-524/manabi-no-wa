'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// 知識地図の操作部分。Googleマップのように ドラッグで移動・ホイール（Ctrl+ホイールも）で拡大縮小。
// 検索すると その丸へ飛んで光らせる。分野（分野／技術／業務）で絞ると、ほかの丸は薄くなる。
// ★ 丸を「ドラッグせずに離した」ときだけ、そのタグのカードへ移る（ドラッグとクリックを区別する）
const COLOR = { '分野': ['#E2E9F0', '#1B3A5C'], '技術': ['#E6EDDC', '#3C5C34'], '業務': ['#F3E8CE', '#8C6A0C'] }
const MIN_W = 250, MAX_W = 3000

export default function MapCanvas({ nodes, edges, mine, W, H, initialQ = '' }) {
  const router = useRouter()
  const svg = useRef(null)
  const drag = useRef(null)
  const home = { x: 0, y: 0, w: W, h: H }
  const [vb, setVb] = useState(home)
  const [kinds, setKinds] = useState([])              // 空＝すべて
  const [q, setQ] = useState(initialQ)
  const [hit, setHit] = useState(null)
  const [msg, setMsg] = useState('')
  const mineSet = useMemo(() => new Set(mine), [mine])
  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])
  const shown = n => kinds.length === 0 || kinds.includes(n.kind ?? '分野')

  // 画面上の点 → 地図の座標
  function toWorld(cx, cy, box = vb) {
    const r = svg.current.getBoundingClientRect()
    const s = Math.max(box.w / r.width, box.h / r.height)           // preserveAspectRatio=meet
    const ox = (r.width * s - box.w) / 2, oy = (r.height * s - box.h) / 2
    return { x: box.x - ox + (cx - r.left) * s, y: box.y - oy + (cy - r.top) * s, s }
  }
  function zoomAt(cx, cy, f) {
    setVb(b => {
      const w = Math.min(MAX_W, Math.max(MIN_W, b.w * f)), k = w / b.w
      const p = toWorld(cx, cy, b)
      return { x: p.x - (p.x - b.x) * k, y: p.y - (p.y - b.y) * k, w, h: b.h * k }
    })
  }
  function zoomCenter(f) {
    const r = svg.current.getBoundingClientRect()
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, f)
  }

  // ホイールはページのスクロールを止めたいので passive: false で自前でつなぐ
  useEffect(() => {
    const el = svg.current; if (!el) return
    const onWheel = e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  function down(e) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const n = e.target.closest('[data-node]')?.getAttribute('data-node')
    drag.current = { x0: e.clientX, y0: e.clientY, vb0: vb, moved: false, node: n ? Number(n) : null }
  }
  function move(e) {
    const d = drag.current; if (!d) return
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 5) return
    d.moved = true
    const s = toWorld(0, 0, d.vb0).s
    setVb({ ...d.vb0, x: d.vb0.x - (e.clientX - d.x0) * s, y: d.vb0.y - (e.clientY - d.y0) * s })
  }
  function up() {
    const d = drag.current; drag.current = null
    if (d && !d.moved && d.node != null) router.push(`/cards?tag=${d.node}`)
  }

  function find(text) {
    const t = text.trim().toLowerCase()
    setMsg('')
    if (!t) { setHit(null); return }
    const cand = nodes.filter(n => n.name.toLowerCase().includes(t))
    const n = cand.find(x => x.name.toLowerCase() === t) ?? cand.sort((a, b) => b.cards - a.cards)[0]
    if (!n) { setHit(null); setMsg(`「${text.trim()}」のタグは地図にありません`); return }
    if (!shown(n)) setKinds([])
    setHit(n.id)
    const w = 520, h = w * H / W
    setVb({ x: n.x - w / 2, y: n.y - h / 2, w, h })
    if (cand.length > 1) setMsg(`${cand.length}件あたりました（${cand.slice(0, 4).map(c => c.name).join('・')}${cand.length > 4 ? ' ほか' : ''}）`)
  }
  useEffect(() => { if (initialQ) find(initialQ) }, [])   // /map?q=… で来たら最初に飛ぶ

  const toggleKind = k => setKinds(ks => ks.includes(k) ? ks.filter(x => x !== k) : [...ks, k])
  const pad = 4000   // 格子を敷く範囲（ずっとドラッグしても端が見えない広さ）

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <form onSubmit={e => { e.preventDefault(); find(q) }} style={{ display: 'flex', gap: 6 }}>
          <input className="inp" list="map-tags" value={q} onChange={e => setQ(e.target.value)} placeholder="地図の中のタグを探す" aria-label="地図の中のタグを探す" style={{ width: 240, minHeight: 38 }} />
          <datalist id="map-tags">{nodes.map(n => <option key={n.id} value={n.name} />)}</datalist>
          <button className="btn btn-s" style={{ minHeight: 38 }}>探す</button>
        </form>
        <span className="sub" style={{ marginLeft: 6 }}>分野で絞る</span>
        {Object.entries(COLOR).map(([k, [bg, fg]]) => {
          const on = kinds.includes(k)
          return <button key={k} type="button" className="chip" aria-pressed={on} onClick={() => toggleKind(k)}
            style={{ background: bg, color: fg, border: `2px solid ${on ? fg : 'transparent'}`, cursor: 'pointer', opacity: kinds.length && !on ? 0.5 : 1 }}>{k}</button>
        })}
        {msg && <span className="sub">{msg}</span>}
      </div>
      <div className="card sh" style={{ padding: 0, flexGrow: 1, minHeight: 0, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <svg ref={svg} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', display: 'block', cursor: drag.current?.moved ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}
          role="img" aria-label="タグのつながり" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null }}>
          <defs>
            <pattern id="map-grid-s" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#F1ECE0" strokeWidth=".8" /></pattern>
            <pattern id="map-grid" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#map-grid-s)" /><path d="M100 0H0V100" fill="none" stroke="#E6DEC9" strokeWidth="1" /></pattern>
          </defs>
          <rect x={-pad} y={-pad} width={W + pad * 2} height={H + pad * 2} fill="#FFFFFF" />
          <rect x={-pad} y={-pad} width={W + pad * 2} height={H + pad * 2} fill="url(#map-grid)" />
          {edges.map(([a, b, w], i) => {
            const A = byId.get(a), B = byId.get(b)
            const dim = !(shown(A) && shown(B))
            return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#D8BE7C" strokeWidth={1 + w} opacity={dim ? 0.12 : 0.7} />
          })}
          {nodes.map(n => {
            const [bg, fg] = COLOR[n.kind] ?? COLOR['分野']
            const dim = !shown(n)
            return (
              <g key={n.id} data-node={n.id} style={{ cursor: 'pointer', opacity: dim ? 0.15 : 1, transition: 'opacity .2s' }}>
                <title>{`${n.name}：知見カード${n.cards}枚・${n.people}人（押すとカードへ）`}</title>
                {hit === n.id && <circle cx={n.x} cy={n.y} r={n.r + 10} fill="none" stroke="#A83B2E" strokeWidth="3" className="map-pulse" />}
                <circle cx={n.x} cy={n.y} r={n.r} fill={bg} stroke={mineSet.has(n.id) ? '#A83B2E' : fg} strokeWidth={mineSet.has(n.id) ? 3 : 1.5} />
                <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={fg}>{n.cards}</text>
                <text x={n.x} y={n.y + n.r + 16} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1C2B3D"
                  stroke="#FFFFFF" strokeWidth="4" strokeLinejoin="round" style={{ paintOrder: 'stroke' }}>{n.name}</text>
              </g>
            )
          })}
        </svg>
        <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button type="button" className="btn btn-s" aria-label="拡大" onClick={() => zoomCenter(0.8)} style={{ width: 36, fontSize: 16 }}>＋</button>
          <button type="button" className="btn btn-s" aria-label="縮小" onClick={() => zoomCenter(1.25)} style={{ width: 36, fontSize: 16 }}>－</button>
          <button type="button" className="btn btn-s" aria-label="全体を表示" onClick={() => { setVb(home); setHit(null) }} style={{ width: 36, fontSize: 11 }}>全体</button>
        </div>
      </div>
    </>
  )
}
