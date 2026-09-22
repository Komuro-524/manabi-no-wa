import { requireAdmin } from '@/lib/admin-guard'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'
import TagsBoard from './TagsBoard'
import { fetchAll } from '@/lib/fetch-all.mjs'

// タグ辞書。タグそのものは管理者本人のセッションで読む（RLS: 正式以外は管理者だけ）。
// ★ タブの切り替えはブラウザの中だけで行う（毎回サーバーに取りに行かない＝軽い）
export default async function AdminTags({ searchParams }) {
  const sp = await searchParams
  const me = await requireAdmin()
  const db = await supabaseServer()
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const admin = supabaseAdmin()
  const [tagResult, statResult] = await Promise.all([
    fetchAll(() => db.from('tags').select('id, name, status').order('id', { ascending: false })),
    admin.rpc('admin_tag_stats', { p_since: since }),
  ])
  if (tagResult.error || statResult.error) throw new Error('タグ辞書を取得できませんでした')
  const all = tagResult.data
  const stats = Object.fromEntries((statResult.data ?? []).map(s => [s.tag_id, [s.lives, s.users]]))

  return (
    <>
      <Topbar me={me} title="タグ辞書" sub="AIが見つけた言葉は候補止まり。正式にするのは管理者だけ" />
      <TagsBoard tags={all ?? []} stats={stats} meId={me.id} initialTab={sp.tab} />
    </>
  )
}
