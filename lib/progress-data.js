import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { usersByIds } from '@/lib/users-by-id'
export const PROGRESS_PAGE_SIZE = 100
export async function progressData(page = 1) {
  const db = supabaseAdmin()
  const offset = (page - 1) * PROGRESS_PAGE_SIZE
  const [q, r] = await Promise.all([
    db.from('quests').select('id, status, current_invitee, tags(name), quest_steps(created_at)', { count: 'exact' })
      .in('status', ['scouting', 'inviting', 'scheduling', 'opened', 'done'])
      .order('id', { ascending: false }).range(offset, offset + PROGRESS_PAGE_SIZE - 1)
      .order('id', { referencedTable: 'quest_steps', ascending: false }).limit(1, { referencedTable: 'quest_steps' }),
    db.from('agent_runs').select('status, started_at').eq('agent', 'B').order('id', { ascending: false }).limit(1),
  ])
  if (q.error || r.error) throw new Error('ライブのタネを取得できませんでした')
  const people = await usersByIds(db, (q.data ?? []).map(q => q.current_invitee), 'id, display_name')
  return { page, total: q.count ?? 0, quests: (q.data ?? []).map(q => ({
    id: q.id, status: q.status, tag: q.tags?.name ?? '?',
    invitee: q.current_invitee ? people.get(q.current_invitee)?.display_name ?? '?' : null,
    lastAt: q.quest_steps?.[0]?.created_at ?? null,
  })), run: r.data?.[0] ?? null }
}
export function progressPage(value) {
  const n = Number(value)
  return Number.isSafeInteger(n) && n >= 1 && n <= 10000 ? n : 1
}
