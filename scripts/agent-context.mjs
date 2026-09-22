import { createAgentContext } from '../lib/agents/runtime.mjs'
export function cliContext(agent) {
  return createAgentContext({ dbUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    dbKey: process.env.SUPABASE_SERVICE_ROLE_KEY, apiKey: process.env[`ORCA_KEY_${agent}`],
    baseURL: process.env.ORCA_BASE_URL })
}
