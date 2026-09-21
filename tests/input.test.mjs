import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { readLimitedJson, validateFrames, scanMeta, MAX_BODY_BYTES } from '../lib/selfscan-input.mjs'
import { authorizedCron } from '../lib/cron-auth.mjs'
import { estimateCallCost, positiveNumber } from '../lib/agents/budget.mjs'

test('Cron rejects absent, short and wrong secrets', () => {
  assert.equal(authorizedCron('Bearer undefined', undefined), false)
  assert.equal(authorizedCron('Bearer short', 'short'), false)
  assert.equal(authorizedCron('Bearer abcdefghijklmnop', 'abcdefghijklmnop'), true)
  assert.equal(authorizedCron('Bearer abcdefghijklmnoq', 'abcdefghijklmnop'), false)
})
test('body size enforced while streaming even without Content-Length', async () => {
  let cancelled = false
  const req = { headers: new Headers(), body: new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(MAX_BODY_BYTES + 1)) }, cancel() { cancelled = true } }) }
  await assert.rejects(readLimitedJson(req), e => e.status === 413)
  assert.equal(cancelled, true)
  const small = new Request('http://localhost', { method: 'POST', body: '{"frames":[]}' })
  assert.deepEqual(await readLimitedJson(small), { frames: [] })
})
test('images: real decoding, dimensions, MIME, Base64, bytes and count', async () => {
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'white' } }).png().toBuffer()
  const data = `data:image/png;base64,${png.toString('base64')}`
  assert.deepEqual(await validateFrames([data, data]), [data, data])
  for (const frames of [[data], Array(13).fill(data), ['x', data], [data.replace('png','jpeg'), data], ['data:image/png;base64,AAAA', data]]) {
    await assert.rejects(validateFrames(frames))
  }
  await assert.rejects(validateFrames(['data:image/png;base64,' + 'A'.repeat(700_000), data]), e => e.status === 413)
  const huge = await sharp({ create: { width: 2000, height: 20, channels: 3, background: 'white' } }).png().toBuffer()
  await assert.rejects(validateFrames([`data:image/png;base64,${huge.toString('base64')}`, data]))
})
test('metadata and invalid budget config fail closed', () => {
  assert.throws(() => scanMeta({ started_at: 'bad', ends_at: 'bad' }))
  for (const n of [NaN, Infinity, -1, 0]) assert.throws(() => positiveNumber(n, 'budget'))
  assert.ok(estimateCallCost('system','user',10,50) > 0.01)
  assert.ok(estimateCallCost('system','あ'.repeat(10000),10,50) > estimateCallCost('system','user',10,50))
})
