// Synthetic Supabase boundary: no production credentials or authentication bypass in the app.
import http from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const uid = '00000000-0000-4000-8000-000000000001'
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid' }
const me = { id: uid, display_name: 'テスト管理者', department: '開発', role: 'admin' }
const stamp = new Date().toISOString()
const live = {id:1,title:'テスト配信',status:'live',scheduled_start:stamp,scheduled_end:new Date(Date.now()+3600000).toISOString(),started_at:stamp,ingest_status:'pending',topic_tag_id:1,tags:{name:'SQL'}}
const tags = [{ id: 1, name: 'SQL', status: 'official', kind: '技術' }]
const quests = Array.from({length: 80},(_,i)=>({ id:i+1, status:['scouting','inviting','scheduling','opened','done'][i%5], current_invitee:uid, tried_count:1, tags:tags[0],quest_steps:[{created_at:stamp}] }))
let queries = 0
const mock = http.createServer(async (req,res)=>{
  queries++
  await new Promise(r=>setTimeout(r, 25 + Math.random()*90))
  const url = new URL(req.url,'http://localhost')
  let rows = []
  if(url.pathname === '/auth/v1/user') rows = user
  else if(url.pathname.endsWith('/rpc/admin_month_cost')) rows=0.01
  else if(url.pathname.endsWith('/rpc/knowledge_map_stats')) rows={nodes:[],edges:[],total:0}
  else {
    const table = url.pathname.split('/').pop()
    rows = ({lives:[live],live_participants:[{live_id:1,user_id:uid,role:'speaker',lives:live}],messages:Array.from({length:250},(_,i)=>({id:250-i,user_id:uid,live_id:1,body:'テスト発言'+(250-i),is_agent:false,created_at:stamp})),users:[me],tags,quests,agent_runs:[{id:1,status:'succeeded',started_at:stamp,cost_usd:0.01}],quest_steps:quests.map(q=>({id:q.id,quest_id:q.id,reason:'テスト',created_at:stamp}))})[table] ?? []
    if(url.searchParams.get('id')?.startsWith('eq.')) rows=rows.filter(r=>String(r.id)===url.searchParams.get('id').slice(3))
    for(const [key,value] of url.searchParams) if(value.startsWith('eq.') && key!=='id') rows=rows.filter(r=>r[key]===undefined || String(r[key])===value.slice(3))
    if(url.searchParams.has('offset')) rows=rows.slice(Number(url.searchParams.get('offset')))
    if(url.searchParams.has('limit')) rows=rows.slice(0,Number(url.searchParams.get('limit')))
    if(req.headers.accept?.includes('vnd.pgrst.object')) rows=rows[0]??null
  }
  res.setHeader('content-type','application/json');res.setHeader('content-range',url.pathname.endsWith('/quests') ? '0-79/80' : '0-0/1')
  res.end(req.method==='HEAD'?'':JSON.stringify(rows))
})
mock.listen(54329,'127.0.0.1');await once(mock,'listening')
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',NEXT_TELEMETRY_DISABLED:'1'}
let app,browser
try {
  if(process.argv.includes('--build')) {
    const build=spawn('npm',['run','build'],{env,stdio:'inherit'})
    assert.equal((await once(build,'exit'))[0],0,'production build')
  }
  app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3030','--hostname','127.0.0.1'],{env,stdio:['ignore','pipe','pipe']})
  app.stderr.on('data',b=>process.stderr.write(b))
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('server startup timeout')),30000);app.stdout.on('data',b=>{if(b.toString().includes('Ready')){clearTimeout(t);resolve()}});app.once('exit',()=>reject(new Error('server exited')))})
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'], ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})})
  const context=await browser.newContext()
  const session={access_token:`${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/'}])
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:3030/admin');await page.getByRole('heading',{name:'ダッシュボード',exact:true}).waitFor()
  const documentId=await page.evaluate(()=>window.__testDocument=crypto.randomUUID())
  const paths=[['/admin/progress','ライブのタネ'],['/admin/tags','タグ辞書'],['/admin','ダッシュボード'],['/calendar','日程カレンダー'],['/livehub','参加するライブを選ぶ'],['/admin','ダッシュボード'],['/admin/progress','ライブのタネ'],['/admin','ダッシュボード'],['/admin/agents','エージェント'],['/admin/security','セキュリティ'],['/admin/people','メンバー'],['/cards','知見カード'],['/map','知識地図'],['/profile','あなたのプロフィール'],['/invite','AIからの打診'],['/selfscan','自己分析'],['/admin','ダッシュボード']]
  const times=[]
  for(let i=0;i<50;i++){
    const [path,title]=paths[i%paths.length]; const before=queries;const start=Date.now()
    await page.locator(`a[href="${path}"]`).first().click()
    await page.waitForURL(`**${path}`,{timeout:10000})
    if(title)await page.getByRole('heading',{name:title,exact:true}).waitFor({timeout:10000})
    assert.equal(await page.evaluate(()=>window.__testDocument),documentId,'navigation preserves client state')
    times.push(Date.now()-start);console.log(JSON.stringify({navigation:i,path,ms:times.at(-1),queries:queries-before}))
  }
  await page.locator('a[href="/admin"]').first().click()
  await page.getByRole('heading',{name:'ダッシュボード',exact:true}).waitFor()
  await page.locator('a[href="/admin/progress"]').first().click()
  await page.getByRole('heading',{name:'ライブのタネ',exact:true}).waitFor()
  let rsc=0
  const countRsc=req=>{if(req.url().includes('_rsc='))rsc++}
  page.on('request',countRsc)
  const pollResponse=await page.waitForResponse(r=>r.url().includes('/api/admin/progress'),{timeout:20000})
  assert.equal(pollResponse.status(),200)
  assert.equal(rsc,0,'background progress update must not refresh the router')
  const progress=await pollResponse.json();assert.equal(progress.quests.length,80)
  console.log(JSON.stringify({backgroundPoll:'passed',rscRequests:rsc}))
  page.off('request',countRsc)
  await page.locator('a[href="/livehub"]').first().click()
  await page.locator('a[href="/live/1"]').first().click()
  await page.getByRole('heading',{name:'＃テスト配信',exact:true}).waitFor()
  assert.equal(await page.getByText('テスト発言250',{exact:true}).count(),1)
  assert.equal(await page.getByText('テスト発言150',{exact:true}).count(),0)
  await page.getByRole('link',{name:'以前の発言'}).click()
  await page.getByText('テスト発言150',{exact:true}).waitFor()
  assert.equal(await page.getByText('テスト発言250',{exact:true}).count(),0)
  await page.getByRole('link',{name:'新しい発言'}).click()
  await page.getByText('テスト発言250',{exact:true}).waitFor()
  await page.waitForResponse(r=>r.url().includes('/live/1') && r.url().includes('_rsc='),{timeout:10000})
  await page.locator('a[href="/admin"]').first().click()
  await page.getByRole('heading',{name:'ダッシュボード',exact:true}).waitFor()
  assert.equal(await page.evaluate(()=>window.__testDocument),documentId)
  console.log(JSON.stringify({liveHistoryAndRefresh:'passed'}))
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({passed:times.length,maxMs:Math.max(...times),totalQueries:queries,errors}))
} finally {await browser?.close();app?.kill('SIGTERM');mock.closeAllConnections();mock.close()}
