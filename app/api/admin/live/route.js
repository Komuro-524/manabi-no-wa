import 'server-only'
import { NextResponse } from 'next/server'
import { verifiedUser } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { runDetached } from '@/lib/run-script'

// ライブを始める／終える（管理者だけ）。
// lives にはブラウザ向けの update ポリシーが無い設計なので、管理者か確かめてから service_role で書く。
// 終えたら、タグ付けエージェント（scripts/recorder.mjs と同じもの）を裏で動かす。
// 進み具合は lives.ingest_status（pending → running → done / needs_review）で画面に出す
export async function POST(req) {
  const me = await verifiedUser()
  if (!me || me.role !== 'admin') return NextResponse.json({ error: '管理者だけが操作できます' }, { status: 403 })

  const { liveId, action } = await req.json()
  const id = Number(liveId)
  if (!Number.isInteger(id) || !['start', 'end'].includes(action)) {
    return NextResponse.json({ error: '不正な指定です' }, { status: 400 })
  }
  const db = supabaseAdmin()
  const { data: live } = await db.from('lives').select('id, status').eq('id', id).maybeSingle()
  if (!live) return NextResponse.json({ error: 'ライブがありません' }, { status: 404 })

  if (action === 'start') {
    if (live.status !== 'scheduled') return NextResponse.json({ error: '予定のライブだけ始められます' }, { status: 409 })
    const { error } = await db.from('lives').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, message: 'ライブを始めました' })
  }

  if (live.status !== 'live') return NextResponse.json({ error: '配信中のライブだけ終えられます' }, { status: 409 })
  const { error } = await db.from('lives').update({ status: 'ended', ended_at: new Date().toISOString(), ingest_status: 'pending' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  runDetached('recorder.mjs', ['--live', String(id)])
  return NextResponse.json({ ok: true, message: 'ライブを終えました。タグ付けエージェントが取り込みを始めます' })
}
