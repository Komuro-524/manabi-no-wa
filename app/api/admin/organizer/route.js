import 'server-only'
import { NextResponse } from 'next/server'
import { verifiedUser } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { runDetached } from '@/lib/run-script'

// 場づくりエージェントを1周動かす（管理者だけ）。scripts/organizer.mjs と同じもの。停止条件と予算上限はそちらで効く。
// 裏で動かし、進み具合は agent_runs と quests / quest_steps で「ライブのタネ」画面に出す
export async function POST() {
  const me = await verifiedUser()
  if (!me || me.role !== 'admin') return NextResponse.json({ error: '管理者だけが操作できます' }, { status: 403 })
  // 二重起動を防ぐ: 直近10分に動き始めて まだ終わっていない周があれば起動しない
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: running } = await supabaseAdmin().from('agent_runs').select('id').eq('agent', 'B').eq('status', 'running').gte('started_at', since).limit(1)
  if (running?.length) return NextResponse.json({ error: 'いま1周動いています。終わるまで待ってください' }, { status: 409 })
  runDetached('organizer.mjs')
  return NextResponse.json({ ok: true, message: '場づくりエージェントが動き始めました。進み具合はこの画面に出ます' })
}
