import 'server-only'
// サーバー（Server Component / Route Handler）用。
// ★ ここも anon キー＋ログインした本人のクッキー。service_role は使わない → RLS がそのまま効く
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
export async function currentUser() {
  const db = await supabaseServer()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const { data: me } = await db.from('users').select('id, display_name, department, role').eq('id', user.id).maybeSingle()
  return me ?? null
}
