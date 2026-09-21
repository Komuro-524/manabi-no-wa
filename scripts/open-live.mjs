// =====================================================================
//  🎙️ ライブを開く（人が押すボタンの代わり）
//
//  ★ これはエージェントではない。人の操作を代行する小道具。
//    将来 Next.js の「ライブを開く」画面と、ライブ中の音声取り込みがやることを
//    いまはここでまとめてやる。
//
//  なぜ要るか:
//    まなびのライブは 参加者がそれぞれ自分のアカウントで入る。
//    だから「どのアカウントの音声か」は 音声が発生した時点で確定している。
//    文字起こしは最初から user_id を持つ行として保存し、
//    タグ付けエージェントAには 名前を一度も見せない。
//
//  使い方:
//    node scripts/open-live.mjs docs/demo-transcripts/02-sql.txt
//    node scripts/open-live.mjs <file> --dry
//
//  止まる条件（どちらも「人が決めること」なので勝手に進めない）:
//    - 参加者行の名前が社員名簿に無い
//    - 本文に 参加者以外の名前で始まる行がある
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

const die = m => { console.error(`\n🛑 ${m}\n`); process.exit(1) }

// 空白を落とした正規化名で照合する（星野陸 = 星野 陸）
const normalize = s => String(s ?? '').normalize('NFKC').replace(/[\s　]+/g, '').toLowerCase()

const raw   = fs.readFileSync(path.resolve(ROOT, FILE), 'utf8')
const lines = raw.split(/\r?\n/)

// --- 1. ヘッダを読む ---------------------------------------------------
const title = (lines[0] ?? '').trim() || path.basename(FILE)
const theme = (lines.find(l => /^テーマ\s*[:：]/.test(l)) ?? '').replace(/^テーマ\s*[:：]\s*/, '').trim()

const rosterIdx = lines.findIndex(l => /^参加者\s*[:：]/.test(l))
if (rosterIdx < 0) die('「参加者:」の行がありません。誰がその場にいたか分からないのでライブを開けません')

const rosterNames = lines[rosterIdx]
  .replace(/^参加者\s*[:：]\s*/, '')
  .split(/[、,]/)
  .map(s => s.replace(/[（(][^）)]*[）)]/g, '').trim())
  .filter(Boolean)

console.log(`\n🎙️ ライブを開く${DRY_RUN ? '  🧪[dry: 何も書きません]' : ''}`)
console.log(`   ${title}`)
if (theme) console.log(`   テーマ: ${theme}`)
console.log(`   参加者: ${rosterNames.join(' / ')}  (${rosterNames.length}人)\n`)

// --- 2. 参加者を名簿と突き合わせる（★ここだけが名前を扱う。人の操作の代わり）---
const { data: allUsers, error: usersErr } = await db.from('users').select('id, display_name')
if (usersErr) die(`社員名簿が読めません: ${usersErr.message}`)

const byNorm = new Map(); const dupNorm = new Set()
for (const u of allUsers ?? []) {
  const k = normalize(u.display_name)
  if (byNorm.has(k)) dupNorm.add(k); else byNorm.set(k, u)
}

const roster  = new Map()      // 正規化名 → user
const unknown = []
for (const name of rosterNames) {
  const k = normalize(name)
  const hit = byNorm.get(k)
  if (!hit || dupNorm.has(k)) { unknown.push(name); continue }
  roster.set(k, hit)
  if (name !== hit.display_name) console.log(`   🔤 表記ゆれを吸収: 「${name}」→「${hit.display_name}」`)
}
if (unknown.length) {
  die(`名簿に無い参加者が ${unknown.length}人います: ${unknown.join(' / ')}\n` +
      '   ライブは開きません。社員は勝手に作らないので 人が名簿を直してください')
}

// --- 3. 本文を「アカウント付きのセグメント」に変える ---------------------
const segments = []
const outsiders = new Set()
for (let i = rosterIdx + 1; i < lines.length; i++) {
  const line = lines[i].trim()
  if (!line) continue
  const m = line.match(/^([^:：]{1,24})[:：]\s*(.*)$/)
  if (!m) {
    // 話者名が無い行は 直前の発言の続きとして足す
    if (segments.length) segments[segments.length - 1].body += '\n' + line
    continue
  }
  const [, name, body] = m
  const user = roster.get(normalize(name))
  if (!user) { outsiders.add(name.trim()); continue }
  segments.push({ seq: segments.length + 1, user_id: user.id, body: body.trim(), who: user.display_name })
}

if (outsiders.size) {
  die(`参加者以外の名前で始まる行があります: ${[...outsiders].join(' / ')}\n` +
      '   その場にいない人の発言は記録できません。人が確認してください')
}
if (!segments.length) die('発言の行が1つも見つかりませんでした')

const bySpeaker = new Map()
for (const s of segments) bySpeaker.set(s.who, (bySpeaker.get(s.who) ?? 0) + 1)
console.log(`   🎧 発言 ${segments.length}行`)
for (const [who, n] of bySpeaker) console.log(`      ${who}: ${n}行`)

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
  [...roster.values()].map(u => ({
    live_id: live.id, user_id: u.id, role: 'speaker', invited_at: now, joined_at: now,
  })),
)
if (partErr) die(`参加者を書けません: ${partErr.message}`)

const { error: segErr } = await db.from('transcript_segments').insert(
  segments.map(s => ({ live_id: live.id, user_id: s.user_id, seq: s.seq, spoken_at: now, body: s.body })),
)
if (segErr) die(`文字起こしを書けません: ${segErr.message}`)

console.log(`\n✅ ライブ #${live.id} を開きました`)
console.log(`   参加者 ${roster.size}人 / 発言 ${segments.length}行`)
console.log(`   次: node scripts/recorder.mjs --live ${live.id}\n`)
