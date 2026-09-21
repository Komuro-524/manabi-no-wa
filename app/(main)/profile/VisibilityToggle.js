'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/browser'

// set_tag_visibility() は「自分の行」しか動かせない関数（0002）。本人のセッションで呼ぶ
export default function VisibilityToggle({ tagId, kind, visibility, adopt, compact }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const on = visibility === 'public'
  async function set(v) {
    if (v === visibility) return
    setBusy(true); setErr('')
    const { error } = await supabaseBrowser().rpc('set_tag_visibility', { p_tag_id: tagId, p_kind: kind, p_visibility: v })
    setBusy(false)
    if (error) setErr(error.message); else router.refresh()
  }
  if (adopt) return <button className="btn btn-s btn-p" disabled={busy} onClick={() => set('public')}>採用（公開にする）</button>
  return (
    <span className="shu-tabs" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className={'tab' + (on ? ' tabon' : '')} style={compact ? { minHeight: 30, padding: '5px 10px' } : undefined} disabled={busy} onClick={() => set('public')}>公開</button>
      <button className={'tab' + (!on ? ' tabon' : '')} style={compact ? { minHeight: 30, padding: '5px 10px' } : undefined} disabled={busy} onClick={() => set('private')}>非公開</button>
      {err && <span className="sub" style={{ color: 'var(--shu)' }}>{err}</span>}
    </span>
  )
}
