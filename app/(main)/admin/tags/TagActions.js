'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/browser'

// ★ 管理者本人のセッションで tags を更新する。RLS「管理者だけタグを裁ける」が効くので、
//   一般社員が同じ操作をしてもデータベースが拒否する（service_role は使わない）
export default function TagActions({ id, status, meId }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function update(patch) {
    setBusy(true); setErr('')
    const now = new Date().toISOString()
    const { error } = await supabaseBrowser().from('tags')
      .update({ ...patch, reviewed_by: meId, reviewed_at: now }).eq('id', id)
    setBusy(false)
    if (error) setErr(error.message); else router.refresh()
  }
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      {(status === 'proposed' || status === 'candidate') &&
        <button className="btn btn-s btn-p" disabled={busy} onClick={() => update({ status: 'official', promoted_at: new Date().toISOString() })}>正式にする</button>}
      {status !== 'banned' && status !== 'rejected' &&
        <button className="btn btn-s" disabled={busy} onClick={() => update({ status: 'banned' })}>禁止する</button>}
      {err && <span className="sub" style={{ color: '#A33724' }}>{err}</span>}
    </span>
  )
}
