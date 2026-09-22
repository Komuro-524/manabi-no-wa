import { test } from 'node:test'
import assert from 'node:assert/strict'
import { poll } from '../lib/poll.mjs'
import { createScreenFetch } from '../lib/screen-fetch.mjs'
import { fmtWhen } from '../lib/format.js'
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
test('poll serializes slow reads, aborts on hide and never publishes after disposal',async()=>{
  const visibility=new EventTarget();visibility.visibilityState='visible'
  let concurrent=0,max=0,received=0,aborted=0
  const stop=poll({visibility,initial:null,interval:()=>5,fail:()=>{},receive:()=>received++,read:signal=>new Promise((resolve,reject)=>{
    concurrent++;max=Math.max(max,concurrent)
    const timer=setTimeout(()=>{concurrent--;resolve({})},25)
    signal.addEventListener('abort',()=>{clearTimeout(timer);concurrent--;aborted++;reject(new Error('abort'))},{once:true})
  })})
  await sleep(75);assert.equal(max,1);assert.ok(received>0)
  visibility.visibilityState='hidden';visibility.dispatchEvent(new Event('visibilitychange'))
  const before=received;await sleep(35);assert.equal(received,before)
  visibility.visibilityState='visible';visibility.dispatchEvent(new Event('visibilitychange'));stop()
  await sleep(35);assert.equal(received,before);assert.ok(aborted>0)
})
test('DB requests time out and respect caller cancellation without retrying writes',async()=>{
  let calls=0
  const request=createScreenFetch({timeout:10,fetcher:(_,init)=>new Promise((resolve,reject)=>{
    calls++;if(init.signal.aborted)return reject(init.signal.reason)
    init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true})
  })})
  await assert.rejects(request('https://example.invalid',{method:'POST'}),e=>e.name==='TimeoutError')
  const controller=new AbortController();controller.abort(new Error('caller cancelled'))
  await assert.rejects(request('https://example.invalid',{signal:controller.signal}),/caller cancelled/)
  assert.equal(calls,2)
})
test('Japanese date formatting crosses UTC midnight without parsing locale strings',()=>{
  assert.equal(fmtWhen('2026-09-21T16:05:00Z'),'9/22（火）01:05')
  assert.equal(fmtWhen('invalid'),'')
})
