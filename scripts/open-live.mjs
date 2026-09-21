// =====================================================================
//  🎙️ ライブを開く（人が押すボタンの代わり）
//
//  ★ これはエージェントではない。人の操作を代行する小道具。
//    将来 Next.js の「ライブを開く」画面がやることを、いまはここでやる。
//
//  なぜ要るか:
//    「誰がその場にいたか」は ライブ側が知っている事実であって、
//    文字起こしから推測するものではない。
//    先に live と live_participants を確定させておき、
//    タグ付けエージェントAには その参加者の中だけを見せる。
//
//  使い方:
//    node scripts/open-live.mjs docs/demo-transcripts/02-sql.txt
//    node scripts/open-live.mjs <file> --dry
//
//  トランスクリプト先頭の「参加者:」行を読む。
//  名簿に無い名前が1人でもいたら ライブを開かずに止める（人が決めること）。
// =====================================================================

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
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

const FILE    = process.argv[2]
const DRY_RUN = process.argv.includes('--dry')
if (!FILE) {
  console.error('使い方: node scripts/open-live.mjs "文字起こしのパス" [--dry]')
  process.exit(1)
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// 空白を落とした正規化名で照合する（星野陸 = 星野 陸）
const normalize = s => String(s ?? '').replace(/[\s　]/g, '').normalize('NFKC').toLowerCase()

const raw   = fs.readFileSync(path.resolve(ROOT, FILE), 'utf8')
const lines = raw.split(/\r?\n/)

// --- 1. ヘッダから タイトル・テーマ・参加者を読む ----------------------
const title = (lines[0] ?? '').trim() || path.basename(FILE)
const theme = (lines.find(l => /^テーマ\s*[:：]/.test(l)) ?? '').replace(/^テーマ\s*[:：]\s*/, '').trim()

const rosterLine = lines.find(l => /^参加者\s*[:：]/.test(l))
if (!rosterLine) {
  console.error('\n🛑 「参加者:」の行がありません。誰がその場にいたかが分からないのでライブを開けません\n')
  process.exit(1)
}
const rosterNames = rosterLine
  .replace(/^参加者\s*[:：]\s*/, '')
  .split(/[、,]/)
  .map(s => s.replace(/[（(][^）)]*[）)]/g, '').trim())   // （経理部）を落とす
  .filter(Boolean)

console.log(`\n🎙️ ライブを開く${DRY_RUN ? '  🧪[dry: 何も書きません]' : ''}`)
console.log(`   ${title}`)
if (theme) console.log(`   テーマ: ${theme}`)
console.log(`   参加者: ${rosterNames.join(' / ')}  (${rosterNames.length}人)\n`)

// --- 2. 参加者を名簿と突き合わせる ------------------------------------
const { data: allUsers, error: usersErr } = await db.from('users').select('id, display_name')
if (usersErr) { console.error(`\n🛑 社員名簿が読めません: ${usersErr.message}\n`); process.exit(1) }

const byNorm = new Map()
const dupNorm = new Set()
for (const u of allUsers ?? []) {
  const k = normalize(u.display_name)
  if (byNorm.has(k)) dupNorm.add(k); else byNorm.set(k, u)
}

const resolved = []
const unknown  = []
for (const name of rosterNames) {
  const hit = byNorm.get(normalize(name))
  if (!hit || dupNorm.has(normalize(name))) { unknown.push(name); continue }
  resolved.push({ name, user: hit })
  if (name !== hit.display_name) console.log(`   🔤 表記ゆれを吸収: 「${name}」→「${hit.display_name}」`)
}

if (unknown.length) {
  console.error(`\n🛑 名簿に無い参加者が ${unknown.length}人います: ${unknown.join(' / ')}`)
  console.error('   ライブは開きません。社員を勝手に作らないので 人が名簿を直してください\n')
  process.exit(1)
}

// --- 3. ライブと参加者を書く ------------------------------------------
const sourceRef = 'file:' + crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16)
const { data: dup } = await db.from('lives').select('id').eq('source_ref', sourceRef).maybeSingle()
if (dup) {
  console.log(`   ⏭️ 同じ文字起こしのライブが既にあります → #${dup.id}（二重取り込み防止）\n`)
  process.exit(0)
}

if (DRY_RUN) {
  console.log('   🧪 ここで lives 1本 と live_participants ' + resolved.length + '件 を作ります\n')
  process.exit(0)
}

const now = new Date()
const { data: live, error: liveErr } = await db.from('lives').insert({
  title: theme ? `${title} — ${theme}` : title,
  status: 'ended',                 // 終わった会を取り込む前提
  started_at: now,
  ended_at: now,
  source_ref: sourceRef,
  ingest_status: 'pending',        // ★ Aが拾うのはこれ
}).select().single()
if (liveErr) { console.error(`\n🛑 ライブを作れません: ${liveErr.message}\n`); process.exit(1) }

const { error: partErr } = await db.from('live_participants').insert(
  resolved.map(r => ({
    live_id: live.id,
    user_id: r.user.id,
    role: 'speaker',               // この会は全員が音声で話している
    invited_at: now,
    joined_at: now,
  })),
)
if (partErr) { console.error(`\n🛑 参加者を書けません: ${partErr.message}\n`); process.exit(1) }

console.log(`\n✅ ライブ #${live.id} を開きました（参加者 ${resolved.length}人）`)
console.log(`   次: node scripts/recorder.mjs --live ${live.id} ${FILE}\n`)
