'use client'
import { useState } from 'react'
import Link from '@/components/Link'
import { supabaseBrowser } from '@/lib/supabase/browser'

// 知見タグ・興味タグの公開／非公開。「公開」「非公開」のエリアのあいだをドラッグ＆ドロップで動かす。
// 動かすと set_tag_visibility()（自分の行しか変えられない関数）を本人のセッションで呼ぶ。
// ★ ドラッグできない環境のために、カードの ⇄ を押しても移せる
const KIND = { knowledge: ['知見タグ', '話せること'], interest: ['興味タグ', '聞きたいこと'] }

export default function TagBoard({ tags, kinds = ['knowledge', 'interest'] }) {
  const [items, setItems] = useState(tags)   // 押した瞬間に動かし、失敗したら戻す
  const [over, setOver] = useState(null)
  const [err, setErr] = useState('')

  async function move(t, vis) {
    if (t.visibility === vis) return
    setErr('')
    setItems(xs => xs.map(x => x.id === t.id ? { ...x, visibility: vis } : x))
    const { error } = await supabaseBrowser().rpc('set_tag_visibility', { p_tag_id: t.tag_id, p_kind: t.kind, p_visibility: vis })
    if (error) { setErr(`動かせませんでした: ${error.message}`); setItems(xs => xs.map(x => x.id === t.id ? { ...x, visibility: t.visibility } : x)) }
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
                <div key={vis}
                  onDragOver={e => { e.preventDefault(); if (over !== zone) setOver(zone) }}   // 同じ値で何度も描き直さない
                  onDragLeave={() => setOver(o => o === zone ? null : o)}
                  onDrop={e => {
                    e.preventDefault(); setOver(null)
                    const t = items.find(x => String(x.id) === e.dataTransfer.getData('text/plain'))
                    if (t && t.kind === kind) move(t, vis)
                  }}
                  style={{
                    minHeight: 92, borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
                    background: vis === 'public' ? 'var(--teal-bg)' : 'var(--bg)',
                    border: `2px dashed ${over === zone ? 'var(--shu)' : 'transparent'}`,
                  }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: vis === 'public' ? 'var(--teal)' : 'var(--sub)' }}>{name}<span className="sub" style={{ fontWeight: 400 }}>（{hint}）</span></span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {list.length === 0 && <span className="sub" style={{ fontSize: 11 }}>ここにドラッグ</span>}
                    {list.map(t => <TagCard key={t.id} t={t} onFlip={() => move(t, vis === 'public' ? 'private' : 'public')} />)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {err && <div className="err">{err}</div>}
      <div className="note">育ちかけのタグは、公開にしても管理者が正式にするまで他の人には見えません。自己分析から付いたタグは最初は非公開です。公開に動かすと「採用」になります</div>
    </div>
  )
}

function TagCard({ t, onFlip }) {
  const official = t.status === 'official'
  return (
    <span draggable onDragStart={e => { e.dataTransfer.setData('text/plain', String(t.id)); e.dataTransfer.effectAllowed = 'move' }}
      className="card" title="ドラッグして公開・非公開を切り替え"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 8px 6px 10px', cursor: 'grab', borderRadius: 10, background: '#FFF', borderColor: official ? 'var(--line)' : 'var(--amber)' }}>
      {official
        ? <Link href={`/cards?tag=${t.tag_id}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }} draggable={false}>{t.name}</Link>
        : <span style={{ fontSize: 13, fontWeight: 700 }}>{t.name ?? '育ちかけ'}</span>}
      {!official && <span className="chip" style={{ padding: '1px 6px', fontSize: 10, background: 'var(--amber-bg)', color: 'var(--amber)' }}>育ちかけ</span>}
      {t.source === 'self' && <span className="chip" style={{ padding: '1px 6px', fontSize: 10, background: 'var(--purple-bg)', color: 'var(--purple)' }}>自己分析</span>}
      {t.cards > 0 && <span className="sub" style={{ fontSize: 10 }}>{t.cards}枚</span>}
      <button onClick={onFlip} aria-label="公開と非公開を入れ替える" title="公開と非公開を入れ替える"
        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--sub)', fontSize: 13, padding: '0 2px' }}>⇄</button>
    </span>
  )
}
