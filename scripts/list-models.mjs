// =====================================================================
//  🔎 いま使えるモデルを実際に見る
//
//  モデルの当たりは思い込みで決めない。/v1/models を叩いて 単価つきで並べる。
//  Union Alpha（無料枠）は回転式なので、その日のラインナップもここで分かる。
//
//  使い方:
//    node scripts/list-models.mjs                 ← 入力単価の安い順に全部
//    node scripts/list-models.mjs --free          ← 無料モデルだけ
//    node scripts/list-models.mjs --vision        ← 画像を読めるものだけ
//    node scripts/list-models.mjs --grep flash    ← 名前で絞る
//    node scripts/list-models.mjs --raw           ← 1件目の生JSON（項目名の確認用）
//
//  ★ APIキーは表示しない。読み取り専用。DBには一切触らない。
// =====================================================================

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(ROOT, '.env.local') })

if (!process.env.ORCA_KEY_RECORDER) {
  console.error('\n🛑 .env.local に ORCA_KEY_RECORDER が入っていません\n')
  process.exit(1)
}

const BASE   = process.env.ORCA_BASE_URL || 'https://api.orcarouter.ai/v1'
const ARGV   = process.argv.slice(2)
const RAW    = ARGV.includes('--raw')
const FREE   = ARGV.includes('--free')
const VISION = ARGV.includes('--vision')
const GREP   = (ARGV[ARGV.indexOf('--grep') + 1] || '').toLowerCase()
const HAS_GREP = ARGV.includes('--grep')

const res = await fetch(`${BASE}/models`, {
  headers: { Authorization: `Bearer ${process.env.ORCA_KEY_RECORDER}` },
})
if (!res.ok) {
  console.error(`\n🛑 ${res.status} ${res.statusText}\n`)
  process.exit(1)
}
const body = await res.json()
const rows = body.data ?? body.models ?? []

if (RAW) {
  console.log(JSON.stringify(rows[0], null, 2))
  process.exit(0)
}

// 項目名はプロバイダごとに揺れるので 候補を順に見る
const num = v => (v === null || v === undefined || v === '' ? null : Number(v))
const pick = (o, keys) => { for (const k of keys) { const v = num(k.split('.').reduce((a, c) => a?.[c], o)); if (v !== null && !Number.isNaN(v)) return v } return null }
const inPrice  = m => pick(m, ['pricing.prompt', 'pricing.input', 'input_price', 'price.input', 'prompt_price'])
const outPrice = m => pick(m, ['pricing.completion', 'pricing.output', 'output_price', 'price.output', 'completion_price'])
const ctx      = m => pick(m, ['context_length', 'context_window', 'top_provider.context_length'])
const isVision = m => {
  const s = JSON.stringify(m).toLowerCase()
  return s.includes('"image"') || s.includes('vision') || s.includes('multimodal')
}
const isFree = m => (m.id ?? '').toLowerCase().includes('-free') || inPrice(m) === 0

let list = rows
if (FREE)     list = list.filter(isFree)
if (VISION)   list = list.filter(isVision)
if (HAS_GREP) list = list.filter(m => (m.id ?? '').toLowerCase().includes(GREP))

list.sort((a, b) => (inPrice(a) ?? Infinity) - (inPrice(b) ?? Infinity))

const fmt = v => (v === null ? '—' : v === 0 ? '$0' : '$' + v.toPrecision(3))
const pad = (s, n) => String(s).padEnd(n, ' ')

console.log(`\n🐋 ${list.length} 件 / 全 ${rows.length} 件   (${new Date().toLocaleString('ja-JP')})\n`)
console.log(pad('モデルID', 46) + pad('入力', 12) + pad('出力', 12) + pad('文脈', 10) + '画像')
console.log('-'.repeat(88))
for (const m of list) {
  console.log(
    pad(m.id ?? '?', 46) +
    pad(fmt(inPrice(m)), 12) +
    pad(fmt(outPrice(m)), 12) +
    pad(ctx(m) ? ctx(m).toLocaleString() : '—', 10) +
    (isVision(m) ? '👁' : '')
  )
}
console.log('')
