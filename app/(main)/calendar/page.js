import Link from '@/components/Link'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'
import { Icon } from '@/components/icons'
import { splitTitle } from '@/lib/format'
import ScrollToHour from './ScrollToHour'
import CreateLive from './CreateLive'

// 日程カレンダー（自分の分だけ）。月・週・日で切り替え、前後にいくらでも移動できる。
// 予定は「埋まり」だけでタイトルを持たない（ルール11）。場づくりエージェントが見るのもこの「空き／埋まり」だけ
const W = ['日', '月', '火', '水', '木', '金', '土']
const JST = 9 * 3600 * 1000
// 日本時間の「壁の時計」で扱うため、UTC の値に +9時間した Date を使い getUTC* で読む
const wall = iso => new Date(new Date(iso).getTime() + JST)
const todayWall = () => { const d = wall(new Date().toISOString()); d.setUTCHours(0, 0, 0, 0); return d }
const ymd = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x }
const toIso = d => new Date(d.getTime() - JST).toISOString()   // 壁の時計 → 本当の時刻
const hm = d => `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`
const HOUR = 44

export default async function CalendarPage({ searchParams }) {
  const sp = await searchParams
  const view = ['month', 'week', 'day'].includes(sp.view) ? sp.view : 'week'
  const base = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? new Date(sp.date + 'T00:00:00Z') : todayWall()
  const me = await currentUser()
  const db = await supabaseServer()

  // 表示する範囲
  let from, to, title, prev, next
  if (view === 'month') {
    const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1))
    from = addDays(first, -first.getUTCDay()); to = addDays(from, 42)
    title = `${base.getUTCFullYear()}年${base.getUTCMonth() + 1}月`
    prev = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1)); next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1))
  } else if (view === 'week') {
    from = addDays(base, -base.getUTCDay()); to = addDays(from, 7)
    const last = addDays(to, -1)
    title = `${from.getUTCMonth() + 1}/${from.getUTCDate()}（日）〜 ${last.getUTCMonth() + 1}/${last.getUTCDate()}（土）`
    prev = addDays(base, -7); next = addDays(base, 7)
  } else {
    from = base; to = addDays(base, 1)
    title = `${base.getUTCFullYear()}年${base.getUTCMonth() + 1}月${base.getUTCDate()}日（${W[base.getUTCDay()]}）`
    prev = addDays(base, -1); next = addDays(base, 1)
  }

  const [{ data: busy }, { data: parts }, { data: officialTags }] = await Promise.all([
    db.from('calendar_events').select('starts_at, ends_at').eq('busy', true)   // RLS: 自分の予定だけ
      .lt('starts_at', toIso(to)).gt('ends_at', toIso(from)),
    db.from('live_participants').select('role, lives(id, title, status, scheduled_start, scheduled_end, started_at, ended_at)').eq('user_id', me.id),
    db.from('tags').select('id, name').eq('status', 'official').order('name'),
  ])
  const items = []
  for (const b of busy ?? []) items.push({ kind: 'busy', s: wall(b.starts_at), e: wall(b.ends_at) })
  for (const p of parts ?? []) {
    const l = p.lives; if (!l) continue
    const st = l.scheduled_start ?? l.started_at; if (!st) continue
    const en = l.scheduled_end ?? l.ended_at ?? st
    const s = wall(st), e0 = wall(en), e = e0 - s < 30 * 60000 ? new Date(s.getTime() + 60 * 60000) : e0
    if (e <= from || s >= to) continue
    items.push({ kind: 'live', s, e, id: l.id, title: splitTitle(l.title).main, role: p.role, past: l.status === 'ended' })
  }
  const dayItems = d => items.filter(it => ymd(it.s) === ymd(d)).sort((a, b) => a.s - b.s)
  const today = ymd(todayWall())
  const link = (v, d) => `/calendar?view=${v}&date=${ymd(d)}`

  return (
    <>
      <Topbar me={me} title="日程カレンダー" sub="灰色はあなたの予定（中身は持たず、埋まっていることだけ）。朱色はライブ" />
      <div className="body" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-s" href={link(view, prev)} aria-label="前へ"><Icon name="back" size={14} /></Link>
          <Link className="btn btn-s" href={link(view, todayWall())}>今日</Link>
          <Link className="btn btn-s" href={link(view, next)} aria-label="次へ"><span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="back" size={14} /></span></Link>
          <b style={{ fontSize: 18, marginLeft: 6 }}>{title}</b>
          <span style={{ display: 'inline-flex', gap: 4, marginLeft: 6 }}>
            {[['month', '月'], ['week', '週'], ['day', '日']].map(([v, l]) => (
              <Link key={v} className={'tab' + (view === v ? ' tabon' : '')} style={{ minHeight: 34, padding: '6px 12px' }} href={link(v, base)}>{l}</Link>
            ))}
          </span>
          <span style={{ flexGrow: 1 }} />
          <CreateLive tags={officialTags ?? []} defaultDate={ymd(view === 'month' && ymd(base) < ymd(todayWall()) ? todayWall() : (ymd(base) < ymd(todayWall()) ? todayWall() : base))} />
        </div>

        {view === 'month' && (
          <div className="card" style={{ flexGrow: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'auto repeat(6, 1fr)', overflow: 'hidden' }}>
            {W.map((w, i) => <div key={w} className="sub" style={{ padding: '6px 8px', fontWeight: 700, color: i === 0 ? 'var(--shu)' : i === 6 ? 'var(--blue)' : undefined, borderBottom: '1px solid var(--line)' }}>{w}</div>)}
            {Array.from({ length: 42 }, (_, i) => addDays(from, i)).map(d => {
              const its = dayItems(d), other = d.getUTCMonth() !== base.getUTCMonth()
              return (
                <div key={ymd(d)} style={{ padding: 6, borderRight: '1px solid var(--line-soft)', borderBottom: '1px solid var(--line-soft)', display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0, overflow: 'hidden', color: 'var(--ink)', background: other ? 'var(--bg)' : undefined }}>
                  <Link href={link('day', d)} style={{ fontSize: 12, fontWeight: 700, alignSelf: 'flex-start', padding: '1px 6px', borderRadius: 999, background: ymd(d) === today ? 'var(--shu)' : undefined, color: ymd(d) === today ? '#FFF' : other ? 'var(--sub)' : 'var(--ink)' }}>{d.getUTCDate()}</Link>
                  {its.slice(0, 3).map((it, k) => <Chip key={k} it={it} />)}
                  {its.length > 3 && <Link href={link('day', d)} className="sub" style={{ fontSize: 10 }}>ほか{its.length - 3}件</Link>}
                </div>
              )
            })}
          </div>
        )}

        {view !== 'month' && (
          <div className="card" style={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `52px repeat(${view === 'week' ? 7 : 1}, 1fr)`, borderBottom: '1px solid var(--line)' }}>
              <span />
              {Array.from({ length: view === 'week' ? 7 : 1 }, (_, i) => addDays(from, i)).map(d => (
                <Link key={ymd(d)} href={link('day', d)} style={{ padding: '6px 8px', textAlign: 'center', color: d.getUTCDay() === 0 ? 'var(--shu)' : d.getUTCDay() === 6 ? 'var(--blue)' : 'var(--ink)', fontWeight: 700, fontSize: 13 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 999, background: ymd(d) === today ? 'var(--shu)' : undefined, color: ymd(d) === today ? '#FFF' : undefined }}>{d.getUTCMonth() + 1}/{d.getUTCDate()}（{W[d.getUTCDay()]}）</span>
                </Link>
              ))}
            </div>
            <ScrollToHour hour={8} unit={HOUR}>
              <div style={{ display: 'grid', gridTemplateColumns: `52px repeat(${view === 'week' ? 7 : 1}, 1fr)`, position: 'relative', height: HOUR * 24 }}>
                <div>{Array.from({ length: 24 }, (_, h) => <div key={h} className="sub" style={{ height: HOUR, fontSize: 10, textAlign: 'right', paddingRight: 6, transform: 'translateY(-6px)' }}>{h ? `${h}:00` : ''}</div>)}</div>
                {Array.from({ length: view === 'week' ? 7 : 1 }, (_, i) => addDays(from, i)).map(d => (
                  <div key={ymd(d)} style={{ position: 'relative', borderLeft: '1px solid var(--line-soft)', background: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR - 1}px, var(--line-soft) ${HOUR - 1}px, var(--line-soft) ${HOUR}px)` }}>
                    {withLanes(dayItems(d)).map((it, k) => {
                      const top = (it.s.getUTCHours() + it.s.getUTCMinutes() / 60) * HOUR
                      const h = Math.max(22, (it.e - it.s) / 3600000 * HOUR - 2)
                      // 重なっている予定は横に並べる（前は同じ場所に重なって下の予定が見えなかった）
                      const w = 100 / it.lanes
                      return (
                        <div key={k} style={{ position: 'absolute', top, left: `calc(${it.lane * w}% + 3px)`, width: `calc(${w}% - 6px)`, height: h }}>
                          <Chip it={it} tall />
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </ScrollToHour>
          </div>
        )}
        <div className="note">打診を引き受けると、場づくりエージェントがここの「空き」だけを見て、15:00〜16:00の枠から予約します。予定の中身や相手は見ません</div>
      </div>
    </>
  )
}

// 同じ日の予定を、重なりに応じて横の列（lane）に振り分ける
function withLanes(items) {
  const ends = []   // 各列の最後の終わり時刻
  const out = items.map(it => {
    let lane = ends.findIndex(e => e <= it.s)
    if (lane === -1) { lane = ends.length; ends.push(it.e) } else ends[lane] = it.e
    return { ...it, lane }
  })
  const lanes = Math.max(1, ends.length)
  return out.map(it => ({ ...it, lanes }))
}

function Chip({ it, tall }) {
  const style = { fontSize: 11, borderRadius: 6, padding: '3px 6px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'block', height: tall ? '100%' : undefined }
  if (it.kind === 'busy') return <span style={{ ...style, background: 'var(--bar)', color: 'var(--ink2)' }}>{hm(it.s)}–{hm(it.e)} 予定あり</span>
  return (
    <Link href={`/live/${it.id}`} style={{ ...style, background: it.past ? 'var(--shu-bg)' : 'var(--shu)', color: it.past ? 'var(--shu)' : '#FFF' }}>
      {hm(it.s)} ＃{it.title}（{it.role === 'speaker' ? '話し手' : '参加'}）
    </Link>
  )
}
