'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 管理者用のボタン：API を呼び、結果をボタンの横に短く出す
export default function AdminRunButton({ url, body, label, busyLabel = '動かしています…', primary = true, confirmText, small }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  async function run() {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true); setRes(null)
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) })
      setRes(await r.json())
    } catch (e) { setRes({ error: String(e) }) }
    setBusy(false); router.refresh()
  }
  return (
    <span style={{ display: 'inline-flex', flexDirection: small ? 'row' : 'column', alignItems: small ? 'center' : 'flex-start', gap: 8, flexWrap: 'wrap' }}>
      <button className={'btn' + (primary ? ' btn-p' : '') + (small ? ' btn-s' : '')} disabled={busy} onClick={run}>{busy ? busyLabel : label}</button>
      {res?.error && <span className="err" style={{ padding: '6px 10px' }}>{res.error}</span>}
      {res?.message && <span className="sub">{res.message}</span>}
    </span>
  )
}
