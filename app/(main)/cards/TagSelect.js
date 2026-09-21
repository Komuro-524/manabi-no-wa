'use client'
import { useMemo, useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// タグはこれからどんどん増えるので、横に並べず「選ぶ」形にする。複数選べる（どれか1つに当てはまるカード＝OR）
// 選んだタグはチップで並べ、×で外せる。一覧の中は名前で絞れる
export default function TagSelect({ tags, value = [], q }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [picked, setPicked] = useState(value)
  const box = useRef(null)
  const byId = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags])

  useEffect(() => {
    if (!open) return
    const close = e => { if (!box.current?.contains(e.target)) apply(picked) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  })

  function apply(ids) {
    setOpen(false)
    const same = ids.length === value.length && ids.every(i => value.includes(i))
    if (same) return
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (ids.length) p.set('tag', ids.join(','))
    router.push('/cards?' + p.toString())
  }
  const toggle = id => setPicked(xs => xs.includes(id) ? xs.filter(x => x !== id) : [...xs, id])
  const shown = tags.filter(t => !filter || t.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div ref={box} style={{ position: 'relative', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" className="btn btn-s" style={{ minHeight: 40 }} aria-expanded={open} onClick={() => open ? apply(picked) : setOpen(true)}>
        タグで絞る{picked.length ? `（${picked.length}）` : `（全${tags.length}）`} ▾
      </button>
      {value.map(id => byId.get(id) && (
        <span key={id} className="chip" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>
          {byId.get(id).name}
          <button type="button" aria-label={`${byId.get(id).name} を外す`} onClick={() => { const next = value.filter(x => x !== id); setPicked(next); apply(next) }}
            style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: '0 0 0 4px', fontSize: 14, lineHeight: 1 }}>×</button>
        </span>
      ))}
      {open && (
        <div className="card sh" style={{ position: 'absolute', top: 46, left: 0, zIndex: 20, width: 300, maxHeight: 360, display: 'flex', flexDirection: 'column', padding: 10, gap: 8 }}>
          <input className="inp" autoFocus value={filter} onChange={e => setFilter(e.target.value)} placeholder="タグの名前で絞る" style={{ minHeight: 36 }} />
          <div className="noscrollbar" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {shown.length === 0 && <span className="sub" style={{ padding: 6 }}>ありません</span>}
            {shown.map(t => (
              <label key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 6px', borderRadius: 6, cursor: 'pointer', background: picked.includes(t.id) ? 'var(--bg)' : undefined }}>
                <input type="checkbox" checked={picked.includes(t.id)} onChange={() => toggle(t.id)} />
                <span style={{ fontSize: 14 }}>{t.name}</span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-s" onClick={() => setPicked([])}>選択を外す</button>
            <button type="button" className="btn btn-p btn-s" onClick={() => apply(picked)}>この条件で見る</button>
          </div>
        </div>
      )}
    </div>
  )
}
