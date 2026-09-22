import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { usersByIds } from '@/lib/users-by-id'
export const PROGRESS_PAGE_SIZE = 100
// ライブのタネの画面と、その自動更新API（/api/admin/progress）で同じものを返す。
// 需要（直近30日に語られた回数）は DB 側の集計 admin_tag_stats（0016）の「何人が語ったか」ではなく
// 延べ回数が要るので、そのページのタネのタグだけに絞って数える
export async function progressData(page = 1) {
  const db = supabaseAdmin()
  const offset = (page - 1) * PROGRESS_PAGE_SIZE
  const [q, r] = await Promise.all([
    db.from('quests').select('id, status, current_invitee, tag_id, tags(name), quest_steps(created_at)', { count: 'exact' })
      .in('status', ['scouting', 'inviting', 'scheduling', 'opened', 'done'])
      .order('id', { ascending: false }).range(offset, offset + PROGRESS_PAGE_SIZE - 1)
      .order('id', { referencedTable: 'quest_steps', ascending: false }).limit(1, { referencedTable: 'quest_steps' }),
    db.from('agent_runs').select('status, started_at, finished_at').eq('agent', 'B').order('id', { ascending: false }).limit(1),
  ])
  if (q.error || r.error) throw new Error('ライブのタネを取得できませんでした')
  const run = r.data?.[0] ?? null
  const tagIds = [...new Set((q.data ?? []).map(x => x.tag_id))]
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const [people, m, s] = await Promise.all([
    usersByIds(db, (q.data ?? []).map(x => x.current_invitee), 'id, display_name'),
    tagIds.length ? db.from('tag_mentions').select('tag_id').in('tag_id', tagIds).gte('created_at', since).limit(10000) : { data: [] },
    // いちばん新しい周で エージェントが決めたこと（新しい順）。畑番の1行と、終わったあとの要約に使う
    run ? db.from('quest_steps').select('decision, reason, quests(tags(name))').gte('created_at', run.started_at).order('id', { ascending: false }).limit(20) : { data: [] },
  ])
  if (m.error || s.error) throw new Error('ライブのタネを取得できませんでした')
  const demand = {}
  for (const x of m.data ?? []) demand[x.tag_id] = (demand[x.tag_id] ?? 0) + 1
  return {
    page, total: q.count ?? 0, run,
    quests: (q.data ?? []).map(x => ({
      id: x.id, status: x.status, tag: x.tags?.name ?? '?', demand: demand[x.tag_id] ?? 0,
      invitee: x.current_invitee ? people.get(x.current_invitee)?.display_name ?? '?' : null,
      lastAt: x.quest_steps?.[0]?.created_at ?? null,
    })),
    runLog: (s.data ?? []).map(x => ({ decision: x.decision, reason: x.reason, tag: x.quests?.tags?.name ?? '?' })),
  }
}
export function progressPage(value) {
  const n = Number(value)
  return Number.isSafeInteger(n) && n >= 1 && n <= 10000 ? n : 1
}
