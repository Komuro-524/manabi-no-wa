'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { Icon } from '@/components/icons'

// 参加・チャット投稿はブラウザから本人のセッションで書く → RLS（F5）がそのまま効く
export default function LiveActions({ liveId, status, amIn, meId }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (status !== 'live') {
    return <div className="note">{status === 'scheduled' ? 'ライブが始まると、参加とチャットができます' : 'このライブは終了しています。チャットには書き込めません'}</div>
  }

  async function join() {
    setBusy(true); setErr('')
    const { error } = await supabaseBrowser().from('live_participants')
      .insert({ live_id: liveId, user_id: meId, role: 'listener', joined_at: new Date().toISOString() })
    setBusy(false)
    if (error) setErr(`参加できませんでした: ${error.message}`); else router.refresh()
  }

  async function send(e) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true); setErr('')
    const { error } = await supabaseBrowser().from('messages')
      .insert({ live_id: liveId, user_id: meId, is_agent: false, body: text.trim() })
    setBusy(false)
    if (error) setErr(`送れませんでした: ${error.message}`); else { setText(''); router.refresh() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
      {!amIn
        ? <button className="btn btn-p" onClick={join} disabled={busy}><Icon name="play" size={16} /> リスナーとして入る</button>
        : (
          <form onSubmit={send} style={{ display: 'flex', gap: 8 }}>
            <input className="inp" value={text} onChange={e => setText(e.target.value)} placeholder="コメントを書く" maxLength={500} />
            <button className="btn btn-p" disabled={busy || !text.trim()}><Icon name="send" size={15} /> 送る</button>
          </form>
        )}
      <button className="btn btn-s" disabled title="音声は今回の範囲外" style={{ alignSelf: 'flex-start' }}>スピーカーになる（音声は準備中）</button>
      {err && <div className="err">{err}</div>}
    </div>
  )
}
