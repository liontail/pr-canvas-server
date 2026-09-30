const test = require('node:test')
const assert = require('node:assert')
const { ApiError } = require('../src/errors')
const { openTestStore } = require('./helpers')

async function withVersions (ctx, count) {
  const { id, writeToken } = await ctx.store.mint()
  for (let rev = 0; rev < count; rev++) {
    await ctx.store.push(id, writeToken, rev, { title: `T${rev + 1}` }, { title: `T${rev + 1}`, tileCount: 1 })
  }
  return { id, writeToken }
}

test('LAST_VERSION maps to HTTP 409', () => {
  assert.strictEqual(new ApiError('LAST_VERSION', 'x').status, 409)
})

test('deleteCanvas removes the canvas and its versions, and nothing else', async () => {
  const ctx = await openTestStore()
  try {
    const a = await withVersions(ctx, 2)
    const b = await withVersions(ctx, 1)
    const minted = await ctx.store.mint()
    assert.strictEqual(await ctx.store.deleteCanvas(a.id), true)
    assert.strictEqual(await ctx.store.load(a.id), null)
    assert.strictEqual(await ctx.store.versionCount(a.id), 0)
    assert.strictEqual(await ctx.store.versionCount(b.id), 1)
    assert.strictEqual(await ctx.store.deleteCanvas(a.id), false)
    assert.strictEqual(await ctx.store.deleteCanvas('z'.repeat(22)), false)
    assert.strictEqual(await ctx.store.deleteCanvas(minted.id), false)
    assert.strictEqual(await ctx.store.currentRev(minted.id), 0)
  } finally { await ctx.close() }
})

test('deleting a middle version removes only that row', async () => {
  const ctx = await openTestStore()
  try {
    const { id } = await withVersions(ctx, 3)
    assert.strictEqual(await ctx.store.deleteVersion(id, 2), 'ok')
    assert.deepStrictEqual((await ctx.store.listVersions(id)).map((v) => v.rev), [3, 1])
    assert.strictEqual(await ctx.store.currentRev(id), 3)
    assert.deepStrictEqual(await ctx.store.load(id), { rev: 3, document: { title: 'T3' } })
  } finally { await ctx.close() }
})

test('deleting the latest promotes the previous version and a later push reuses the number', async () => {
  const ctx = await openTestStore()
  try {
    const { id, writeToken } = await withVersions(ctx, 3)
    assert.strictEqual(await ctx.store.deleteVersion(id, 3), 'ok')
    assert.strictEqual(await ctx.store.currentRev(id), 2)
    assert.deepStrictEqual(await ctx.store.load(id), { rev: 2, document: { title: 'T2' } })
    assert.deepStrictEqual((await ctx.store.listVersions(id)).map((v) => v.rev), [2, 1])
    assert.deepStrictEqual(await ctx.store.push(id, writeToken, 2, { title: 'T4' }), { status: 'ok', rev: 3 })
    assert.deepStrictEqual(await ctx.store.loadRevision(id, 3), { rev: 3, document: { title: 'T4' } })
  } finally { await ctx.close() }
})

test('deleting the latest skips a gap left by an earlier delete', async () => {
  const ctx = await openTestStore()
  try {
    const { id } = await withVersions(ctx, 3)
    await ctx.store.deleteVersion(id, 2)
    assert.strictEqual(await ctx.store.deleteVersion(id, 3), 'ok')
    assert.strictEqual(await ctx.store.currentRev(id), 1)
    assert.deepStrictEqual(await ctx.store.load(id), { rev: 1, document: { title: 'T1' } })
  } finally { await ctx.close() }
})

test('the only version cannot be deleted; unknown targets are not_found', async () => {
  const ctx = await openTestStore()
  try {
    const { id } = await withVersions(ctx, 1)
    assert.strictEqual(await ctx.store.deleteVersion(id, 1), 'last_version')
    assert.strictEqual(await ctx.store.versionCount(id), 1)
    assert.strictEqual(await ctx.store.deleteVersion(id, 2), 'not_found')
    assert.strictEqual(await ctx.store.deleteVersion('z'.repeat(22), 1), 'not_found')
    const minted = await ctx.store.mint()
    assert.strictEqual(await ctx.store.deleteVersion(minted.id, 1), 'not_found')
  } finally { await ctx.close() }
})
