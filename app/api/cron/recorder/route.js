import 'server-only'
import { NextResponse } from 'next/server'
import { recorder } from '@/lib/agents/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authorizedCron } from '@/lib/cron-auth.mjs'
import { agentError } from '@/lib/agent-error'
export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'
export async function GET(req) {
  if (!authorizedCron(req.headers.get('authorization'), process.env.CRON_SECRET)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    // One job per invocation keeps the entire request inside the function deadline.
    const { data, error } = await supabaseAdmin().from('lives').select('id').eq('status', 'ended')
      .or(`ingest_status.eq.pending,and(ingest_status.eq.running,ingest_lease_until.lt.${new Date().toISOString()})`)
      .order('id').limit(1)
    if (error) throw error
    const result = data?.length ? await recorder(data[0].id) : { skipped: true }
    return NextResponse.json({ ok: true, ...result })
  } catch (error) { return agentError(error) }
}
