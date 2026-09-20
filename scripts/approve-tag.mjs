// =====================================================================
//  🏷️ タグ格上げの承認（管理者の操作を代行する小道具）
//
//  DESIGN.md §4「人が介在する場所は3つだけ」のうちの1つ。
//  AIは official にできない（proposed まで）。ここは人間の操作。
//  このスクリプト自体はLLMを呼ばない。ただの管理者用SQL操作。
//
//  使い方:
//    node scripts/approve-tag.mjs "タグ名" [--note "承認メモ"]
//    node scripts/approve-tag.mjs "タグ名" --dry     ← 何も書かずに状態だけ見る
// =====================================================================

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

const TAG_NAME = process.argv[2]
const DRY_RUN = process.argv.includes('--dry')
const noteIdx = process.argv.indexOf('--note')
const NOTE = noteIdx !== -1 ? process.argv[noteIdx + 1] : '管理者が承認（デモ）'

if (!TAG_NAME) {
  console.error('使い方: node scripts/approve-tag.mjs "タグ名" [--note "メモ"] [--dry]')
  process.exit(1)
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data: tag, error } = await db.from('tags').select('*').eq('name', TAG_NAME).maybeSingle()
if (error) throw new Error(`タグを読めません: ${error.message}`)
if (!tag) { console.error(`🛑 タグ「${TAG_NAME}」は辞書にありません`); process.exit(1) }

console.log(`\n🏷️ 「${tag.name}」 現在の status: ${tag.status}`)

if (!['candidate', 'proposed'].includes(tag.status)) {
  console.log(`   すでに ${tag.status} なので何もしません（official/rejected/banned は対象外）\n`)
  process.exit(0)
}

if (DRY_RUN) {
  console.log(`   🧪 --dry なので official には昇格させません\n`)
  process.exit(0)
}

const { data: updated, error: updErr } = await db
  .from('tags')
  .update({
    status: 'official',
    promoted_at: new Date(),
    reviewed_at: new Date(),
    review_note: NOTE,
  })
  .eq('id', tag.id)
  .eq('status', tag.status)          // ★ 楽観ロック。承認したときの状態から動いていなければ
  .select()
  .single()

if (updErr) throw new Error(`昇格できません: ${updErr.message}`)

console.log(`   ✅ official に昇格した（${tag.status} → official）`)
console.log(`   メモ: ${NOTE}\n`)
console.log(JSON.stringify(updated, null, 2))
