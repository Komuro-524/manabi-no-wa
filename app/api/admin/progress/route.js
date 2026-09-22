import { NextResponse } from 'next/server'
import { verifiedUser } from '@/lib/supabase/server'
import { progressData, progressPage } from '@/lib/progress-data'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  const me = await verifiedUser()
  if (!me) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 })
  if (me.role !== 'admin') return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  try {
    return NextResponse.json(await progressData(progressPage(new URL(request.url).searchParams.get('page'))), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: '更新できませんでした。少し待って再試行します' }, { status: 503 })
  }
}
