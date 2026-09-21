import 'server-only'
// サーバー（Server Component / Route Handler）用。
// ★ ここも anon キー＋ログインした本人のクッキー。service_role は使わない → RLS がそのまま効く
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

export async function supabaseServer() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: list => {
          try { list.forEach(({ name, value, options }) => store.set(name, value, options)) }
          catch { /* Server Component からは書けない。middleware が更新するので無視してよい */ }
        },
      },
    },
  )
}

// ログイン中の本人（users の行）。未ログインなら null
// ★ 速さのため、ふつうの画面では getSession()（クッキーを読むだけ・通信なし）を使う。
//   本物かどうかは middleware が毎回 getUser() で確かめてから通しているし、
//   データはDB側のRLSがトークンを検証するので、ここで偽っても他人のデータは読めない。
//   管理者の判定など「権限を決める」ところは verifiedUser()（getUser で認証サーバーに確かめる）を使う
async function loadMe(verify) {
  const db = await supabaseServer()
  let uid = null
  if (verify) {
    const { data: { user } } = await db.auth.getUser()
    uid = user?.id ?? null
  } else {
    const { data: { session } } = await db.auth.getSession()
    uid = session?.user?.id ?? null
  }
  if (!uid) return null
  const { data: me } = await db.from('users').select('id, display_name, department, role').eq('id', uid).maybeSingle()
  return me ?? null
}
// cache: 同じリクエストの中で layout とページが両方呼んでも1回で済ませる
export const currentUser = cache(() => loadMe(false))
export const verifiedUser = cache(() => loadMe(true))
