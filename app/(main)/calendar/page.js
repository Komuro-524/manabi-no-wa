import Link from 'next/link'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'
import { splitTitle } from '@/lib/format'

const W = ['日', '月', '火', '水', '木', '金', '土']
const jst = d => new Date(new Date(d).toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
const key = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

// 日程カレンダー（自分の分だけ）。予定は「埋まり」だけでタイトルを持たない（ルール11）。
// 場づくりエージェントが見るのもこの「空き／埋まり」だけ
export default async function CalendarPage() {
  const me = await currentUser()
  const db = await supabaseServer()
  const [{ data: busy }, { data: parts }] = await Promise.all([
    db.from('calendar_events').select('starts_at, ends_at').eq('busy', true),   // RLS: 自分の予定だけ
    db.from('live_participants').select('role, lives(id, title, status, scheduled_start, scheduled_end)').eq('user_id', me.id),
  ])
  const today = jst(new Date()); today.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return d })
  const byDay = new Map(days.map(d => [key(d), []]))
  for (const b of busy ?? []) { const s = jst(b.starts_at), e = jst(b.ends_at); byDay.get(key(s))?.push({ kind: 'busy', s, e }) }
  for (const p of parts ?? []) {
    const l = p.lives; if (!l || l.status !== 'scheduled' || !l.scheduled_start) continue
    const s = jst(l.scheduled_start), e = jst(l.scheduled_end ?? l.scheduled_start)
    byDay.get(key(s))?.push({ kind: 'live', s, e, id: l.id, title: splitTitle(l.title).main, role: p.role })
  }
  const hm = d => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`

  return (
    <>
      <Topbar me={me} title="日程カレンダー" sub="これから2週間。灰色はあなたの予定（中身は持たず、埋まっていることだけ）" />
      <div className="body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {days.map(d => {
            const items = (byDay.get(key(d)) ?? []).sort((a, b) => a.s - b.s)
            const wk = d.getDay()
            return (
              <div key={key(d)} className="card" style={{ padding: 10, minHeight: 120, display: 'flex', flexDirection: 'column', gap: 6, background: wk === 0 || wk === 6 ? 'var(--bg)' : undefined }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: wk === 0 ? 'var(--shu)' : wk === 6 ? 'var(--blue)' : undefined }}>{d.getMonth() + 1}/{d.getDate()}（{W[wk]}）</span>
                {items.map((it, i) => it.kind === 'busy'
                  ? <span key={i} style={{ fontSize: 11, background: 'var(--bar)', color: 'var(--ink2)', borderRadius: 6, padding: '3px 6px' }}>{hm(it.s)}–{hm(it.e)} 予定あり</span>
                  : <Link key={i} href={`/live/${it.id}`} style={{ fontSize: 11, background: 'var(--shu)', color: '#FFF', borderRadius: 6, padding: '3px 6px' }}>{hm(it.s)} ＃{it.title}（{it.role === 'speaker' ? '話し手' : '参加'}）</Link>)}
              </div>
            )
          })}
        </div>
        <div className="note">打診を引き受けると、場づくりエージェントがここの「空き」だけを見て、15:00〜16:00の枠から予約します。予定の中身や相手は見ません</div>
      </div>
    </>
  )
}
