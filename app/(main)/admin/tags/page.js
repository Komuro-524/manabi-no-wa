import { requireAdmin } from '@/lib/admin-guard'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'
import TagsBoard from './TagsBoard'

// タグ辞書。タグそのものは管理者本人のセッションで読む（RLS: 正式以外は管理者だけ）。
// ★ タブの切り替えはブラウザの中だけで行う（毎回サーバーに取りに行かない＝軽い）
export default async function AdminTags({ searchParams }) {
  const sp = await searchParams
  const me = await requireAdmin()
  const db = await supabaseServer()
  const { data: all } = await db.from('tags').select('id, name, status').order('id', { ascending: false })

  // 直近30日に何回（何ライブ）・何人が語ったか。tag_mentions はブラウザから読めない設計 → 管理者と確かめたので service_role で数える
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { data: ments } = await supabaseAdmin().from('tag_mentions').select('tag_id, user_id, live_id').gte('created_at', since)
  const acc = {}
  for (const m of ments ?? []) {
    const s = acc[m.tag_id] ??= { lives: new Set(), users: new Set() }
    s.lives.add(m.live_id); s.users.add(m.user_id)
  }
  const stats = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, [v.lives.size, v.users.size]]))

  return (
    <>
      <Topbar me={me} title="タグ辞書" sub="AIが見つけた言葉は候補止まり。正式にするのは管理者だけ" />
      <TagsBoard tags={all ?? []} stats={stats} meId={me.id} initialTab={sp.tab} />
    </>
  )
}
