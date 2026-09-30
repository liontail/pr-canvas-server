const test = require('node:test')
const assert = require('node:assert')
const { openTestStore } = require('./helpers')

let ctx
test.before(async () => { ctx = await openTestStore() })
test.after(async () => { await ctx.close() })

const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/

test('mint creates a rev-0 canvas with 22-char secrets', async () => {
  const { id, writeToken } = await ctx.store.mint()
  assert.match(id, TOKEN_RE)
  assert.match(writeToken, TOKEN_RE)
  assert.notStrictEqual(id, writeToken)
  assert.deepStrictEqual(await ctx.store.load(id), { rev: 0, document: null })
})

test('load returns null for an unknown id', async () => {
  assert.strictEqual(await ctx.store.load('x'.repeat(22)), null)
})

test('checkToken distinguishes ok / unauthorized / not_found', async () => {
  const { id, writeToken } = await ctx.store.mint()
  assert.strictEqual(await ctx.store.checkToken(id, writeToken), 'ok')
  assert.strictEqual(await ctx.store.checkToken(id, 'w'.repeat(22)), 'unauthorized')
  assert.strictEqual(await ctx.store.checkToken('y'.repeat(22), writeToken), 'not_found')
})

test('push increments rev and load round-trips keys containing "." and "$"', async () => {
  const { id, writeToken } = await ctx.store.mint()
  const document = { 'a.b': 1, $c: { 'd.e': [1, 2] }, plain: 'x' }
  assert.deepStrictEqual(await ctx.store.push(id, writeToken, 0, document), { status: 'ok', rev: 1 })
  assert.deepStrictEqual(await ctx.store.load(id), { rev: 1, document })
  assert.deepStrictEqual(await ctx.store.push(id, writeToken, 1, { n: 2 }), { status: 'ok', rev: 2 })
})

test('push with a stale If-Match reports the current rev and stores nothing', async () => {
  const { id, writeToken } = await ctx.store.mint()
  await ctx.store.push(id, writeToken, 0, { n: 1 })
  assert.deepStrictEqual(await ctx.store.push(id, writeToken, 0, { n: 'stale' }), { status: 'moved', rev: 1 })
  assert.deepStrictEqual((await ctx.store.load(id)).document, { n: 1 })
})

test('push with a wrong token or unknown id is rejected', async () => {
  const { id, writeToken } = await ctx.store.mint()
  assert.deepStrictEqual(await ctx.store.push(id, 'w'.repeat(22), 0, {}), { status: 'unauthorized' })
  assert.deepStrictEqual(await ctx.store.push('z'.repeat(22), writeToken, 0, {}), { status: 'not_found' })
})

test('two concurrent pushes with the same If-Match: exactly one wins', async () => {
  const { id, writeToken } = await ctx.store.mint()
  const results = await Promise.all([
    ctx.store.push(id, writeToken, 0, { who: 'a' }),
    ctx.store.push(id, writeToken, 0, { who: 'b' }),
  ])
  assert.deepStrictEqual(results.map((r) => r.status).sort(), ['moved', 'ok'])
  assert.strictEqual((await ctx.store.load(id)).rev, 1)
})

test('rotate swaps the token; the old one stops working', async () => {
  const { id, writeToken } = await ctx.store.mint()
  const next = 'n'.repeat(22)
  assert.strictEqual(await ctx.store.rotate(id, writeToken, next), 'ok')
  assert.strictEqual(await ctx.store.checkToken(id, next), 'ok')
  assert.strictEqual(await ctx.store.checkToken(id, writeToken), 'unauthorized')
})

test('rotate onto the current token is ok (validity check / replay), even without a bearer', async () => {
  const { id, writeToken } = await ctx.store.mint()
  assert.strictEqual(await ctx.store.rotate(id, null, writeToken), 'ok')
  assert.strictEqual(await ctx.store.rotate(id, writeToken, writeToken), 'ok')
})

test('rotate rejects a wrong or missing bearer and unknown ids', async () => {
  const { id, writeToken } = await ctx.store.mint()
  assert.strictEqual(await ctx.store.rotate(id, 'w'.repeat(22), 'n'.repeat(22)), 'unauthorized')
  assert.strictEqual(await ctx.store.rotate(id, null, 'n'.repeat(22)), 'unauthorized')
  assert.strictEqual(await ctx.store.rotate('q'.repeat(22), writeToken, 'n'.repeat(22)), 'not_found')
})

test('remove needs the right token', async () => {
  const { id, writeToken } = await ctx.store.mint()
  assert.strictEqual(await ctx.store.remove(id, 'w'.repeat(22)), 'unauthorized')
  assert.strictEqual(await ctx.store.remove(id, writeToken), 'ok')
  assert.strictEqual(await ctx.store.load(id), null)
  assert.strictEqual(await ctx.store.remove(id, writeToken), 'not_found')
})
