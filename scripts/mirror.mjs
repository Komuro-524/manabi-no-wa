import { cliContext } from './agent-context.mjs'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { runMirror } from '../lib/agents/mirror.mjs'
import { validateFrames } from '../lib/selfscan-input.mjs'
dotenv.config({ path: '.env.local' })
const argv = process.argv.slice(2)
const userId = argv[argv.indexOf('--user') + 1]
try {
  let meta = {}, frames
  if (argv.includes('--stdin')) {
    let raw = ''
    for await (const chunk of process.stdin) {
      raw += chunk
      if (Buffer.byteLength(raw) > 4_000_000) throw new Error('入力容量を超えました')
    }
    meta = JSON.parse(raw)
    frames = meta.frames
  } else {
    const mimes = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp' }
    frames = argv.filter(a => !a.startsWith('--') && a !== userId).map(file => {
      if (fs.statSync(file).size > 512_000) throw new Error('画像容量を超えました')
      return `data:image/${mimes[path.extname(file).toLowerCase()]};base64,${fs.readFileSync(file).toString('base64')}`
    })
  }
  await validateFrames(frames)
  const result = await runMirror({ userId, frames, meta, argv, env: process.env, context: cliContext('MIRROR'), logger: console })
  console.log('@@RESULT@@' + JSON.stringify(result))
} catch (e) { console.error(e.message); process.exitCode = 1 }
