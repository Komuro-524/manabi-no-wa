'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/browser'

// set_tag_visibility() は「自分の行」しか動かせない関数（0002）。本人のセッションで呼ぶ
export default function VisibilityToggle({ tagId, kind, visibility, adopt }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const on = visibility === 'public'
  async function set(v) {
    setBusy(true); setErr('')
    const { error } = await supabaseBrowser().rpc('set_tag_visibility', { p_tag_id: tagId, p_kind: kind, p_visibility: v })
    setBusy(false)
    if (error) setErr(error.message); else router.refresh()
  }
  if (adopt) return <button className="btn btn-s btn-p" disabled={busy} onClick={() => set('public')}>採用（公開にする）</button>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button aria-label={on ? '非公開にする' : '公開にする'} disabled={busy} onClick={() => set(on ? 'private' : 'public')}
        style={{ width: 40, height: 23, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative', background: on ? 'var(--teal)' : '#CFC8BC' }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 20 : 3, width: 17, height: 17, borderRadius: 999, background: '#FFF', transition: 'left .15s' }} />
      </button>
      <span className="sub">{on ? '公開' : '非公開'}</span>
      {err && <span className="sub" style={{ color: '#A33724' }}>{err}</span>}
    </span>
  )
}
