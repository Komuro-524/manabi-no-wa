// =====================================================================
//  ✉️ 架空社員として打診に返事する（デモ用。画面ができるまでの代わり）
//
//  使い方:
//    node scripts/answer-invite.mjs demo-hayasaka@example.invalid          ← 届いている打診を一覧
//    node scripts/answer-invite.mjs demo-hayasaka@example.invalid 12 yes   ← 打診#12を引き受ける（no で断る）
//
//  ★ service_role は使わない。anon キーで本人としてログインし、
//    respond_invitation()（自分宛・未回答のものにしか答えられない関数）を呼ぶだけ。
//    画面の「引き受ける」ボタンと同じ経路。
//  ★ パスワードは 0006 の架空社員共通のダミー値（ローカルのデモ専用）
// =====================================================================
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(ROOT, '.env.local') })

const [email, idArg, answer] = process.argv.slice(2)
if (!email) {
  console.error('使い方: node scripts/answer-invite.mjs <架空社員のメール> [打診番号 yes|no]')
  process.exit(1)
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } })
const { error: loginErr } = await db.auth.signInWithPassword({ email, password: 'demo-seed-not-a-real-login' })
if (loginErr) { console.error('ログインできません:', loginErr.message); process.exit(1) }

if (!idArg) {
  const { data, error } = await db.from('invitations').select('id, status, quest_id').eq('status', 'sent').order('id')
  if (error) { console.error(error.message); process.exit(1) }
  console.log(`\n✉️ ${email} に届いている未回答の打診: ${data.length}件`)
  for (const i of data) console.log(`   #${i.id}（企て#${i.quest_id}）`)
  console.log('')
  process.exit(0)
}

const accept = (answer ?? 'yes').toLowerCase() !== 'no'
const { error } = await db.rpc('respond_invitation', { p_invitation_id: Number(idArg), p_accept: accept })
if (error) { console.error('🛑 答えられませんでした:', error.message); process.exit(1) }
console.log(`\n✅ 打診#${idArg} を${accept ? '引き受けました' : '断りました'}（${email}）\n`)
