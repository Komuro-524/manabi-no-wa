import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const user = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const token = '00000000-0000-4000-8000-000000000010'
const token2 = '00000000-0000-4000-8000-000000000020'
async function setup() {
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated, anon, service_role; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`)
  for (const n of ['0001_schema','0002_rls','0004_grants','0005_grants_service','0007_unknown_speaker','0008_transcript_segments','0009_tag_mentions','0010_hide_growing_content','0011_request_ids','0014_speaker_participants','0015_agent_safety','0016_screen_performance','0022_schedule_accepted_invitation']) {
    await db.exec(fs.readFileSync(`supabase/migrations/${n}.sql`,'utf8'))
  }
  await db.query('insert into auth.users values ($1),($2)',[user, other])
  await db.query("insert into users(id,display_name) values ($1,'Test A'),($2,'Test B')",[user,other])
  return db
}
const scalar = async (db, sql, args = []) => Object.values((await db.query(sql,args)).rows[0])[0]
async function live(db) {
  const id = await scalar(db, "select create_live_with_speaker($1,'Test live',null,now()+interval '1 hour',60)",[user])
  await db.query("update lives set status='ended' where id=$1",[id])
  return id
}
const payload = (uid=user) => ({
  items: [{ tag:'SQL', user_id:uid, kind:'knowledge', headline:'Query', body:'Summary', confidence:0.8 },
    { tag:'SQL', user_id:uid, kind:'interest' }], rejects:[], window_days:30,min_mentions:3,min_speakers:2,
  encore:1,needs_review:false,cost:0.002,request_ids:['test-request'],note:null,
})
test('database migration and safety invariants', async t => {
  const db = await setup()
  try {
    await t.test('screen aggregation respects RLS and admin RPC permissions', async () => {
      const db = await setup()
      try {
      await db.exec(`insert into tags(name,kind,status) values ('Visible','技術','official'),('Private','技術','candidate')`)
      const tag = await scalar(db, "select id from tags where name='Visible'")
      await db.query("insert into user_tags(user_id,tag_id,kind,source,visibility) values ($1,$3,'knowledge','manual','public'),($2,$3,'interest','manual','private')", [user,other,tag])
      const mineLive = await scalar(db,"select create_live_with_speaker($1,'Mine',$2,now()+interval '1 hour',60)",[user,tag])
      await scalar(db,"select create_live_with_speaker($1,'Other',$2,now()+interval '1 hour',60)",[other,tag])
      await scalar(db,"select create_live_with_speaker($1,'Old',$2,now()+interval '1 hour',60)",[user,tag])
      await db.exec("update lives set scheduled_start='2026-09-22 10:00Z',scheduled_end='2026-09-22 11:00Z' where title in ('Mine','Other'); update lives set scheduled_start='2025-01-01 10:00Z',scheduled_end='2025-01-01 11:00Z' where title='Old'")
      await db.query("insert into knowledge_cards(live_id,tag_id,speaker_id,headline,body) select $1,$2,$3,'Summary','Body' from generate_series(1,1100)",[mineLive,tag,user])
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user])
      await db.exec('set role authenticated')
      try {
        const graph = await scalar(db,'select knowledge_map_stats()')
        assert.equal(graph.nodes.length,1)
        assert.equal(graph.nodes[0].people,1)
        assert.equal(graph.nodes[0].cards,1100)
        const calendar = await db.query("select * from calendar_lives('2026-09-22 10:30Z','2026-09-22 11:30Z')")
        assert.equal(calendar.rows.length,1)
        assert.equal(calendar.rows[0].live_id,mineLive)
        assert.equal((await db.query("select * from calendar_lives('2026-09-22 11:00Z','2026-09-22 12:00Z')")).rows.length,0)
        assert.equal(graph.nodes[0].mine,true)
        assert.deepEqual(graph.edges,[])
        await assert.rejects(scalar(db,"select admin_tag_stats(now())"),e=>e.code==='42501')
        await assert.rejects(scalar(db,"select admin_month_cost(now())"),e=>e.code==='42501')
      } finally { await db.exec('reset role') }
      await db.exec('set role anon')
      try { await assert.rejects(scalar(db,'select knowledge_map_stats()'),e=>e.code==='42501') }
      finally { await db.exec('reset role') }
      } finally { await db.close() }
    })
    await t.test('live creation rolls back when speaker insertion fails', async () => {
      const before = await scalar(db,'select count(*) from lives')
      await assert.rejects(scalar(db,"select create_live_with_speaker($1,'Rollback',null,now(),60)",[token]))
      assert.equal(await scalar(db,'select count(*) from lives'),before)
    })
    await t.test('accepting an invitation immediately schedules a visible live', async () => {
      const tag = await scalar(db,"insert into tags(name,kind,status) values ('Immediate','技術','official') returning id")
      const quest = await scalar(db,"insert into quests(tag_id,status,current_invitee) values ($1,'inviting',$2) returning id",[tag,user])
      const invitation = await scalar(db,"insert into invitations(quest_id,user_id) values ($1,$2) returning id",[quest,user])
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user])
      await db.exec('set role authenticated')
      try {
        await db.query('select respond_invitation($1,true)',[invitation])
        assert.equal(await scalar(db,"select count(*) from calendar_lives(now(),now()+interval '30 days')"),1)
      } finally { await db.exec('reset role') }
      assert.equal(await scalar(db,"select status from invitations where id=$1",[invitation]),'accepted')
      assert.equal(await scalar(db,"select status from quests where id=$1",[quest]),'opened')
      assert.equal(await scalar(db,"select count(*) from lives where quest_id=$1 and status='scheduled'",[quest]),1)
      assert.equal(await scalar(db,"select count(*) from live_participants p join lives l on l.id=p.live_id where l.quest_id=$1 and p.user_id=$2 and p.role='speaker'",[quest,user]),1)
    })
    await t.test('organizer singleton, completed duplicate Cron day and browser permissions', async () => {
      const run = await scalar(db,"select start_organizer('test','2026-09-21')")
      await assert.rejects(scalar(db,"select start_organizer('test')"), e => e.code === '23505')
      await db.query("update agent_runs set status='succeeded' where id=$1",[run])
      assert.equal(await scalar(db,"select start_organizer('test','2026-09-21')"),null)
      for (const role of ['anon','authenticated']) {
        await db.exec(`set role ${role}`)
        try {
          await assert.rejects(scalar(db,"select start_organizer('test')"), e=>e.code==='42501')
          await assert.rejects(scalar(db,'select start_mirror($1,\'test\')',[user]), e=>e.code==='42501')
          await assert.rejects(scalar(db,"select create_live_with_speaker($1,'Forbidden',null,now(),60)",[user]), e=>e.code==='42501')
          await assert.rejects(scalar(db,"select claim_recorder(1,$1,'test')",[token]), e=>e.code==='42501')
          await assert.rejects(scalar(db,"select commit_recorder(1,$1,1,'{}')",[token]), e=>e.code==='42501')
          await assert.rejects(scalar(db,"select release_recorder(1,$1,1)",[token]), e=>e.code==='42501')
        } finally { await db.exec('reset role') }
      }
    })
    await t.test('mirror concurrency, cooldown and rolling daily quota', async () => {
      const run = await scalar(db,"select start_mirror($1,'test')",[user])
      await assert.rejects(scalar(db,"select start_mirror($1,'test')",[user]),e=>e.code==='23505')
      await db.query("update agent_runs set status='failed' where id=$1",[run])
      await assert.rejects(scalar(db,"select start_mirror($1,'test')",[user]),e=>e.code==='P0429')
      await db.query("update agent_runs set started_at=now()-interval '10 minutes' where id=$1",[run])
      await db.query("insert into agent_runs(agent,trigger,status,ref_id,started_at) select 'C','manual','failed',$1,now()-interval '10 minutes' from generate_series(1,9)",[user])
      await assert.rejects(scalar(db,"select start_mirror($1,'test')",[user]),e=>e.code==='P0429')
    })
    await t.test('recorder only one claim, atomic rollback, retry and commit idempotency', async () => {
      const id = await live(db)
      const run = await scalar(db,"select claim_recorder($1,$2,'test')",[id,token])
      assert.ok(run)
      assert.equal(await scalar(db,"select claim_recorder($1,$2,'test')",[id,token2]),null)
      // First card is valid, second fails: all derived data must roll back.
      const bad = payload(); bad.items.push({...bad.items[0],tag:'ZZInvalid',user_id:other})
      await assert.rejects(scalar(db,'select commit_recorder($1,$2,$3,$4)',[id,token,run,bad]))
      assert.equal(await scalar(db,'select count(*) from knowledge_cards'),0)
      assert.equal(await scalar(db,'select count(*) from user_tags'),0)
      assert.equal(await scalar(db,"select count(*) from tags where name='SQL'"),0)
      const result = await scalar(db,'select commit_recorder($1,$2,$3,$4)',[id,token,run,payload()])
      assert.equal(result.cards,1)
      assert.equal(await scalar(db,'select count(*) from tag_mentions'),1)
      assert.equal(await scalar(db,'select commit_recorder($1,$2,$3,$4)',[id,token,run,payload()]).then(r=>r.skipped),true)
      await scalar(db,'select release_recorder($1,$2,$3)',[id,token,run])
      assert.equal(await scalar(db,'select ingest_status from lives where id=$1',[id]),'done')
      assert.equal(Number(await scalar(db,"select strength from user_tags where kind='knowledge'")),1)
    })
    await t.test('expired recorder can recover; old worker cannot commit; attempt limit stops retry', async () => {
      const id = await live(db)
      const oldRun = await scalar(db,"select claim_recorder($1,$2,'test')",[id,token])
      await db.query("update lives set ingest_lease_until=now()-interval '1 minute' where id=$1",[id])
      const newRun = await scalar(db,"select claim_recorder($1,$2,'test')",[id,token2])
      assert.ok(newRun)
      await assert.rejects(scalar(db,'select commit_recorder($1,$2,$3,$4)',[id,token,oldRun,payload()]))
      await scalar(db,'select release_recorder($1,$2,$3)',[id,token,oldRun])
      assert.equal(await scalar(db,'select ingest_token from lives where id=$1',[id]),token2)
      await scalar(db,'select release_recorder($1,$2,$3)',[id,token2,newRun])
      const third = await scalar(db,"select claim_recorder($1,$2,'test')",[id,token])
      await scalar(db,'select release_recorder($1,$2,$3)',[id,token,third])
      assert.equal(await scalar(db,'select ingest_status from lives where id=$1',[id]),'needs_review')
      assert.equal(await scalar(db,"select claim_recorder($1,$2,'test')",[id,token2]),null)
    })
  } finally { await db.close() }
})
