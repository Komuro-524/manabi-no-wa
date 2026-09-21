import 'server-only'
import { NextResponse } from 'next/server'
import { verifiedUser } from '@/lib/supabase/server'
import { runScript } from '@/lib/run-script'

// 場づくりエージェントを1周動かす（管理者だけ）。scripts/organizer.mjs と同じもの。停止条件と予算上限はそちらで効く
export async function POST() {
  const me = await verifiedUser()
  if (!me || me.role !== 'admin') return NextResponse.json({ error: '管理者だけが操作できます' }, { status: 403 })
  const r = await runScript('organizer.mjs')
  return NextResponse.json({ ok: r.ok, log: r.out })
}
