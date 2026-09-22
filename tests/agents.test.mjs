import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runOrganizer } from '../lib/agents/organizer.mjs'
import { runRecorder } from '../lib/agents/recorder.mjs'
import { runMirror } from '../lib/agents/mirror.mjs'
const uid = '00000000-0000-4000-8000-000000000001'
function fakeDb(rows, rpcHandler) {
  const calls = []
  return {
    calls,
    async rpc(name, args) { calls.push({ rpc: name, args }); return rpcHandler(name, args) },
    from(table) {
      const entry = { table, operation: 'select', filters: [] }; calls.push(entry)
      const chain = new Proxy({}, { get(_, method) {
        if (method === 'then') return (resolve,reject) => Promise.resolve((() => {
          if (entry.operation === 'insert') return { data: entry.single ? { id: 20, ...entry.values } : [], error: null }
          if (entry.operation === 'update') return { data: [], error: null }
          const data = rows[table] ?? []
          return { data: entry.single ? data[0] ?? null : data, error: null, count: data.length }
        })()).then(resolve,reject)
        return (...args) => {
          if (['insert','update'].includes(method)) { entry.operation = method; entry.values = args[0] }
          if (['single','maybeSingle'].includes(method)) entry.single = true
          entry.filters.push([method,...args]); return chain
        }
      } })
      return chain
    },
  }
}
function aiWith(content, cost = 0.001) {
  const calls = []
  return { calls, chat: { completions: { create(request) { calls.push(request); return { async withResponse() {
    return { data: { choices: [{ message: { content: JSON.stringify(content) } }], usage: cost === null ? {} : { cost_usd: cost } },
      response: { headers: new Headers({ 'x-orca-request-id':'test-request' }) } }
  } } } } } }
}
const context = (db,ai) => ({ db, cleanupDb: db, ai })
test('organizer shared entry rejects an occupied DB lock before calling LLM', async () => {
  const db = fakeDb({}, () => ({ error: { code:'23505' } })), ai = aiWith({})
  await assert.rejects(runOrganizer({ context:context(db,ai) }),e=>e.code==='23505')
  assert.equal(ai.calls.length,0)
  assert.equal(db.calls.filter(c=>c.table).length,0)
})
test('organizer budget reserves the next call and unknown cost stops later calls', async () => {
  const rows = { tags: [{id:1,name:'SQL'},{id:2,name:'CSS'}], user_tags: [1,2].map(tag_id=>({user_id:uid,tag_id,kind:'interest'})) }
  for (const [budget, expectedCalls, cost] of [['0.01',0,0.001], ['1',1,null]]) {
    const db = fakeDb(rows,()=>({data:1,error:null})), ai = aiWith({ decision:'wait',reason:'Later' },cost)
    await runOrganizer({ env:{ORGANIZER_BUDGET_USD:budget},context:context(db,ai) })
    assert.equal(ai.calls.length,expectedCalls)
    if (expectedCalls) {
      assert.equal(ai.calls[0].max_tokens,2048)
      const completion = db.calls.find(c=>c.table==='agent_runs' && c.values?.status==='succeeded')
      assert.equal(completion.values.cost_usd,null)
    }
  }
})
test('recorder uses trusted line identity and one atomic commit, excluding agent chat', async () => {
  const rows = { lives:[{id:1,title:'Test'}], transcript_segments:[{seq:1,user_id:uid,body:'Explain SQL'}],
    tags:[{id:1,name:'SQL',status:'official'}] }
  const db = fakeDb(rows,(name)=>({data:name==='claim_recorder'?10:{cards:1},error:null}))
  const ai = aiWith({cards:[{tag:'SQL',speaker_seg:'s1',user_id:'attacker',headline:'SQL',body:'Summary'}],interests:[],encore:0})
  await runRecorder({argv:['--live','1'],context:context(db,ai)})
  const commit = db.calls.find(c=>c.rpc==='commit_recorder')
  assert.equal(commit.args.p_payload.items[0].user_id,uid)
  assert.equal(db.calls.filter(c=>c.operation==='insert'||c.operation==='update').length,0)
  assert.ok(db.calls.find(c=>c.table==='messages').filters.some(f=>f[0]==='eq' && f[1]==='is_agent' && f[2]===false))
})
test('invalid recorder output releases owned claim without committing partial data', async () => {
  const db = fakeDb({lives:[{id:1}],transcript_segments:[{seq:1,user_id:uid,body:'SQL'}],tags:[{id:1,name:'SQL',status:'official'}]},()=>({data:1,error:null}))
  await assert.rejects(runRecorder({argv:['--live','1'],context:context(db,aiWith({cards:'bad'}))}))
  assert.equal(db.calls.some(c=>c.rpc==='commit_recorder'),false)
  assert.equal(db.calls.some(c=>c.rpc==='release_recorder'),true)
})
test('mirror enforces shared rate gate before any LLM call', async () => {
  const db = fakeDb({users:[{id:uid,display_name:'Test'}]},()=>({error:{code:'P0429'}})), ai=aiWith({})
  await assert.rejects(runMirror({userId:uid,frames:['a','b'],context:context(db,ai)}),e=>e.status===429)
  assert.equal(ai.calls.length,0)
})
