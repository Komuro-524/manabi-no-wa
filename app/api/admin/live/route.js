import 'server-only'
import { NextResponse } from 'next/server'
import { verifiedUser } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { recorder } from '@/lib/agents/server'
import { agentError } from '@/lib/agent-error'
export const runtime = 'nodejs'
export const maxDuration = 300

// ライブを始める／終える（管理者 か そのライブの話し手）。
// lives にはブラウザ向けの update ポリシーが無い設計なので、管理者か確かめてから service_role で書く。
// 終えたら、タグ付けエージェント（scripts/recorder.mjs と同じもの）を完了まで待つ。
// 進み具合は lives.ingest_status（pending → running → done / needs_review）で画面に出す
export async function POST(req) {
  const me = await verifiedUser()
  if (!me) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 })

  const { liveId, action } = (await req.json().catch(() => null)) ?? {}
  const id = Number(liveId)
  if (!Number.isSafeInteger(id) || id <= 0 || !['start', 'end'].includes(action)) {
    return NextResponse.json({ error: '不正な指定です' }, { status: 400 })
  }
  const db = supabaseAdmin()
  const { data: live } = await db.from('lives').select('id, status').eq('id', id).maybeSingle()
  if (!live) return NextResponse.json({ error: 'ライブがありません' }, { status: 404 })
  // 始める・終えるは 管理者 か そのライブの話し手 だけ
  if (me.role !== 'admin') {
    const { data: sp } = await db.from('live_participants').select('user_id').eq('live_id', id).eq('user_id', me.id).eq('role', 'speaker').maybeSingle()
    if (!sp) return NextResponse.json({ error: '管理者か このライブの話し手だけが操作できます' }, { status: 403 })
  }

  if (action === 'start') {
    if (live.status !== 'scheduled') return NextResponse.json({ error: '予定のライブだけ始められます' }, { status: 409 })
    const { data: changed, error } = await db.from('lives').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', id).eq('status', 'scheduled').select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!changed?.length) return NextResponse.json({ error: 'ライブの状態が変わりました' }, { status: 409 })
    return NextResponse.json({ ok: true, message: 'ライブを始めました' })
  }

  if (!['live', 'ended'].includes(live.status)) return NextResponse.json({ error: '配信中のライブだけ終えられます' }, { status: 409 })
  if (live.status === 'live') {
    const { error } = await db.from('lives').update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'live')
    if (error) return NextResponse.json({ error: 'ライブを終了できませんでした' }, { status: 500 })
  }
  try {
    const result = await recorder(id)
    return NextResponse.json({ ok: true, message: result?.skipped ? 'ライブは終了済みです。取り込み状態は画面で確認できます' : 'ライブ終了後の取り込みが完了しました', result })
  } catch (error) { return agentError(error) }
}
