// =====================================================================
//  💰 OrcaRouterの確定費用と突き合わせる（F7）
//
//  各エージェントは呼び出し直後にレスポンスヘッダから「インライン額」
//  （cost_usd）を記録している。この額は本当に正しいのか、OrcaRouter側で
//  確定した額（GET /v1/generation?id=<id> の total_cost）と1本ずつ
//  突き合わせて確認する。
//
//  使い方:
//    node scripts/reconcile-costs.mjs            ← 直近50件のagent_runsを突き合わせる
//    node scripts/reconcile-costs.mjs --limit 10
//    node scripts/reconcile-costs.mjs --dry       ← 何も書かず結果を画面に出すだけ
// =====================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(ROOT, '.env.local') })

const REQUIRED = ['ORCA_KEY_RECORDER', 'ORCA_KEY_ORGANIZER', 'ORCA_KEY_MIRROR', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = REQUIRED.filter(k => !process.env[k])
if (missing.length) {
  console.error('\n🛑 .env.local に値が入っていません:\n' + missing.map(k => '   - ' + k).join('\n') + '\n')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry')
const limitIdx = process.argv.indexOf('--limit')
const LIMIT = limitIdx !== -1 ? Number(process.argv[limitIdx + 1]) : 50
const BASE_URL = process.env.ORCA_BASE_URL || 'https://api.orcarouter.ai/v1'

const KEY_BY_AGENT = {
  A: process.env.ORCA_KEY_RECORDER,
  B: process.env.ORCA_KEY_ORGANIZER,
  C: process.env.ORCA_KEY_MIRROR,
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

async function fetchConfirmedCost(requestId, apiKey) {
  const res = await fetch(`${BASE_URL}/generation?id=${encodeURIComponent(requestId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) return { error: `HTTP ${res.status}` }
  const body = await res.json().catch(() => null)
  const cost = body?.data?.total_cost ?? body?.total_cost ?? null
  if (cost === null) return { error: 'total_costが応答に無い' }
  return { cost: Number(cost) }
}

console.log(`\n💰 OrcaRouterの確定費用と突き合わせ${DRY_RUN ? '  🧪[dry]' : ''}`)
console.log(`   直近 ${LIMIT} 件の agent_runs を対象にする\n`)

const { data: runs, error } = await db.from('agent_runs')
  .select('id, agent, cost_usd, request_ids, started_at')
  .not('request_ids', 'is', null)
  .order('started_at', { ascending: false })
  .limit(LIMIT)
if (error) throw new Error(`agent_runsを読めません: ${error.message}`)

const targets = (runs ?? []).filter(r => (r.request_ids ?? []).length > 0)
console.log(`   request_ids が記録されている実行: ${targets.length}件\n`)

const rows = []
for (const run of targets) {
  const apiKey = KEY_BY_AGENT[run.agent]
  if (!apiKey) { rows.push({ ...run, confirmed: null, diff: null, note: `エージェント${run.agent}のキーが無い` }); continue }

  let confirmedSum = 0
  let missing = 0
  for (const id of run.request_ids) {
    const r = await fetchConfirmedCost(id, apiKey)
    if (r.error) { missing++; continue }
    confirmedSum += r.cost
  }

  const diff = run.cost_usd != null ? confirmedSum - Number(run.cost_usd) : null
  rows.push({ ...run, confirmed: confirmedSum, diff, note: missing ? `${missing}件取得できず` : '' })
  console.log(`   run#${run.id} [${run.agent}] インライン $${Number(run.cost_usd ?? 0).toFixed(6)} / 確定 $${confirmedSum.toFixed(6)}` +
    (missing ? `（${missing}件取得できず）` : ''))
}

// --- Markdown組み立て ------------------------------------------------
const lines = []
lines.push('# OrcaRouter 確定費用との突き合わせ（F7）')
lines.push('')
lines.push(`記録日時: ${new Date().toISOString()}`)
lines.push('')
lines.push('| run | agent | インライン額(cost_usd) | 確定額(total_cost合計) | 差 | 備考 |')
lines.push('|---|---|---|---|---|---|')
for (const r of rows) {
  const inline = r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(6)}` : '-'
  const confirmed = r.confirmed != null ? `$${r.confirmed.toFixed(6)}` : '-'
  const diff = r.diff != null ? `$${r.diff.toFixed(6)}` : '-'
  lines.push(`| #${r.id} | ${r.agent} | ${inline} | ${confirmed} | ${diff} | ${r.note ?? ''} |`)
}
lines.push('')

const totalInline = rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0)
const totalConfirmed = rows.reduce((s, r) => s + Number(r.confirmed ?? 0), 0)
lines.push(`合計: インライン $${totalInline.toFixed(6)} / 確定 $${totalConfirmed.toFixed(6)} / 差 $${(totalConfirmed - totalInline).toFixed(6)}`)

const markdown = lines.join('\n')
console.log('\n' + markdown + '\n')

if (!DRY_RUN) {
  const now = new Date()
  const ts = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  const outDir = path.join(ROOT, 'docs', 'evidence')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `${ts}-cost-reconcile.md`)
  fs.writeFileSync(outPath, markdown, 'utf8')
  console.log(`✅ 書き出した: docs/evidence/${path.basename(outPath)}\n`)
} else {
  console.log('🧪 --dry なのでファイルには書きません\n')
}
