'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/browser'

// respond_invitation() は「自分宛・未回答」にしか答えられない関数（0002）。本人のセッションで呼ぶ
export default function InviteButtons({ id }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  async function answer(accept) {
    setBusy(true); setMsg('')
    const { error } = await supabaseBrowser().rpc('respond_invitation', { p_invitation_id: id, p_accept: accept })
    setBusy(false)
    if (error) setMsg(`答えられませんでした: ${error.message}`)
    else { setMsg(accept ? '引き受けました。場づくりエージェントが次に動いたときに日程を決めます' : '見送りました'); router.refresh() }
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="btn btn-p" disabled={busy} onClick={() => answer(true)}>引き受ける</button>
      <button className="btn" disabled={busy} onClick={() => answer(false)}>いまは難しい</button>
      {msg && <span className="sub">{msg}</span>}
    </div>
  )
}
