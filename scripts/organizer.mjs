import { cliContext } from './agent-context.mjs'
import dotenv from 'dotenv'
import { runOrganizer } from '../lib/agents/organizer.mjs'
dotenv.config({ path: '.env.local' })
try {
  await runOrganizer({ argv: process.argv.slice(2), env: process.env, context: cliContext('ORGANIZER'), logger: console })
} catch (e) { console.error(e.message); process.exitCode = 1 }
