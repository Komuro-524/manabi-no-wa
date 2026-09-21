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
  const { data: all } = await fetchAll(() => db.from('tags').select('id, name, status').order('id', { ascending: false }))

  // 直近30日に何回（何ライブ）・何人が語ったか。tag_mentions はブラウザから読めない設計 → 管理者と確かめたので service_role で数える
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const admin = supabaseAdmin()
  const { data: ments } = await fetchAll(() => admin.from('tag_mentions').select('tag_id, user_id, live_id').gte('created_at', since).order('id'))
  const acc = {}
  for (const m of ments ?? []) {
    const s = acc[m.tag_id] ??= { lives: new Set(), users: new Set() }
    s.lives.add(m.live_id); s.users.add(m.user_id)
  }
  // 「タグにしてほしい」の申請数（0020）。管理者は RLS で全員分読める。まだ migration を流していなければ空のまま
  const { data: reqs } = await fetchAll(() => db.from('tag_requests').select('tag_id').order('tag_id').order('user_id'))
  const requests = {}
  for (const r of reqs ?? []) requests[r.tag_id] = (requests[r.tag_id] ?? 0) + 1
  const stats = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, [v.lives.size, v.users.size]]))

  return (
    <>
      <Topbar me={me} title="タグ帳" sub="AIが見つけた言葉は候補止まり。正式にするのは管理者だけ" />
      <TagsBoard tags={all ?? []} stats={stats} requests={requests} meId={me.id} initialTab={sp.tab} />
    </>
  )
}
