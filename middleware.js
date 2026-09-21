// ログインのクッキーを毎回更新し、未ログインならログイン画面へ送る
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request) {
  // Cron routes authenticate with CRON_SECRET; never redirect these paths to login.
  if (['/api/cron/organizer', '/api/cron/recorder'].includes(request.nextUrl.pathname)) return NextResponse.next({ request })
  let response = NextResponse.next({ request })
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: list => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )
  // ★ 速さのため getSession（期限切れならここでトークンを更新する。通信は更新のときだけ）。
  //   本物かどうかは、データを読むときにDBのRLSがトークンを検証する。
  //   管理者の判定など権限を決めるところは、各画面・APIで getUser（認証サーバーに確認）を使う
  const { data: { session } } = await db.auth.getSession()
  const user = session?.user ?? null
  const isLogin = request.nextUrl.pathname.startsWith('/login')
  if (!user && !isLogin) {
    const url = request.nextUrl.clone(); url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)'],
}
