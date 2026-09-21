'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/browser'

// タグ帳の「単語帳」。申請つき・格上げ候補のタグを、リングで綴じた単語帳にして1枚ずつ仕分ける。
//   クリック（または「採用」）→ ぺらっとめくれて正式タグに
//   つかんで引っぱる（または「却下」）→ ビリッと破れて見送り（rejected）
// ★ 更新は TagActions と同じく管理者本人のセッションで tags を書く（RLS「管理者だけタグを裁ける」が効く）
const TEAR = 110   // これ以上引っぱって離したら破る（px）

export default function TagDeck({ deck, meId, onClose }) {
  const router = useRouter()
  const [cards, setCards] = useState(deck)
  const [anim, setAnim] = useState(null)        // { id, kind: 'flip' | 'tear' }
  const [pull, setPull] = useState(null)        // { dx, dy }
  const [done, setDone] = useState({ ok: 0, ng: 0 })
  const [err, setErr] = useState('')
  const [closing, setClosing] = useState(false)
  const drag = useRef(null)
  const top = cards[0]

  function close() {
    setClosing(true)
    setTimeout(() => { onClose(); if (done.ok + done.ng > 0) router.refresh() }, 350)
  }
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') close()
      if (anim || !top) return
      if (e.key === 'Enter' || e.key === 'ArrowUp') decide(top, true)
      if (e.key === 'Delete' || e.key === 'ArrowDown') decide(top, false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function decide(t, adopt) {
    if (anim) return
    setErr(''); setPull(null)
    setAnim({ id: t.id, kind: adopt ? 'flip' : 'tear' })
    const now = new Date().toISOString()
    const patch = adopt
      ? { status: 'official', promoted_at: now }
      : { status: 'rejected', rejected_reason: '管理者が見送り（タグ帳）' }
    const [{ error }] = await Promise.all([
      supabaseBrowser().from('tags').update({ ...patch, reviewed_by: meId, reviewed_at: now }).eq('id', t.id),
      new Promise(r => setTimeout(r, 650)),   // 演出が終わるのを待つ
    ])
    setAnim(null)
    if (error) { setErr(`「${t.name}」を${adopt ? '採用' : '却下'}できませんでした: ${error.message}`); return }
    setDone(d => adopt ? { ...d, ok: d.ok + 1 } : { ...d, ng: d.ng + 1 })
    setCards(cs => cs.filter(c => c.id !== t.id))
  }

  function down(e) {
    if (e.button !== 0 || anim || e.target.closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x0: e.clientX, y0: e.clientY, moved: false }
  }
  function move(e) {
    const d = drag.current; if (!d) return
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0
    if (!d.moved && Math.hypot(dx, dy) < 6) return
    d.moved = true
    setPull({ dx, dy })
  }
  function up(e) {
    const d = drag.current; drag.current = null
    if (!d || !top) return
    if (!d.moved) return decide(top, true)                         // 引っぱらずに離した＝クリック＝採用
    const dist = Math.hypot(e.clientX - d.x0, e.clientY - d.y0)
    if (dist >= TEAR) decide(top, false); else setPull(null)          // 足りなければ戻す
  }

  const strain = pull ? Math.min(1, Math.hypot(pull.dx, pull.dy) / TEAR) : 0

  return (
    <div className={'deck-back' + (closing ? ' deck-out' : '')} role="dialog" aria-modal="true" aria-label="タグ帳で仕分ける">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: 'min(560px, 92vw)' }}>
        <div style={{ color: '#F3E3B0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="wa" style={{ fontSize: 26, fontWeight: 700 }}>{top ? '申請が届いているタグ' : '全部めくりました'}</span>
          <span style={{ fontSize: 13, color: '#C7BFA0' }}>
            {top ? `残り ${cards.length}枚 ・ クリックで採用／つかんで引っぱると破って却下` : `採用 ${done.ok}枚 ・ 却下 ${done.ng}枚`}
          </span>
        </div>

        <div style={{ position: 'relative', width: '100%', height: 250, marginBottom: 28 }}>
          {/* 下に重なっている札（3枚まで見せる） */}
          {cards.slice(1, 4).reverse().map((c, i, arr) => {
            const depth = arr.length - i
            return <div key={c.id} className="deck-card" aria-hidden="true"
              style={{ transform: `translate(${depth * 7}px, ${depth * 9}px)`, filter: `brightness(${1 - depth * 0.06})` }} />
          })}
          {top && (anim?.kind === 'tear' && anim.id === top.id ? (
            <>
              <div className="deck-card deck-half deck-tear-l"><Face t={top} /></div>
              <div className="deck-card deck-half deck-tear-r"><Face t={top} /></div>
            </>
          ) : (
            <div key={top.id} className={'deck-card deck-top' + (anim?.kind === 'flip' ? ' deck-flip' : '')} tabIndex={0}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setPull(null) }}
              style={pull ? { transform: `translate(${pull.dx * 0.35}px, ${pull.dy * 0.35}px) rotate(${pull.dx * 0.03}deg)`, transition: 'none', cursor: 'grabbing',
                boxShadow: `0 ${10 + strain * 16}px ${24 + strain * 20}px rgba(0,0,0,${0.3 + strain * 0.2})` } : undefined}>
              <Face t={top} strain={strain} />
            </div>
          ))}
          {!top && <div className="deck-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="wa" style={{ fontSize: 22, fontWeight: 700, color: 'var(--sub)' }}>おつかれさまでした</span></div>}
          {/* 綴じリング（札の左上の穴を通す） */}
          <svg className="deck-ring" width="64" height="84" viewBox="0 0 64 84" aria-hidden="true">
            <path d="M40 30 A26 26 0 1 0 40 72" fill="none" stroke="#C9CED6" strokeWidth="6" strokeLinecap="round" />
            <path d="M40 30 A26 26 0 1 0 40 72" fill="none" stroke="#8E959F" strokeWidth="2" strokeLinecap="round" transform="translate(1 1)" opacity=".6" />
          </svg>
        </div>

        {err && <div className="err" style={{ width: '100%' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {top && <>
            <button className="btn btn-p" disabled={!!anim} onClick={() => decide(top, true)}>✓ 採用して正式タグに</button>
            <button className="btn" disabled={!!anim} onClick={() => decide(top, false)} style={{ background: '#FFF' }}>✕ 却下する</button>
          </>}
          <button className="btn" onClick={close} style={{ background: 'transparent', color: '#F3E3B0', borderColor: 'rgba(243,227,176,.4)' }}>
            {top ? 'あとで（一覧へ）' : 'タグ帳の一覧へ'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Face({ t, strain = 0 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '26px 30px 22px 92px', height: '100%' }}>
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {t.requests > 0 && <span className="chip" style={{ background: 'var(--shu-bg)', color: 'var(--shu)' }}>申請 {t.requests}人</span>}
        <span className="chip" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>{t.status === 'proposed' ? '格上げ候補' : '候補'}</span>
      </span>
      <span className="wa" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.25, overflowWrap: 'anywhere', color: 'var(--ink)' }}>＃{t.name}</span>
      <span className="sub">直近30日に {t.lives}つのライブ・{t.people}人が語った</span>
      <span style={{ flexGrow: 1 }} />
      <span className="sub" style={{ fontSize: 11, color: strain > 0.95 ? 'var(--shu)' : undefined }}>
        {strain > 0.95 ? '離すと破って却下します' : strain > 0 ? 'もう少し引っぱると破れます' : 'クリックで採用 ／ 引っぱって却下'}
      </span>
    </div>
  )
}
