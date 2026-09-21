'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 管理者用のボタン：API を呼び、エージェントの実行ログをその場に出す
export default function AdminRunButton({ url, body, label, busyLabel = '動かしています…', primary = true, confirmText }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  async function run() {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true); setRes(null)
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) })
      const j = await r.json()
      setRes(j)
    } catch (e) { setRes({ error: String(e) }) }
    setBusy(false); router.refresh()
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button className={'btn' + (primary ? ' btn-p' : '')} disabled={busy} onClick={run} style={{ alignSelf: 'flex-start' }}>{busy ? busyLabel : label}</button>
      {res?.error && <div className="err">{res.error}</div>}
      {res?.message && <div className="note">{res.message}</div>}
      {res?.log && <pre className="mono" style={{ background: '#1E2634', color: '#E7EBF2', padding: 12, borderRadius: 10, maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>{res.log}</pre>}
    </div>
  )
}
