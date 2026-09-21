'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 「配信予定を作成」ボタンと、そのポップアップ
export default function CreateLive({ tags, defaultDate }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [tagId, setTagId] = useState('')
  const [date, setDate] = useState(defaultDate)
  // 初めの値は「次のちょうどの時刻」（過去の時刻を入れて作れない、を避ける）。今日を表示していないときは15:00
  const [time, setTime] = useState(() => {
    const now = new Date(Date.now() + 9 * 3600 * 1000)
    const todayStr = now.toISOString().slice(0, 10)
    if (defaultDate !== todayStr) return '15:00'
    return `${String(Math.min(23, now.getUTCHours() + 1)).padStart(2, '0')}:00`
  })
  const [minutes, setMinutes] = useState(60)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function close() { setOpen(false); setErr(''); setTitle(''); setTagId('') }
  async function create(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    const start = new Date(`${date}T${time}:00+09:00`)   // 日本時間として解釈する
    const r = await fetch('/api/lives', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, tagId: tagId || null, start: start.toISOString(), minutes }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(j.error ?? '作れませんでした'); return }
    close(); router.push(`/live/${j.id}`)
  }

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)} style={{ background: '#A8321E', borderColor: '#A8321E', color: '#FFF' }}>＋ 配信予定を作成</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="配信予定を作成" onClick={close}
          style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,61,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 16 }}>
          <form onClick={e => e.stopPropagation()} onSubmit={create} className="card"
            style={{ width: 460, maxWidth: '100%', padding: 22, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 16px 40px rgba(28,43,61,.25)' }}>
            <div className="ttl">配信予定を作成</div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="sub" style={{ fontWeight: 700 }}>配信タイトル</span>
              <input className="inp" value={title} onChange={e => setTitle(e.target.value)} maxLength={60} placeholder="例：Power Automate のつまずきを持ち寄る回" autoFocus />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="sub" style={{ fontWeight: 700 }}>タグ</span>
              <select className="inp" value={tagId} onChange={e => setTagId(e.target.value)}>
                <option value="">タグなし</option>
                {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span className="sub" style={{ fontWeight: 700 }}>日付</span>
                <input className="inp" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span className="sub" style={{ fontWeight: 700 }}>開始</span>
                <input className="inp" type="time" value={time} step={900} onChange={e => setTime(e.target.value)} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span className="sub" style={{ fontWeight: 700 }}>長さ</span>
                <select className="inp" value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
                  {[30, 60, 90, 120].map(m => <option key={m} value={m}>{m}分</option>)}
                </select></label>
            </div>
            <span className="sub">作ったあなたが話し手として入ります</span>
            {err && <div className="err">{err}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={close}>キャンセル</button>
              <button className="btn" disabled={busy || title.trim().length < 2} style={{ background: '#A8321E', borderColor: '#A8321E', color: '#FFF' }}>{busy ? '作成中…' : '作成'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
