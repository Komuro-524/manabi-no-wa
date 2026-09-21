// =====================================================================
//  🎙️ ライブを開く（ライブ本体の代わり）
//
//  ★ これはエージェントではない。
//    将来 Next.js のライブ画面がやること（参加者の確定と音声の取り込み）を
//    いまはここでまとめてやる。
//
//  ★ このスクリプトは名前を一切扱わない。
//    まなびのライブは 参加者がそれぞれ自分のアカウントで入るので、
//    音声は発生した時点で「どのアカウントのものか」が確定している。
//    デモのトランスクリプトもそれに合わせて user_id で書いてある:
//
//      参加者: <user_id>, <user_id>, ...
//      <user_id>: 発言
//
//  使い方:
//    node scripts/open-live.mjs docs/demo-transcripts/02-sql.txt
//    node scripts/open-live.mjs <file> --dry
//
//  止まる条件:
//    - 参加者に 社員として存在しない user_id がある
//    - 参加者以外の user_id の発言がある
//      ★ ここで止めなくても DB が止める。
//        transcript_segments.(live_id, user_id) は live_participants への
//        複合外部キーなので、その場にいない人の発言は制約として作れない。
//        この事前チェックは 分かりやすいメッセージを出すためだけにある。
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

const die  = m => { console.error(`\n🛑 ${m}\n`); process.exit(1) }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const raw   = fs.readFileSync(path.resolve(ROOT, FILE), 'utf8')
const lines = raw.split(/\r?\n/)

// --- 1. ヘッダを読む ---------------------------------------------------
const title = (lines[0] ?? '').trim() || path.basename(FILE)
const theme = (lines.find(l => /^テーマ\s*[:：]/.test(l)) ?? '').replace(/^テーマ\s*[:：]\s*/, '').trim()

const rosterIdx = lines.findIndex(l => /^参加者\s*[:：]/.test(l))
if (rosterIdx < 0) die('「参加者:」の行がありません。誰がその場にいたか分からないのでライブを開けません')

const rosterIds = lines[rosterIdx].replace(/^参加者\s*[:：]\s*/, '').split(/[、,\s]+/).filter(Boolean)
const badIds = rosterIds.filter(id => !UUID.test(id))
if (badIds.length) die(`参加者に user_id ではないものがあります: ${badIds.join(' / ')}`)

// --- 2. 参加者が社員として存在するか（★ID で引く。名前では探さない）-------
const { data: found, error: usersErr } = await db.from('users').select('id, display_name').in('id', rosterIds)
if (usersErr) die(`社員名簿が読めません: ${usersErr.message}`)
const byId = new Map((found ?? []).map(u => [u.id, u]))
const ghosts = rosterIds.filter(id => !byId.has(id))
if (ghosts.length) die(`社員として存在しない user_id が参加者にいます: ${ghosts.join(' / ')}\n   社員は勝手に作りません`)

console.log(`\n🎙️ ライブを開く${DRY_RUN ? '  🧪[dry: 何も書きません]' : ''}`)
console.log(`   ${title}`)
if (theme) console.log(`   テーマ: ${theme}`)
// 表示名は人間が読むためだけに出す。識別には使っていない
console.log(`   参加者: ${rosterIds.map(id => byId.get(id).display_name).join(' / ')}  (${rosterIds.length}人)\n`)

// --- 3. 本文を読む -----------------------------------------------------
const roster = new Set(rosterIds)
const segments = []
const outsiders = new Set()
for (let i = rosterIdx + 1; i < lines.length; i++) {
  const line = lines[i].trim()
  if (!line) continue
  const m = line.match(/^([0-9a-f-]{36})\s*[:：]\s*(.*)$/i)
  if (!m) {
    if (segments.length) segments[segments.length - 1].body += '\n' + line   // 前の発言の続き
    continue
  }
  const [, uid, body] = m
  if (!roster.has(uid)) { outsiders.add(uid); continue }
  segments.push({ seq: segments.length + 1, user_id: uid, body: body.trim() })
}

if (outsiders.size) {
  die(`参加者以外の発言があります: ${[...outsiders].join(' / ')}\n` +
      '   その場にいない人の発言は記録できません（DBの外部キーでも拒否されます）')
}
if (!segments.length) die('発言の行が1つも見つかりませんでした')

const count = new Map()
for (const s of segments) count.set(s.user_id, (count.get(s.user_id) ?? 0) + 1)
console.log(`   🎧 発言 ${segments.length}行`)
for (const [uid, n] of count) console.log(`      ${byId.get(uid).display_name}: ${n}行`)

// --- 4. 書く ----------------------------------------------------------
const sourceRef = 'file:' + crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16)
const { data: dup } = await db.from('lives').select('id').eq('source_ref', sourceRef).maybeSingle()
if (dup) {
  console.log(`\n   ⏭️ 同じ文字起こしのライブが既にあります → #${dup.id}（二重取り込み防止）\n`)
  process.exit(0)
}
if (DRY_RUN) {
  console.log(`\n   🧪 lives 1本 / live_participants ${roster.size}件 / transcript_segments ${segments.length}件 を作ります\n`)
  process.exit(0)
}

const now = new Date()
const { data: live, error: liveErr } = await db.from('lives').insert({
  title: theme ? `${title} — ${theme}` : title,
  status: 'ended',
  started_at: now, ended_at: now,
  source_ref: sourceRef,
  ingest_status: 'pending',        // ★ Aが拾うのはこれ
}).select().single()
if (liveErr) die(`ライブを作れません: ${liveErr.message}`)

const { error: partErr } = await db.from('live_participants').insert(
  rosterIds.map(uid => ({ live_id: live.id, user_id: uid, role: 'speaker', invited_at: now, joined_at: now })),
)
if (partErr) die(`参加者を書けません: ${partErr.message}`)

const { error: segErr } = await db.from('transcript_segments').insert(
  segments.map(s => ({ live_id: live.id, user_id: s.user_id, seq: s.seq, spoken_at: now, body: s.body })),
)
if (segErr) die(`文字起こしを書けません: ${segErr.message}`)

console.log(`\n✅ ライブ #${live.id} を開きました`)
console.log(`   参加者 ${roster.size}人 / 発言 ${segments.length}行`)
console.log(`   次: node scripts/recorder.mjs --live ${live.id}\n`)
