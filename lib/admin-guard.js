import 'server-only'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/supabase/server'

// 管理者画面の入口。ログイン中の本人の role をDBで確かめる（画面の表示だけで判断しない）
export async function requireAdmin() {
  const me = await currentUser()
  if (!me) redirect('/login')
  if (me.role !== 'admin') redirect('/livehub')
  return me
}
