import 'server-only'
import { NextResponse } from 'next/server'
import { verifiedUser, supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// ブラウザの音声入力で確定した一文を、文字起こし（transcript_segments）に1行足す。
// ★ transcript_segments にはブラウザ向けの insert ポリシーが無い（勝手に他人の発言を作らせない）。
//   だからサーバーで「認証サーバーに確かめた本人」「配信中」「このライブの話し手」を確かめてから、
//   user_id は必ず本人のものにして service_role で書く。ブラウザから user_id は受け取らない
export async function POST(req, { params }) {
  const me = await verifiedUser()
  if (!me) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 })
  const { id } = await params
  const liveId = Number(id)
  if (!Number.isInteger(liveId) || liveId <= 0) return NextResponse.json({ error: 'ライブの指定が正しくありません' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const text = String(body.text ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return NextResponse.json({ error: '空の発言は送れません' }, { status: 400 })
  if (text.length > 500) return NextResponse.json({ error: '一度に送れるのは500文字までです' }, { status: 400 })

  // 本人のセッションで読む（RLS）→ 参加していないライブはそもそも読めない
  const db = await supabaseServer()
  const [{ data: live }, { data: part }] = await Promise.all([
    db.from('lives').select('id, status').eq('id', liveId).maybeSingle(),
    db.from('live_participants').select('role').eq('live_id', liveId).eq('user_id', me.id).maybeSingle(),
  ])
  if (!live) return NextResponse.json({ error: 'ライブが見つかりません' }, { status: 404 })
  if (live.status !== 'live') return NextResponse.json({ error: '配信中のライブだけ話せます' }, { status: 409 })
  if (part?.role !== 'speaker') return NextResponse.json({ error: '話し手だけがマイクで話せます' }, { status: 403 })

  // seq はライブごとに一意。同時に確定しても重ならないよう、ぶつかったら数え直す
  const admin = supabaseAdmin()
  for (let i = 0; i < 5; i++) {
    const { data: last } = await admin.from('transcript_segments').select('seq')
      .eq('live_id', liveId).order('seq', { ascending: false }).limit(1)
    const seq = (last?.[0]?.seq ?? 0) + 1
    const { error } = await admin.from('transcript_segments')
      .insert({ live_id: liveId, user_id: me.id, seq, spoken_at: new Date().toISOString(), body: text })
    if (!error) return NextResponse.json({ ok: true, seq })
    if (error.code !== '23505') return NextResponse.json({ error: '記録できませんでした' }, { status: 500 })
  }
  return NextResponse.json({ error: '混み合っています。もう一度話してください' }, { status: 503 })
}
