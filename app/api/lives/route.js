import 'server-only'
import { NextResponse } from 'next/server'
import { verifiedUser, supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 社員が自分で配信予定を作る。lives にはブラウザ向けの insert ポリシーが無い設計なので、
// ★ 認証サーバーで確かめた本人として、サーバー側で作る。作った人は話し手として参加者に入る
export async function POST(req) {
  const me = await verifiedUser()
  if (!me) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const title = String(body.title ?? '').trim()
  const tagId = body.tagId ? Number(body.tagId) : null
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

  const admin = supabaseAdmin()
  const end = new Date(start.getTime() + minutes * 60 * 1000)
  const { data: live, error } = await admin.from('lives').insert({
    title, topic_tag_id: tagId, status: 'scheduled',
    scheduled_start: start.toISOString(), scheduled_end: end.toISOString(),
    source_ref: `user-${me.id}-${Date.now()}`, ingest_status: 'pending',
  }).select('id').single()
  if (error) return NextResponse.json({ error: `作れませんでした: ${error.message}` }, { status: 500 })
  const { error: pErr } = await admin.from('live_participants').insert({ live_id: live.id, user_id: me.id, role: 'speaker', invited_at: new Date().toISOString() })
  if (pErr) return NextResponse.json({ error: `参加者に入れられませんでした: ${pErr.message}` }, { status: 500 })
  return NextResponse.json({ ok: true, id: live.id })
}
