import 'server-only'
import { runOrganizer } from './organizer.mjs'
import { runRecorder } from './recorder.mjs'
import { runMirror } from './mirror.mjs'
import { createAgentContext } from './runtime.mjs'

function context(agent) {
  return createAgentContext({ dbUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    dbKey: process.env.SUPABASE_SERVICE_ROLE_KEY, apiKey: process.env[`ORCA_KEY_${agent}`],
    baseURL: process.env.ORCA_BASE_URL })
}
export const organizer = (options = {}) => runOrganizer({ ...options, env: process.env, context: context('ORGANIZER') })
export const recorder = liveId => runRecorder({ argv: ['--live', String(liveId)], env: process.env, context: context('RECORDER') })
export const mirror = (userId, frames, meta) => runMirror({ userId, frames, meta, env: process.env, context: context('MIRROR') })
