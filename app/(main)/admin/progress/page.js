import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-guard'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'
import AdminRunButton from '@/components/AdminRunButton'
import AutoRefresh from '@/components/AutoRefresh'
import StatusBar from '@/components/StatusBar'
import { fmtWhen } from '@/lib/format'

const COLS = [
  ['scouting', '様子見', '興味のある人が増えるのを待っている'],
  ['inviting', '打診中', '話し手の返事を待っている'],
  ['scheduling', '日程調整中', '空きを見て枠を決めている'],
  ['opened', 'ライブ予約済み', '開催を待っている'],
  ['done', '終わった', 'ライブが開かれた'],
]
const KIND = { judge: '判断', invite: '打診', schedule: '日程', open: '予約', nudge: '呼び水', giveup: '断念', remind: '催促' }

// 企ての進み具合。場づくりエージェントが同時に抱えている企てを、段階ごとに並べて見せる。
// quests / quest_steps / agent_runs はブラウザから読めない設計 → 管理者と確かめてから service_role で読む
export default async function AdminProgress() {
  const me = await requireAdmin()
  const db = supabaseAdmin()
  const [{ data: quests }, { data: steps }, { data: users }, { data: runs }] = await Promise.all([
    db.from('quests').select('id, status, current_invitee, tried_count, live_id, next_action_at, reevaluate_at, tags(name)').not('status', 'in', '(skipped,abandoned)').order('id', { ascending: false }),
    db.from('quest_steps').select('id, quest_id, kind, decision, reason, created_at').order('id', { ascending: false }).limit(200),
    db.from('users').select('id, display_name'),
    db.from('agent_runs').select('id, status, started_at, finished_at, cost_usd').eq('agent', 'B').order('id', { ascending: false }).limit(1),
  ])
  const who = new Map((users ?? []).map(u => [u.id, u.display_name]))
  const last = new Map()
  for (const s of steps ?? []) if (!last.has(s.quest_id)) last.set(s.quest_id, s)
  const run = runs?.[0]
  const running = run?.status === 'running' && Date.now() - new Date(run.started_at).getTime() < 10 * 60 * 1000
  const doneSince = Date.now() - 14 * 24 * 3600 * 1000

  return (
    <>
      <Topbar me={me} title="企ての進み具合" sub="場づくりエージェントがいま抱えている企てを、段階ごとに並べています" />
      <AutoRefresh active every={running ? 3000 : 10000} />
      <div className="body">
        {running
          ? <StatusBar spinning title="場づくりエージェントが1周動いています" text={`${fmtWhen(run.started_at)} に開始。企てを1つずつ見て、次の一手（様子見・打診・日程・予約）を決めています`} />
          : <StatusBar tone="info" title="場づくりエージェントは待機中です" text={run ? `前回の周: ${fmtWhen(run.started_at)}（${run.status === 'succeeded' ? '成功' : run.status === 'failed' ? '失敗' : '途中'}・$${Number(run.cost_usd ?? 0).toFixed(6)}）。本番は1日1回自動で起動する設計` : 'まだ動いたことがありません'}>
              <AdminRunButton url="/api/admin/organizer" label="いま1周動かす" />
            </StatusBar>}

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS.length}, minmax(200px, 1fr))`, gap: 10, alignItems: 'start', overflowX: 'auto' }}>
          {COLS.map(([st, name, desc]) => {
            const qs = (quests ?? []).filter(q => q.status === st && (st !== 'done' || (last.get(q.id) && new Date(last.get(q.id).created_at).getTime() > doneSince)))
            return (
              <div key={st} style={{ background: 'var(--bar)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <b>{name}</b><span className="kpi" style={{ fontSize: 16 }}>{qs.length}</span>
                </div>
                <span className="sub" style={{ fontSize: 11 }}>{desc}</span>
                {qs.map(q => {
                  const s = last.get(q.id)
                  return (
                    <Link key={q.id} href={`/admin/quests?id=${q.id}`} className="card" style={{ padding: 10, color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between' }}><b>＃{q.tags?.name ?? '?'}</b><span className="mono sub">#{q.id}</span></span>
                      {q.current_invitee && <span className="sub">話し手候補: {who.get(q.current_invitee)}{q.tried_count > 1 ? `（${q.tried_count}人目）` : ''}</span>}
                      {s && <span className="sub" style={{ fontSize: 11, lineHeight: 1.5 }}>{KIND[s.kind] ?? s.kind}：{s.reason.length > 46 ? s.reason.slice(0, 46) + '…' : s.reason}</span>}
                      {(q.next_action_at ?? q.reevaluate_at) && <span className="sub" style={{ fontSize: 10 }}>次に動く: {fmtWhen(q.next_action_at ?? q.reevaluate_at)}</span>}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="card sh" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="ttl">最近の判断（新しい順）</div>
          {(steps ?? []).slice(0, 15).map(s => (
            <div key={s.id} style={{ display: 'flex', gap: 10, fontSize: 13, alignItems: 'baseline' }}>
              <span className="sub" style={{ width: 110, flexShrink: 0 }}>{fmtWhen(s.created_at)}</span>
              <span className="chip" style={{ background: 'var(--sand)', color: 'var(--ink2)', flexShrink: 0 }}>{KIND[s.kind] ?? s.kind}</span>
              <Link href={`/admin/quests?id=${s.quest_id}`} className="mono" style={{ flexShrink: 0 }}>#{s.quest_id}</Link>
              <span>{s.reason}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
