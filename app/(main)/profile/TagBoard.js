'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/browser'

// 知見タグ・興味タグの公開／非公開。「公開」「非公開」のエリアのあいだをドラッグで動かす。
// ★ ブラウザ標準のドラッグ＆ドロップ（HTML5 DnD）はブラウザやタッチ操作で動きが違うので使わず、
//   マウス・指・ペン共通の Pointer Events で自前で動かす（Edge・Chrome・Safari・スマホで同じ動き）
// 動かすと set_tag_visibility()（自分の行しか変えられない関数）を本人のセッションで呼ぶ。⇄ を押しても移せる
const KIND = { knowledge: ['知見タグ', '話せること'], interest: ['興味タグ', '聞きたいこと'] }

export default function TagBoard({ tags, kinds = ['knowledge', 'interest'] }) {
  const router = useRouter()
  const [items, setItems] = useState(tags)   // 押した瞬間に動かし、失敗したら戻す
  const [over, setOver] = useState(null)
  const [ghost, setGhost] = useState(null)   // ドラッグ中に指やマウスについてくる札
  const [err, setErr] = useState('')
  const drag = useRef(null)

  async function move(t, vis) {
    if (t.visibility === vis) return
    setErr('')
    setItems(xs => xs.map(x => x.id === t.id ? { ...x, visibility: vis } : x))
    const { error } = await supabaseBrowser().rpc('set_tag_visibility', { p_tag_id: t.tag_id, p_kind: t.kind, p_visibility: vis })
    if (error) { setErr(`動かせませんでした: ${error.message}`); setItems(xs => xs.map(x => x.id === t.id ? { ...x, visibility: t.visibility } : x)) }
  }

  // 育ちかけのタグを「タグにしてほしい」と申請する／取り下げる（request_tag() は自分の分しか動かせない・0020）
  // ★ 申請は管理者のタグ帳で上に出るだけ。正式にするのは管理者の承認
  async function request(t) {
    const on = !t.requested
    setErr('')
    setItems(xs => xs.map(x => x.tag_id === t.tag_id ? { ...x, requested: on } : x))
    const { error } = await supabaseBrowser().rpc('request_tag', { p_tag_id: t.tag_id, p_on: on })
    if (error) { setErr(error.code === 'PGRST202' ? '申請の仕組みがまだデータベースに入っていません（管理者が 0020_tag_requests.sql を流すと使えます）' : `申請できませんでした: ${error.message}`); setItems(xs => xs.map(x => x.tag_id === t.tag_id ? { ...x, requested: !on } : x)) }
  }

  const zoneAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-zone]')?.getAttribute('data-zone') ?? null

  function down(e, t) {
    if (e.button !== 0 || e.target.closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { t, x0: e.clientX, y0: e.clientY, moved: false }
  }
  function moveP(e) {
    const d = drag.current; if (!d) return
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 5) return   // 少し動いたらドラッグ開始（クリックと区別）
    d.moved = true
    setGhost({ name: d.t.name ?? '育ちかけ', x: e.clientX, y: e.clientY })
    const z = zoneAt(e.clientX, e.clientY)
    setOver(o => (o === z ? o : z))
  }
  function up(e) {
    const d = drag.current; drag.current = null
    setGhost(null); setOver(null)
    if (!d) return
    if (!d.moved) {   // 動かさずに離した＝クリック。正式なタグならそのタグのカードへ
      if (d.t.status === 'official') router.push(`/cards?tag=${d.t.tag_id}`)
      return
    }
    const z = zoneAt(e.clientX, e.clientY)
    if (!z) return
    const [kind, vis] = z.split(':')
    if (kind === d.t.kind) move(d.t, vis)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Object.entries(KIND).filter(([k]) => kinds.includes(k)).map(([kind, [title, sub]]) => (
        <div key={kind} className="card sh" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><b style={{ fontSize: 16 }}>{title}</b><span className="sub">{sub}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['public', '公開', 'みんなに見える'], ['private', '非公開', 'あなただけ']].map(([vis, name, hint]) => {
              const zone = `${kind}:${vis}`
              const list = items.filter(t => t.kind === kind && t.visibility === vis)
              return (
                <div key={vis} data-zone={zone}
                  style={{
                    minHeight: 92, borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
                    background: vis === 'public' ? 'var(--teal-bg)' : 'var(--bg)',
                    border: `2px dashed ${over === zone ? 'var(--shu)' : 'transparent'}`,
                  }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: vis === 'public' ? 'var(--teal)' : 'var(--sub)' }}>{name}<span className="sub" style={{ fontWeight: 400 }}>（{hint}）</span></span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {list.length === 0 && <span className="sub" style={{ fontSize: 11 }}>ここにドラッグ</span>}
                    {list.map(t => (
                      <TagCard key={t.id} t={t} dragging={ghost && drag.current?.t.id === t.id}
                        onPointerDown={e => down(e, t)} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up}
                        onFlip={() => move(t, vis === 'public' ? 'private' : 'public')} onRequest={() => request(t)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {ghost && (
        <span className="card" style={{ position: 'fixed', left: ghost.x + 8, top: ghost.y + 8, pointerEvents: 'none', zIndex: 200, padding: '6px 10px', fontSize: 13, fontWeight: 700, boxShadow: '0 8px 20px rgba(28,43,61,.25)' }}>{ghost.name}</span>
      )}
      {err && <div className="err">{err}</div>}
      <div className="note">育ちかけのタグは、公開にしても管理者が正式にするまで他の人には見えません。価値のある知識だと思ったら「タグにしてほしい」で管理者に申請できます。自己分析から付いたタグは最初は非公開です。公開に動かすと「採用」になります</div>
    </div>
  )
}

function TagCard({ t, dragging, onFlip, onRequest, ...pointer }) {
  const official = t.status === 'official'
  return (
    <span {...pointer} className="card" title={official ? 'ドラッグで公開・非公開を切り替え／押すとこのタグのカードへ' : 'ドラッグで公開・非公開を切り替え'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 8px 6px 10px', cursor: 'grab', borderRadius: 10, background: '#FFF',
        borderColor: official ? 'var(--line)' : 'var(--amber)', touchAction: 'none', userSelect: 'none', opacity: dragging ? .4 : 1 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', textDecoration: official ? 'underline dotted var(--line)' : 'none' }}>{t.name ?? '育ちかけ'}</span>
      {!official && <span className="chip" style={{ padding: '1px 6px', fontSize: 10, background: 'var(--amber-bg)', color: 'var(--amber)' }}>育ちかけ</span>}
      {!official && t.name && (
        <button onClick={onRequest} aria-pressed={!!t.requested}
          title={t.requested ? '申請を取り下げる' : '価値のある知識だと思ったら、管理者に「正式なタグにしてほしい」と伝えます'}
          style={{ border: `1px solid ${t.requested ? 'var(--shu)' : 'var(--line)'}`, background: t.requested ? 'var(--shu)' : '#FFF', color: t.requested ? '#FFF' : 'var(--shu)',
            borderRadius: 999, cursor: 'pointer', fontSize: 10, fontWeight: 700, padding: '1px 8px' }}>
          {t.requested ? '申請中 ✓' : 'タグにしてほしい'}
        </button>
      )}
      {t.source === 'self' && <span className="chip" style={{ padding: '1px 6px', fontSize: 10, background: 'var(--purple-bg)', color: 'var(--purple)' }}>自己分析</span>}
      {t.cards > 0 && <span className="sub" style={{ fontSize: 10 }}>{t.cards}枚</span>}
      <button onClick={onFlip} aria-label="公開と非公開を入れ替える" title="公開と非公開を入れ替える"
        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--sub)', fontSize: 13, padding: '0 2px' }}>⇄</button>
    </span>
  )
}
