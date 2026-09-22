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
  // 直近30日に何回（何ライブ）・何人が語ったか。集計はDB側（admin_tag_stats: 0016）。tag_mentions の生の行は画面に出さない
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const admin = supabaseAdmin()
  const [tagResult, statResult] = await Promise.all([
    fetchAll(() => db.from('tags').select('id, name, status').order('id', { ascending: false })),
    admin.rpc('admin_tag_stats', { p_since: since }),
  ])
  if (tagResult.error || statResult.error) throw new Error('タグ帳を取得できませんでした')
  const all = tagResult.data
  // 「タグにしてほしい」の申請数（0020）。管理者は RLS で全員分読める。まだ migration を流していなければ空のまま
  const { data: reqs } = await fetchAll(() => db.from('tag_requests').select('tag_id').order('tag_id').order('user_id'))
  const requests = {}
  for (const r of reqs ?? []) requests[r.tag_id] = (requests[r.tag_id] ?? 0) + 1
  const stats = Object.fromEntries((statResult.data ?? []).map(x => [x.tag_id, [Number(x.lives), Number(x.users)]]))

  return (
    <>
      <Topbar me={me} title="タグ帳" sub="AIが見つけた言葉は候補止まり。正式にするのは管理者だけ" />
      <TagsBoard tags={all ?? []} stats={stats} requests={requests} meId={me.id} initialTab={sp.tab} />
    </>
  )
}
