import 'server-only'
import { NextResponse } from 'next/server'
import { verifiedUser } from '@/lib/supabase/server'
import { mirror } from '@/lib/agents/server'
import { agentError } from '@/lib/agent-error'
import { readLimitedJson, validateFrames, scanMeta, InputError } from '@/lib/selfscan-input.mjs'
export const runtime = 'nodejs'
export const maxDuration = 300
export async function POST(req) {
  const me = await verifiedUser()
  if (!me) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 })
  try {
    const body = await readLimitedJson(req)
    const frames = await validateFrames(body?.frames)
    const result = await mirror(me.id, frames, scanMeta(body))
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: error.status })
    return agentError(error)
  }
}
