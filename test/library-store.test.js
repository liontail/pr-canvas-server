const test = require('node:test')
const assert = require('node:assert')
const { openTestStore } = require('./helpers')

let ctx
test.before(async () => { ctx = await openTestStore() })
test.after(async () => { await ctx.close() })

const SUMMARY = { title: 'T', repo: null, tileCount: 1, thumb: null }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function pushed (summary = SUMMARY) {
  const { id, writeToken } = await ctx.store.mint()
  await ctx.store.push(id, writeToken, 0, { n: 1 }, summary)
  return { id, writeToken }
}

test('push stores the summary, and a later push without one keeps it', async () => {
  const { id, writeToken } = await pushed()
  let row = await ctx.store.getLibraryRow(id)
  assert.deepStrictEqual(row.summary, SUMMARY)
  await ctx.store.push(id, writeToken, 1, { n: 2 })
  row = await ctx.store.getLibraryRow(id)
  assert.deepStrictEqual(row.summary, SUMMARY)
  assert.strictEqual(row.rev, 2)
})

test('library rows never carry the token hash or the document', async () => {
  const { id } = await pushed()
  const row = await ctx.store.getLibraryRow(id)
  assert.ok(!('tokenHash' in row))
  assert.ok(!('doc' in row))
  for (const listed of await ctx.store.listLibrary()) {
    assert.ok(!('tokenHash' in listed) && !('doc' in listed))
  }
})

test('listLibrary excludes unpushed canvases and orders newest write first', async () => {
  const unpushed = await ctx.store.mint()
  const first = await pushed()
  await sleep(15)
  const second = await pushed()
  const ids = (await ctx.store.listLibrary()).map((row) => row._id)
  assert.ok(!ids.includes(unpushed.id))
  assert.ok(ids.indexOf(second.id) < ids.indexOf(first.id))
  assert.strictEqual(await ctx.store.getLibraryRow(unpushed.id), null)
})

test('setSummary only applies to the revision it was computed for', async () => {
  const { id } = await pushed(null)
  assert.strictEqual(await ctx.store.setSummary(id, 99, SUMMARY), false)
  assert.strictEqual((await ctx.store.getLibraryRow(id)).summary, undefined)
  assert.strictEqual(await ctx.store.setSummary(id, 1, SUMMARY), true)
  assert.deepStrictEqual((await ctx.store.getLibraryRow(id)).summary, SUMMARY)
})

test('patchMeta sets fields independently and survives a re-push', async () => {
  const { id, writeToken } = await pushed()
  await ctx.store.patchMeta(id, { name: 'Renamed' })
  await ctx.store.patchMeta(id, { tags: ['a', 'b'] })
  const row = await ctx.store.patchMeta(id, { groupId: null })
  assert.deepStrictEqual(row.meta, { name: 'Renamed', tags: ['a', 'b'], groupId: null })
  await ctx.store.push(id, writeToken, 1, { n: 2 }, SUMMARY)
  assert.deepStrictEqual((await ctx.store.getLibraryRow(id)).meta, { name: 'Renamed', tags: ['a', 'b'], groupId: null })
})

test('patchMeta returns null for unknown and unpushed canvases', async () => {
  const unpushed = await ctx.store.mint()
  assert.strictEqual(await ctx.store.patchMeta(unpushed.id, { name: 'x' }), null)
  assert.strictEqual(await ctx.store.patchMeta('z'.repeat(22), { name: 'x' }), null)
})

test('groups: create, list, get, update', async () => {
  const parent = await ctx.store.createGroup({ name: 'Parent', parentId: null })
  const child = await ctx.store.createGroup({ name: 'Child', parentId: parent._id })
  assert.match(parent._id, /^[A-Za-z0-9_-]{22}$/)
  assert.strictEqual(child.parentId, parent._id)
  const listed = await ctx.store.listGroups()
  assert.ok(listed.some((g) => g._id === parent._id) && listed.some((g) => g._id === child._id))
  assert.strictEqual((await ctx.store.getGroup(child._id)).name, 'Child')
  assert.strictEqual(await ctx.store.getGroup('nope'), null)
  const renamed = await ctx.store.updateGroup(child._id, { name: 'Kid' })
  assert.strictEqual(renamed.name, 'Kid')
  assert.strictEqual(renamed.parentId, parent._id)
  const moved = await ctx.store.updateGroup(child._id, { parentId: null })
  assert.strictEqual(moved.parentId, null)
  assert.strictEqual(await ctx.store.updateGroup('nope', { name: 'x' }), null)
})

test('deleting a group moves its child groups and canvases up to its parent', async () => {
  const top = await ctx.store.createGroup({ name: 'Top', parentId: null })
  const mid = await ctx.store.createGroup({ name: 'Mid', parentId: top._id })
  const leaf = await ctx.store.createGroup({ name: 'Leaf', parentId: mid._id })
  const { id } = await pushed()
  await ctx.store.patchMeta(id, { groupId: mid._id })

  assert.strictEqual(await ctx.store.deleteGroup(mid._id), true)
  assert.strictEqual((await ctx.store.getGroup(leaf._id)).parentId, top._id)
  assert.strictEqual((await ctx.store.getLibraryRow(id)).meta.groupId, top._id)
  assert.strictEqual(await ctx.store.getGroup(mid._id), null)

  assert.strictEqual(await ctx.store.deleteGroup(top._id), true)
  assert.strictEqual((await ctx.store.getGroup(leaf._id)).parentId, null)
  assert.strictEqual((await ctx.store.getLibraryRow(id)).meta.groupId, null)
  assert.strictEqual(await ctx.store.deleteGroup('nope'), false)
})
