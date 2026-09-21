import 'server-only'
import { NextResponse } from 'next/server'
import { verifiedUser } from '@/lib/supabase/server'
import { runScript } from '@/lib/run-script'

// 自己分析。ブラウザで本人が選んだ画面の静止画を受け取り、自己分析エージェント（scripts/mirror.mjs と同じもの）に渡す。
// ★ ルール12: 画像は保存しない。ファイルにもDBにも書かず、標準入力でそのまま渡して、処理が終われば消える
// ★ 誰の分析かはリクエストの中身ではなく、ログイン中の本人（認証サーバーで確かめた id）で決める
// ★ 画面に返すのは「なぜこのタグが候補になったか」の要約だけ（モデル名や費用などの作業ログは返さない）
export async function POST(req) {
  const me = await verifiedUser()
  if (!me) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const frames = Array.isArray(body?.frames) ? body.frames.filter(f => typeof f === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(f)) : []
  if (frames.length < 2) return NextResponse.json({ error: '静止画が2枚以上必要です（同じものが何枚に映ったかで判断するため）' }, { status: 400 })
  if (frames.length > 30) return NextResponse.json({ error: '静止画は30枚までです' }, { status: 400 })

  const input = JSON.stringify({
    frames,
    started_at: body.started_at, ends_at: body.ends_at,
    granularity: body.granularity === 'screen' ? 'screen' : 'window',
  })
  const r = await runScript('mirror.mjs', ['--user', me.id, '--stdin'], 170_000, input)
  const line = r.out.split('\n').find(l => l.startsWith('@@RESULT@@'))
  let result = null
  try { result = line ? JSON.parse(line.slice('@@RESULT@@'.length)) : null } catch {}
  if (!r.ok || !result) return NextResponse.json({ error: '分析の途中で止まりました。もう一度試してください' }, { status: 500 })
  return NextResponse.json({ ok: true, result })
}
