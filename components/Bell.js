'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Icon } from './icons'

const STYLE = {
  tag: ['var(--blue-bg)', 'var(--blue)', 'tag'], invite: ['var(--shu-bg)', 'var(--shu)', 'invite'],
  self: ['var(--amber-bg)', 'var(--amber)', 'scan'], card: ['var(--purple-bg)', 'var(--purple)', 'cards'],
  live: ['var(--teal-bg)', 'var(--teal)', 'live'],
}
// おしらせ。開いたときに読む
export default function Bell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(null)
  const box = useRef(null)
  useEffect(() => {
    const close = e => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('click', close); return () => document.removeEventListener('click', close)
  }, [])
  async function toggle() {
    const next = !open; setOpen(next)
    if (next) { setItems(null); const r = await fetch('/api/notifications'); const j = await r.json(); setItems(j.items ?? []) }
  }
  return (
    <span ref={box} style={{ position: 'relative' }}>
      <button className="btn btn-s" style={{ minHeight: 40, padding: '0 11px' }} aria-label="おしらせ" onClick={toggle}><Icon name="bell" /></button>
      {open && (
        <div className="card" style={{ position: 'absolute', top: 46, right: 0, width: 320, boxShadow: '0 8px 24px rgba(30,38,52,.14)', zIndex: 50, maxHeight: 400, overflow: 'auto' }}>
          <div style={{ padding: '12px 14px 8px', fontSize: 14, fontWeight: 700 }}>おしらせ</div>
          {items === null && <div className="sub" style={{ padding: '0 14px 14px' }}>読み込み中…</div>}
          {items?.length === 0 && <div className="sub" style={{ padding: '0 14px 14px' }}>新しいおしらせはありません</div>}
          {items?.map((it, i) => {
            const [bg, fg, ic] = STYLE[it.kind] ?? STYLE.tag
            return (
              <Link key={i} href={it.href} onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: '1px solid var(--line-soft)', color: 'var(--ink)' }}>
                <span style={{ width: 28, height: 28, borderRadius: 999, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={ic} size={14} /></span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{it.title}</span>
                  <span className="sub" style={{ fontSize: 11 }}>{it.text}</span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </span>
  )
}
