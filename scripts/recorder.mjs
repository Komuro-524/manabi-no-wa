import { cliContext } from './agent-context.mjs'
import dotenv from 'dotenv'
import { runRecorder } from '../lib/agents/recorder.mjs'
dotenv.config({ path: '.env.local' })
try {
  await runRecorder({ argv: process.argv.slice(2), env: process.env, context: cliContext('RECORDER'), logger: console })
} catch (e) { console.error(e.message); process.exitCode = 1 }
