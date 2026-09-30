const test = require('node:test')
const assert = require('node:assert')
const { MongoClient } = require('mongodb')
const { createStore } = require('../src/store')
const { openTestStore } = require('./helpers')

const doc = (n) => ({ title: `T${n}` })

test('every push keeps a version and load returns the latest', async () => {
  const ctx = await openTestStore()
  try {
    const { id, writeToken } = await ctx.store.mint()
    await ctx.store.push(id, writeToken, 0, doc(1), { title: 'T1', tileCount: 2 })
    await ctx.store.push(id, writeToken, 1, doc(2), { title: 'T2', tileCount: 3 })
    assert.strictEqual(await ctx.store.currentRev(id), 2)
    assert.deepStrictEqual(await ctx.store.loadRevision(id, 1), { rev: 1, document: doc(1) })
    assert.deepStrictEqual(await ctx.store.loadRevision(id, 2), { rev: 2, document: doc(2) })
    assert.strictEqual(await ctx.store.loadRevision(id, 3), null)
    const versions = await ctx.store.listVersions(id)
    assert.deepStrictEqual(versions.map((v) => v.rev), [2, 1])
    assert.strictEqual(versions[0].summary.tileCount, 3)
    assert.ok(versions[0].createdAt instanceof Date)
    assert.strictEqual((await ctx.store.versionCounts()).get(id), 2)
    assert.strictEqual(await ctx.store.versionCount(id), 2)
  } finally { await ctx.close() }
})

test('a push that lost the race writes no version', async () => {
  const ctx = await openTestStore()
  try {
    const { id, writeToken } = await ctx.store.mint()
    await ctx.store.push(id, writeToken, 0, doc(1))
    assert.strictEqual((await ctx.store.push(id, writeToken, 0, doc(2))).status, 'moved')
    assert.strictEqual((await ctx.store.push(id, 'w'.repeat(22), 1, doc(3))).status, 'unauthorized')
    assert.strictEqual(await ctx.store.versionCount(id), 1)
  } finally { await ctx.close() }
})

test('a minted canvas has no versions; unknown ids are empty', async () => {
  const ctx = await openTestStore()
  try {
    const { id } = await ctx.store.mint()
    assert.deepStrictEqual(await ctx.store.listVersions(id), [])
    assert.strictEqual(await ctx.store.currentRev(id), 0)
    assert.strictEqual(await ctx.store.currentRev('z'.repeat(22)), null)
    assert.strictEqual(await ctx.store.versionCount(id), 0)
  } finally { await ctx.close() }
})

test('remove deletes that canvas versions only', async () => {
  const ctx = await openTestStore()
  try {
    const a = await ctx.store.mint()
    const b = await ctx.store.mint()
    await ctx.store.push(a.id, a.writeToken, 0, doc(1))
    await ctx.store.push(b.id, b.writeToken, 0, doc(1))
    assert.strictEqual(await ctx.store.remove(a.id, a.writeToken), 'ok')
    assert.strictEqual(await ctx.store.versionCount(a.id), 0)
    assert.strictEqual(await ctx.store.versionCount(b.id), 1)
    assert.strictEqual(await ctx.store.remove(b.id, 'w'.repeat(22)), 'unauthorized')
    assert.strictEqual(await ctx.store.versionCount(b.id), 1)
  } finally { await ctx.close() }
})

test('opening a store backfills a missing current version, once', async () => {
  const ctx = await openTestStore()
  const client = await MongoClient.connect(process.env.MONGODB_URI)
  try {
    const { id, writeToken } = await ctx.store.mint()
    await ctx.store.push(id, writeToken, 0, doc(1))
    await client.db(ctx.dbName).collection('revisions').deleteMany({})
    assert.strictEqual(await ctx.store.versionCount(id), 0)
    const again = await createStore({ uri: process.env.MONGODB_URI, dbName: ctx.dbName })
    try {
      assert.deepStrictEqual(await again.loadRevision(id, 1), { rev: 1, document: doc(1) })
      assert.strictEqual(await again.versionCount(id), 1)
    } finally { await again.close() }
    const third = await createStore({ uri: process.env.MONGODB_URI, dbName: ctx.dbName })
    try { assert.strictEqual(await third.versionCount(id), 1) } finally { await third.close() }
  } finally {
    await client.close()
    await ctx.close()
  }
})

test('maxRevisions prunes the oldest and keeps the latest', async () => {
  const ctx = await openTestStore({ maxRevisions: 2 })
  try {
    const { id, writeToken } = await ctx.store.mint()
    for (let rev = 0; rev < 4; rev++) await ctx.store.push(id, writeToken, rev, doc(rev + 1))
    assert.deepStrictEqual((await ctx.store.listVersions(id)).map((v) => v.rev), [4, 3])
    assert.strictEqual(await ctx.store.loadRevision(id, 1), null)
    assert.deepStrictEqual(await ctx.store.load(id), { rev: 4, document: doc(4) })
  } finally { await ctx.close() }
})
