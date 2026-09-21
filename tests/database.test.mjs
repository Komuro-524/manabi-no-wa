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
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`)
  for (const n of ['0001_schema','0002_rls','0004_grants','0005_grants_service','0007_unknown_speaker','0008_transcript_segments','0009_tag_mentions','0010_hide_growing_content','0011_request_ids','0014_speaker_participants','0015_agent_safety']) {
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
    await t.test('live creation rolls back when speaker insertion fails', async () => {
      const before = await scalar(db,'select count(*) from lives')
      await assert.rejects(scalar(db,"select create_live_with_speaker($1,'Rollback',null,now(),60)",[token]))
      assert.equal(await scalar(db,'select count(*) from lives'),before)
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
