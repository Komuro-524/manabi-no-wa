import Link from '@/components/Link'
import { usersByIds } from '@/lib/users-by-id'
import { requireAdmin } from '@/lib/admin-guard'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'
import FieldWorker from '@/components/FieldWorker'
import AutoRefresh from '@/components/AutoRefresh'
import { fmtWhen } from '@/lib/format'
import Planter from '@/components/Planter'

// ライブのタネ（DB上は quests）。場づくりエージェントが育てている「ライブになる前のタネ」を段階ごとに並べる。
// quests / quest_steps / agent_runs はブラウザから読めない設計 → 管理者と確かめてから service_role で読む
// 進み具合ごとに植物が育つ（種 → 芽 → 葉 → つぼみ → 花）。同じ段階の中では需要（直近30日に語られた回数）が多いほど大きく描く
const COLS = [
  ['scouting', '育ち待ち', 'タネ'],
  ['inviting', '話し手に相談中', '芽'],
  ['scheduling', '日程を決め中', '葉'],
  ['opened', 'ライブ予約済み', 'つぼみ'],
  ['done', '開催済み', '花'],
]

export default async function Seeds() {
  const me = await requireAdmin()
  const db = supabaseAdmin()
  const [{ data: quests }, { data: runs }] = await Promise.all([
    db.from('quests').select('id, status, current_invitee, tried_count, next_action_at, reevaluate_at, tag_id, tags(name)').in('status', COLS.map(c => c[0])).order('id', { ascending: false }).limit(500),
    db.from('agent_runs').select('status, started_at, finished_at').eq('agent', 'B').order('id', { ascending: false }).limit(1),
  ])
  // 足あとは「いま進行中のタネ」の分だけ・話し手は相談中の人だけを読む（全件読むと年月で上限に当たる）
  const qIds = (quests ?? []).map(q => q.id)
  const [{ data: steps }, people] = await Promise.all([
    qIds.length ? db.from('quest_steps').select('quest_id, reason, created_at').in('quest_id', qIds).order('id', { ascending: false }).limit(1000) : { data: [] },
    usersByIds(db, (quests ?? []).map(q => q.current_invitee), 'id, display_name'),
  ])
  // 需要＝直近30日にそのタグが語られた回数（tag_mentions はブラウザから読めない → ここで数だけ数える）
  const tagIds = [...new Set((quests ?? []).map(q => q.tag_id))]
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { data: ments } = tagIds.length ? await db.from('tag_mentions').select('tag_id').in('tag_id', tagIds).gte('created_at', since).limit(5000) : { data: [] }
  const demand = new Map()
  for (const m of ments ?? []) demand.set(m.tag_id, (demand.get(m.tag_id) ?? 0) + 1)
  const who = new Map([...people.values()].map(u => [u.id, u.display_name]))
  const last = new Map()
  for (const s of steps ?? []) if (!last.has(s.quest_id)) last.set(s.quest_id, s)
  const run = runs?.[0]
  const running = run?.status === 'running' && Date.now() - new Date(run.started_at).getTime() < 10 * 60 * 1000
  // いちばん新しい周で エージェントが決めたこと（新しい順）。畑番の吹き出しと、終わったあとの一覧に使う
  const { data: runSteps } = run ? await db.from('quest_steps').select('decision, reason, created_at, quests(tags(name))')
    .gte('created_at', run.started_at).order('id', { ascending: false }).limit(20) : { data: [] }
  const runLog = (runSteps ?? []).map(x => ({ decision: x.decision, reason: x.reason, tag: x.quests?.tags?.name ?? '?' }))

  return (
    <>
      <Topbar me={me} title="ライブのタネ" sub="場づくりエージェントが育てている、ライブになる前のタネ" />
      <AutoRefresh active={!running} every={15000} />
      <div className="body" style={{ overflow: 'hidden' }}>
        <FieldWorker running={running} run={run ? { started_at: run.started_at, finished_at: run.finished_at } : null} steps={runLog} />

        <div style={{ flexGrow: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${COLS.length}, minmax(170px, 1fr))`, gap: 10, overflowX: 'auto' }} className="noscrollbar">
          {COLS.map(([st, name, plant], stage) => {
            const qs = (quests ?? []).filter(q => q.status === st)
              .sort((a, b) => (demand.get(b.tag_id) ?? 0) - (demand.get(a.tag_id) ?? 0))
            const top = Math.max(1, ...qs.map(q => demand.get(q.tag_id) ?? 0))
            return (
              // 列＝プランターを真上から見た形（縁が素焼き・中は土）。タネのカードは土に挿した札
              <div key={st} className="planter">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}><Planter stage={stage} size={30} title={plant} /><b className="planter-name">{name}</b><span className="kpi planter-name" style={{ fontSize: 16 }}>{qs.length}</span></div>
                <div className="noscrollbar planter-soil" style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', minHeight: 0, flexGrow: 1 }}>
                  {qs.map(q => {
                    const s = last.get(q.id)
                    const d = demand.get(q.tag_id) ?? 0
                    return (
                      <Link key={q.id} href={`/admin/quests?id=${q.id}`} className="card hoverable" title="判断の足あとを見る"
                        style={{ padding: 10, color: 'var(--ink)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        <Planter stage={stage} scale={0.8 + 0.4 * (d / top)} title={`${plant}（30日に${d}回 語られた）`} />
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flexGrow: 1 }}>
                          <b style={{ overflowWrap: 'anywhere' }}>＃{q.tags?.name ?? '?'}</b>
                          {q.current_invitee && <span className="sub">{who.get(q.current_invitee)}さん</span>}
                          <span className="sub" style={{ fontSize: 11 }}>語られた {d}回{s ? ` ・ ${fmtWhen(s.created_at)}` : ''}</span>
                        </span>
                        <span className="sub" aria-hidden="true" style={{ fontSize: 16 }}>›</span>
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
