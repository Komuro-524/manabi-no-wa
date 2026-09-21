import Link from '@/components/Link'
import { usersByIds } from '@/lib/users-by-id'
import { requireAdmin } from '@/lib/admin-guard'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'
import AdminRunButton from '@/components/AdminRunButton'
import AutoRefresh from '@/components/AutoRefresh'
import { fmtWhen } from '@/lib/format'

// ライブのタネ（DB上は quests）。場づくりエージェントが育てている「ライブになる前のタネ」を段階ごとに並べる。
// quests / quest_steps / agent_runs はブラウザから読めない設計 → 管理者と確かめてから service_role で読む
const COLS = [
  ['scouting', '育ち待ち'],
  ['inviting', '話し手に相談中'],
  ['scheduling', '日程を決め中'],
  ['opened', 'ライブ予約済み'],
  ['done', '開催済み'],
]

export default async function Seeds() {
  const me = await requireAdmin()
  const db = supabaseAdmin()
  const [{ data: quests }, { data: runs }] = await Promise.all([
    db.from('quests').select('id, status, current_invitee, tried_count, next_action_at, reevaluate_at, tags(name)').in('status', COLS.map(c => c[0])).order('id', { ascending: false }).limit(500),
    db.from('agent_runs').select('status, started_at').eq('agent', 'B').order('id', { ascending: false }).limit(1),
  ])
  // 足あとは「いま進行中のタネ」の分だけ・話し手は相談中の人だけを読む（全件読むと年月で上限に当たる）
  const qIds = (quests ?? []).map(q => q.id)
  const [{ data: steps }, people] = await Promise.all([
    qIds.length ? db.from('quest_steps').select('quest_id, reason, created_at').in('quest_id', qIds).order('id', { ascending: false }).limit(1000) : { data: [] },
    usersByIds(db, (quests ?? []).map(q => q.current_invitee), 'id, display_name'),
  ])
  const who = new Map([...people.values()].map(u => [u.id, u.display_name]))
  const last = new Map()
  for (const s of steps ?? []) if (!last.has(s.quest_id)) last.set(s.quest_id, s)
  const run = runs?.[0]
  const running = run?.status === 'running' && Date.now() - new Date(run.started_at).getTime() < 10 * 60 * 1000

  return (
    <>
      <Topbar me={me} title="ライブのタネ" sub="場づくりエージェントが育てている、ライブになる前のタネ" />
      <AutoRefresh active every={running ? 3000 : 15000} />
      <div className="body" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {running
            ? <span className="chip" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: 13, padding: '7px 12px' }}>
                <span className="spin" style={{ width: 12, height: 12, borderRadius: 999, border: '2px solid var(--amber)', borderTopColor: 'transparent' }} />場づくりエージェントが動いています</span>
            : <span className="chip" style={{ background: 'var(--sand)', color: 'var(--ink2)', fontSize: 13, padding: '7px 12px' }}>待機中{run ? `（前回 ${fmtWhen(run.started_at)}）` : ''}</span>}
          {!running && <AdminRunButton url="/api/admin/organizer" label="いま1周動かす" small />}
        </div>

        <div style={{ flexGrow: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${COLS.length}, minmax(170px, 1fr))`, gap: 10, overflowX: 'auto' }}>
          {COLS.map(([st, name]) => {
            const qs = (quests ?? []).filter(q => q.status === st)
            return (
              <div key={st} style={{ background: 'var(--bar)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><b>{name}</b><span className="kpi" style={{ fontSize: 16 }}>{qs.length}</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', minHeight: 0 }}>
                  {qs.map(q => {
                    const s = last.get(q.id)
                    return (
                      <Link key={q.id} href={`/admin/quests?id=${q.id}`} className="card" style={{ padding: 10, color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                        <b>＃{q.tags?.name ?? '?'}</b>
                        {q.current_invitee && <span className="sub">{who.get(q.current_invitee)}さん</span>}
                        {s && <span className="sub" style={{ fontSize: 11 }}>{fmtWhen(s.created_at)}</span>}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
