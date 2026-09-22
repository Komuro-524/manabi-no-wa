import Link from '@/components/Link'
import { usersByIds } from '@/lib/users-by-id'
import { requireAdmin } from '@/lib/admin-guard'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'
import { Icon } from '@/components/icons'
import { fetchAll } from '@/lib/fetch-all.mjs'
import SeedTrail from './SeedTrail'

// ライブのタネの足あと（DB上は quests / quest_steps）。場づくりエージェントの判断を時系列で。
// ★ 重かった原因: タネを選ぶたびにサーバーへ行き、一覧ごと読み直していた。
//   いまは 一覧と足あとを最初に1回だけ読み、選ぶのはブラウザの中だけ（押した瞬間に切り替わる）
export default async function SeedDetail({ searchParams }) {
  const sp = await searchParams
  const me = await requireAdmin()
  const db = supabaseAdmin()
  const { data: quests } = await db.from('quests').select('id, status, current_invitee, live_id, tags(name)').order('id', { ascending: false }).limit(300)
  const ids = (quests ?? []).map(q => q.id)
  const [people, { data: steps }] = await Promise.all([
    usersByIds(db, (quests ?? []).map(q => q.current_invitee), 'id, display_name'),
    ids.length ? fetchAll(() => db.from('quest_steps').select('id, quest_id, kind, decision, reason, created_at').in('quest_id', ids).order('id'), { max: 20000 }) : { data: [] },
  ])
  const who = Object.fromEntries([...people.values()].map(u => [u.id, u.display_name]))
  const byQuest = {}
  for (const s of steps ?? []) (byQuest[s.quest_id] ??= []).push({ id: s.id, kind: s.kind, decision: s.decision, reason: s.reason, at: s.created_at })
  const list = (quests ?? []).map(q => ({ id: q.id, status: q.status, tag: q.tags?.name ?? '?', invitee: who[q.current_invitee] ?? null, liveId: q.live_id }))

  return (
    <>
      <Topbar me={me} title="タネの足あと" sub="場づくりエージェントが、なぜそう決めたか">
        <Link className="btn btn-s" href="/admin/progress"><Icon name="back" size={14} /> ライブのタネへ</Link>
      </Topbar>
      <SeedTrail quests={list} steps={byQuest} initialId={sp.id ? Number(sp.id) : null} />
    </>
  )
}
