import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

// Credentials are supplied only by the server-only entrypoint or the CLI.
// Each invocation owns its clients, counters and deadline. Never use module globals.
export function createContext(agent, options) {
  if (!options.context) throw new Error(`Missing server context for ${agent}`)
  return options.context
}
export function createAgentContext({ dbUrl, dbKey, apiKey, baseURL }) {
  if (!dbUrl || !dbKey || !apiKey) throw new Error('エージェントの環境変数が未設定です')
  const deadline = Date.now() + 240_000
  const signal = AbortSignal.timeout(240_000)
  const boundedFetch = (input, init = {}) => {
    if (Date.now() >= deadline) throw new Error('エージェントの実行時間を超えました')
    return fetch(input, { ...init, signal: init.signal ? AbortSignal.any([signal, init.signal]) : signal })
  }
  const makeDb = fetcher => createClient(dbUrl, dbKey, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetcher },
  })
  return {
    db: makeDb(boundedFetch),
    cleanupDb: makeDb((input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) })),
    ai: new OpenAI({ apiKey, baseURL: baseURL || 'https://api.orcarouter.ai/v1',
      defaultHeaders: { 'X-OrcaRouter-Include-Cost': 'true' },
      timeout: 60_000, maxRetries: 0, fetch: boundedFetch }),
  }
}
