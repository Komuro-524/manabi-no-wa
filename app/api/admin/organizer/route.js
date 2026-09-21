import 'server-only'
import { NextResponse } from 'next/server'
import { verifiedUser } from '@/lib/supabase/server'
import { organizer } from '@/lib/agents/server'
import { agentError } from '@/lib/agent-error'
export const runtime = 'nodejs'
export const maxDuration = 300
export async function POST() {
  const me = await verifiedUser()
  if (!me || me.role !== 'admin') return NextResponse.json({ error: '管理者だけが操作できます' }, { status: 403 })
  try {
    await organizer()
    return NextResponse.json({ ok: true, message: '場づくりエージェントの処理が完了しました' })
  } catch (error) { return agentError(error) }
}
