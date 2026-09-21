import Link from '@/components/Link'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'
import { Icon } from '@/components/icons'
import { fmtWhen, splitTitle } from '@/lib/format'
import { usersByIds } from '@/lib/users-by-id'

// まなびのライブ（最初に開く画面）。読むのは全部 anon キー＋本人のセッション（RLS がそのまま効く）
export default async function LiveHub() {
  const me = await currentUser()
  const db = await supabaseServer()

  // ★ 年月がたつとライブも参加記録も増え続ける。画面に出す分（配信中・予定・最近の過去12件）だけを読む
  const base = () => db.from('lives').select('id, title, status, scheduled_start, started_at, ended_at, ingest_status, topic_tag_id, tags(name)')
  const [{ data: l1 }, { data: l2 }, { data: l3 }] = await Promise.all([
    base().eq('status', 'live').order('id', { ascending: false }).limit(50),
    base().eq('status', 'scheduled').order('scheduled_start').limit(100),
    base().eq('status', 'ended').order('id', { ascending: false }).limit(12),
  ])
  const lives = [...(l1 ?? []), ...(l2 ?? []), ...(l3 ?? [])]
  const { data: parts } = lives.length
    ? await db.from('live_participants').select('live_id, user_id, role').in('live_id', lives.map(l => l.id))
    : { data: [] }
  const users = await usersByIds(db, (parts ?? []).map(p => p.user_id), 'id, display_name')
  const nameOf = new Map([...users.values()].map(u => [u.id, u.display_name]))
  const byLive = new Map()
  for (const p of parts ?? []) {
    if (!byLive.has(p.live_id)) byLive.set(p.live_id, [])
    byLive.get(p.live_id).push(p)
  }

  const onAir    = (lives ?? []).filter(l => l.status === 'live')
  const upcoming = (lives ?? []).filter(l => l.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start))
  const past     = (lives ?? []).filter(l => l.status === 'ended').slice(0, 12)

  return (
    <>
      <Topbar me={me} title="参加するライブを選ぶ"
        sub={`いま配信中 ${onAir.length}件 ／ これから ${upcoming.length}件 ／ 過去 ${past.length}件`} />
      <div className="body">
        <span className="sec">配信中</span>
        {onAir.length ? onAir.map(l => <LiveRow key={l.id} l={l} ps={byLive.get(l.id)} nameOf={nameOf} me={me} kind="live" />)
          : <div className="card empty">いま配信中のライブはありません</div>}

        <span className="sec">配信予定</span>
        {upcoming.length ? upcoming.map(l => <LiveRow key={l.id} l={l} ps={byLive.get(l.id)} nameOf={nameOf} me={me} kind="scheduled" />)
          : <div className="card empty">予定されたライブはありません。場づくりエージェントが話し手を探しています</div>}

        <span className="sec">過去のライブ</span>
        {past.length ? past.map(l => <LiveRow key={l.id} l={l} ps={byLive.get(l.id)} nameOf={nameOf} me={me} kind="ended" />)
          : <div className="card empty">まだありません</div>}
      </div>
    </>
  )
}

function LiveRow({ l, ps = [], nameOf, me, kind }) {
  const { main, sub } = splitTitle(l.title)
  const speakers  = ps.filter(p => p.role === 'speaker').map(p => nameOf.get(p.user_id) ?? '?')
  const listeners = ps.filter(p => p.role !== 'speaker').length
  const mine = ps.some(p => p.user_id === me.id)
  return (
    <div className="card sh" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 5, flexGrow: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            {l.tags?.name && <span className="chip" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}><Icon name="tag" size={13} />{l.tags.name}</span>}
            {kind === 'live' && <span className="chip" style={{ background: 'var(--live)', color: '#FFF' }}><span className="dot" style={{ background: '#FFF' }} />いま配信中</span>}
            {kind === 'scheduled' && <span className="chip" style={{ background: 'var(--sand)', color: 'var(--ink2)' }}><Icon name="clock" size={13} />{fmtWhen(l.scheduled_start)}</span>}
            {kind === 'ended' && <span className="chip" style={{ background: 'var(--sand)', color: 'var(--ink2)' }}>{fmtWhen(l.ended_at ?? l.started_at)} 終了</span>}
            {kind === 'ended' && l.ingest_status === 'running' && <span className="chip" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}><span className="spin" style={{ width: 10, height: 10, borderRadius: 999, border: '2px solid var(--amber)', borderTopColor: 'transparent' }} />タグ付け中</span>}
            {kind === 'ended' && l.ingest_status === 'needs_review' && <span className="chip" style={{ background: 'var(--shu-bg)', color: 'var(--shu)' }}>人の確認待ち</span>}
            {mine && <span className="chip" style={{ background: 'var(--teal-bg)', color: 'var(--teal)' }}>あなたも参加</span>}
          </span>
          <span style={{ fontSize: 22, fontWeight: 700 }}>＃{main}</span>
          <span className="sub">
            {sub && <>{sub} ・ </>}
            {speakers.length ? `スピーカー ${speakers.join('・')}` : 'スピーカー未定'}
            {listeners > 0 && ` ・ リスナー ${listeners}人`}
          </span>
        </span>
        {kind === 'live'
          ? <Link className="btn btn-p" style={{ fontSize: 16, padding: '14px 26px', minHeight: 54, borderRadius: 12 }} href={`/live/${l.id}`}><Icon name="play" size={18} /> 入る</Link>
          : <Link className="btn" style={{ fontSize: 15, padding: '14px 22px', minHeight: 54, borderRadius: 12 }} href={`/live/${l.id}`}>{kind === 'scheduled' ? '詳しく見る' : '振り返る'}</Link>}
      </div>
    </div>
  )
}
