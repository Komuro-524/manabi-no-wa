import 'server-only'
import { NextResponse } from 'next/server'
import { organizer } from '@/lib/agents/server'
import { authorizedCron } from '@/lib/cron-auth.mjs'
import { agentError } from '@/lib/agent-error'
export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'
export async function GET(req) {
  if (!authorizedCron(req.headers.get('authorization'), process.env.CRON_SECRET)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await organizer({ trigger: 'cron', cronDay: new Date().toISOString().slice(0, 10) })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) { return agentError(error) }
}
