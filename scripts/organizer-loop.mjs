// =====================================================================
//  🔁 場づくりエージェントを「自分で回す」（F12）
//
//  使い方:
//    node scripts/organizer-loop.mjs                 ← 5分おきに1周、最大6周で自分で止まる
//    node scripts/organizer-loop.mjs --every 1 --max 3   ← 間隔（分）と周回数を変える
//    node scripts/organizer-loop.mjs --dry           ← 各周を --dry で回す（DBに書かない）
//
//  なぜ:
//    本番は Vercel Cron で「1日1回、自分で起動」する設計（DESIGN §3.2）。
//    今回はデプロイしないので Cron が無い。その代わりに手元で間隔を縮めて自動で回し、
//    人が何も押さなくても企て（quests）が進んでいく様子を見せる。
//
//  止まる条件（★コードで保証）
//    ・最大周回数に達した（既定6）
//    ・ループ全体の費用が上限を超えた（LOOP_BUDGET_USD。既定 $0.10）
//    ・2周続けて失敗した
//    ・1周ごとの上限（ORGANIZER_BUDGET_USD）は organizer.mjs 側でそのまま効く
//
//  このファイル自身は DB にも OrcaRouter にも触らない。organizer.mjs を子プロセスで呼ぶだけ。
// =====================================================================

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(ROOT, '.env.local'), quiet: true })

const argv = process.argv.slice(2)
const argNum = (name, d) => {
  const i = argv.indexOf(name)
  const v = i >= 0 ? Number(argv[i + 1]) : NaN
  return Number.isFinite(v) && v > 0 ? v : d
}
const EVERY_MIN   = argNum('--every', 5)
const MAX_ROUNDS  = Math.min(argNum('--max', 6), 24)   // うっかり大きい数を渡しても24周で止める
const DRY_RUN     = argv.includes('--dry')
const LOOP_BUDGET = Number((process.env.LOOP_BUDGET_USD ?? '').split('#')[0]) || 0.10

const sleep = ms => new Promise(r => setTimeout(r, ms))
const now = () => new Date().toLocaleTimeString('ja-JP')

function runOnce() {
  return new Promise(resolve => {
    const args = [path.join(ROOT, 'scripts/organizer.mjs'), ...(DRY_RUN ? ['--dry'] : [])]
    const child = spawn(process.execPath, args, { cwd: ROOT })
    let out = ''
    child.stdout.on('data', d => { out += d; process.stdout.write(d) })
    child.stderr.on('data', d => { out += d; process.stderr.write(d) })
    child.on('close', code => {
      const m = out.match(/費用 \$([0-9.]+)/)
      resolve({ ok: code === 0, cost: m ? Number(m[1]) : 0 })
    })
  })
}

console.log(`\n🔁 場づくりエージェントを自動で回します`)
console.log(`   ${EVERY_MIN}分おき / 最大${MAX_ROUNDS}周 / ループ全体の上限 $${LOOP_BUDGET.toFixed(2)}${DRY_RUN ? ' / 🧪 --dry' : ''}`)
console.log(`   止めたいときは Ctrl+C\n`)

let total = 0, failStreak = 0
const log = []
for (let round = 1; round <= MAX_ROUNDS; round++) {
  console.log(`\n━━━━ ${round}周目（${now()}）━━━━`)
  const r = await runOnce()
  total += r.cost
  failStreak = r.ok ? 0 : failStreak + 1
  log.push({ round, at: now(), ok: r.ok, cost: r.cost })
  console.log(`   ↳ ${r.ok ? '✅' : '🛑'} ${round}周目 $${r.cost.toFixed(6)} / 累計 $${total.toFixed(6)}`)

  if (failStreak >= 2)      { console.log('\n🛑 2周続けて失敗したので止めます'); break }
  if (total >= LOOP_BUDGET) { console.log(`\n💰 ループ全体の上限 $${LOOP_BUDGET.toFixed(2)} に達したので止めます`); break }
  if (round === MAX_ROUNDS) { console.log(`\n🏁 最大${MAX_ROUNDS}周に達したので止めます`); break }
  console.log(`   ⏳ 次は ${EVERY_MIN}分後`)
  await sleep(EVERY_MIN * 60 * 1000)
}

console.log('\n📋 まとめ')
for (const l of log) console.log(`   ${l.round}周目 ${l.at} ${l.ok ? '✅' : '🛑'} $${l.cost.toFixed(6)}`)
console.log(`   合計 $${total.toFixed(6)}\n`)
