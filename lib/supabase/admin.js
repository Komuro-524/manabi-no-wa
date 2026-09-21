import 'server-only'
// ★ service_role（RLS を素通りする鍵）。ルール4: このファイルはサーバーでしか読み込めない。
//   使ってよいのは「呼び出した人が管理者か」を先に確かめた処理と、
//   画面に出してよいと決めた最小限の情報（例: 予約済みライブの話し手）だけ。
import { createClient } from '@supabase/supabase-js'

export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}
