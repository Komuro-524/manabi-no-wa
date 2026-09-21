// =====================================================================
//  📊 証拠の自動生成
//
//  使い方:
//    node scripts/evidence.mjs                  ← docs/evidence/ に db-state を1本出す
//    node scripts/evidence.mjs --label before    ← ファイル名に印を付ける（前後比較用）
//
//  やること
//    1. 全テーブルの件数
//    2. タグの status 内訳（candidate/proposed/official/rejected/banned）
//    3. 直近の知見カード5件
//    を Markdown の表にして docs/evidence/ へ 日時つきで書き出す
// =====================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(ROOT, '.env.local') })

const REQUIRED = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = REQUIRED.filter(k => !process.env[k])
if (missing.length) {
  console.error('\n🛑 .env.local に値が入っていません:\n' + missing.map(k => '   - ' + k).join('\n') + '\n')
  process.exit(1)
}

const labelArgIdx = process.argv.indexOf('--label')
const LABEL = labelArgIdx !== -1 ? process.argv[labelArgIdx + 1] : null

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,   // ★ サーバ側。RLSを素通りする
  { auth: { persistSession: false } },
)

const TABLES = [
  'users', 'tags', 'lives', 'live_participants', 'messages',
  'knowledge_cards', 'user_tags', 'quests', 'quest_steps',
  'invitations', 'calendar_events', 'agent_runs', 'self_analysis_sessions',
  'transcript_segments', 'tag_mentions',
]

async function countTable(name) {
  const { count, error } = await db.from(name).select('*', { count: 'exact', head: true })
  if (error) return { name, count: null, error: error.message }
  return { name, count }
}

async function tagStatusBreakdown() {
  const { data, error } = await db.from('tags').select('status')
  if (error) throw new Error(`tags を読めません: ${error.message}`)
  const byStatus = new Map()
  for (const row of data) byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1)
  return byStatus
}

async function latestCards(limit = 5) {
  const { data, error } = await db
    .from('knowledge_cards')
    .select('id, headline, created_at, tag:tags(name), speaker:users(display_name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`knowledge_cards を読めません: ${error.message}`)
  return data
}

function pad2(n) { return String(n).padStart(2, '0') }
function timestamp(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
}

const now = new Date()
const ts = timestamp(now)

console.log(`\n📊 DBの状態を集計中... (${now.toLocaleString('ja-JP')})\n`)

const counts = await Promise.all(TABLES.map(countTable))
const statusMap = await tagStatusBreakdown()
const cards = await latestCards(5)

// --- Markdown組み立て ------------------------------------------------
const lines = []
lines.push(`# DBの状態${LABEL ? `（${LABEL}）` : ''}`)
lines.push('')
lines.push(`記録日時: ${now.toISOString()}（${now.toLocaleString('ja-JP')}）`)
lines.push('')
lines.push('## 全テーブルの件数')
lines.push('')
lines.push('| テーブル | 件数 |')
lines.push('|---|---|')
for (const c of counts) lines.push(`| ${c.name} | ${c.error ? `⚠️ ${c.error}` : c.count} |`)
lines.push('')

lines.push('## タグの status 内訳')
lines.push('')
lines.push('| status | 件数 |')
lines.push('|---|---|')
const STATUS_ORDER = ['official', 'proposed', 'candidate', 'rejected', 'banned']
for (const s of STATUS_ORDER) lines.push(`| ${s} | ${statusMap.get(s) ?? 0} |`)
for (const [s, n] of statusMap) if (!STATUS_ORDER.includes(s)) lines.push(`| ${s} | ${n} |`)
lines.push('')

lines.push('## 直近の知見カード（最大5件）')
lines.push('')
if (cards.length === 0) {
  lines.push('（まだ0件）')
} else {
  lines.push('| id | タグ | 見出し | 話した人 | 作成日時 |')
  lines.push('|---|---|---|---|---|')
  for (const c of cards) {
    lines.push(`| ${c.id} | ${c.tag?.name ?? '?'} | ${c.headline} | ${c.speaker?.display_name ?? '?'} | ${c.created_at} |`)
  }
}
lines.push('')

const markdown = lines.join('\n')

const outDir = path.join(ROOT, 'docs', 'evidence')
fs.mkdirSync(outDir, { recursive: true })
const fileName = `${ts}-db-state${LABEL ? `-${LABEL}` : ''}.md`
const outPath = path.join(outDir, fileName)
fs.writeFileSync(outPath, markdown, 'utf8')

console.log(markdown)
console.log(`\n✅ 書き出した: docs/evidence/${fileName}\n`)
