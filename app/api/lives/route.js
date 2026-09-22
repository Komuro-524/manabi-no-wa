import 'server-only'
import { NextResponse } from 'next/server'
import { verifiedUser, supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 社員が自分で配信予定を作る。lives にはブラウザ向けの insert ポリシーが無い設計なので、
// ★ 認証サーバーで確かめた本人として、サーバー側で作る。作った人は話し手として参加者に入る
export async function POST(req) {
  const me = await verifiedUser()
  if (!me) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 })
  const body = (await req.json().catch(() => null)) ?? {}
  const title = String(body.title ?? '').trim()
  const tagId = body.tagId ? Number(body.tagId) : null
  if (tagId !== null && (!Number.isSafeInteger(tagId) || tagId <= 0)) return NextResponse.json({ error: 'タグの指定が不正です' }, { status: 400 })
  const start = new Date(body.start)
  const minutes = Number(body.minutes) || 60

  if (title.length < 2 || title.length > 60) return NextResponse.json({ error: '配信タイトルは2〜60文字で入れてください' }, { status: 400 })
  if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 5 * 60 * 1000) return NextResponse.json({ error: '開始日時はこれから先の日時にしてください' }, { status: 400 })
  if (![30, 60, 90, 120].includes(minutes)) return NextResponse.json({ error: '長さの指定が正しくありません' }, { status: 400 })

  // タグは正式なものだけ（本人のセッションで読めるか＝RLSで正式か確かめる）
  if (tagId) {
    const db = await supabaseServer()
    const { data: tag } = await db.from('tags').select('id').eq('id', tagId).eq('status', 'official').maybeSingle()
    if (!tag) return NextResponse.json({ error: 'そのタグは選べません' }, { status: 400 })
  }

  const { data: id, error } = await supabaseAdmin().rpc('create_live_with_speaker', {
    p_user: me.id, p_title: title, p_tag: tagId, p_start: start.toISOString(), p_minutes: minutes,
  })
  if (error) {
    // Log only a code, never DB details, user input or credentials.
    console.error('[create-live]', error.code ?? 'unknown')
    const missing = ['PGRST202', '42883'].includes(error.code)
    return NextResponse.json({ error: missing
      ? '配信予定の作成に必要なDB更新が未適用です。管理者にご連絡ください'
      : '配信予定を作れませんでした', code: missing ? 'DB_MIGRATION_REQUIRED' : 'CREATE_LIVE_FAILED' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id })
}
