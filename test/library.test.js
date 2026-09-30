const test = require('node:test')
const assert = require('node:assert')
const { payloadGraph, postmarkRefactorGraph, minimalGraph } = require('@coldtea/pr-lens-schema/examples')
const { startTestApp, api, mintPushed } = require('./helpers')

let ctx
test.before(async () => { ctx = await startTestApp() })
test.after(async () => { await ctx.close() })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const list = async () => (await api(ctx.base, '/api/library')).json
const find = (library, id) => library.canvases.find((c) => c.id === id)
const patch = (id, body) => api(ctx.base, `/api/library/canvases/${id}`, { method: 'PATCH', body })
const newGroup = async (name, parentId) => (await api(ctx.base, '/api/library/groups', { method: 'POST', body: parentId === undefined ? { name } : { name, parentId } }))
const errorCode = (res) => res.json && res.json.error && res.json.error.code

test('the list has pushed canvases only, newest first, with summary fields and view links', async () => {
  const unpushed = (await api(ctx.base, '/api/canvas', { method: 'POST' })).json
  const a = await mintPushed(ctx.base, payloadGraph)
  await sleep(15)
  const b = await mintPushed(ctx.base, postmarkRefactorGraph)
  const library = await list()
  const ids = library.canvases.map((c) => c.id)
  assert.ok(!ids.includes(unpushed.id))
  assert.ok(ids.indexOf(b.id) < ids.indexOf(a.id))
  const item = find(library, a.id)
  assert.strictEqual(item.title, payloadGraph.title)
  assert.strictEqual(item.repo, `${payloadGraph.provenance.repo.owner}/${payloadGraph.provenance.repo.name}`)
  assert.strictEqual(item.tiles, a.pushed.json.tiles.length)
  assert.strictEqual(item.rev, 1)
  assert.strictEqual(item.name, null)
  assert.deepStrictEqual(item.tags, [])
  assert.strictEqual(item.groupId, null)
  assert.match(item.thumb.light, /^overview-light-[0-9a-f]+\.svg$/)
  assert.strictEqual(item.viewUrl, `http://canvas.test/c/${a.id}`)
  assert.ok(!Number.isNaN(Date.parse(item.createdAt)) && !Number.isNaN(Date.parse(item.lastWriteAt)))
})

test('the library never exposes token hashes, write tokens or document bodies', async () => {
  const c = await mintPushed(ctx.base, minimalGraph)
  const res = await api(ctx.base, '/api/library')
  assert.ok(!res.text.includes('tokenHash'))
  assert.ok(!res.text.includes(c.writeToken))
  assert.ok(!res.text.includes('schemaVersion'))
  const patched = await patch(c.id, { name: 'x' })
  assert.ok(!patched.text.includes('tokenHash') && !patched.text.includes(c.writeToken))
})

test('a legacy canvas without a summary is backfilled on first list and persisted', async () => {
  const minted = (await api(ctx.base, '/api/canvas', { method: 'POST' })).json
  await ctx.store.push(minted.id, minted.writeToken, 0, JSON.parse(JSON.stringify(payloadGraph)))
  assert.strictEqual((await ctx.store.getLibraryRow(minted.id)).summary, undefined)
  const item = find(await list(), minted.id)
  assert.strictEqual(item.title, payloadGraph.title)
  assert.match(item.thumb.light, /^overview-light-/)
  const row = await ctx.store.getLibraryRow(minted.id)
  assert.strictEqual(row.summary.title, payloadGraph.title)
})

test('a stored canvas that cannot be rendered still lists, with a fallback summary', async () => {
  const minted = (await api(ctx.base, '/api/canvas', { method: 'POST' })).json
  await ctx.store.push(minted.id, minted.writeToken, 0, { title: 'Broken doc', kind: 'graph' })
  const res = await api(ctx.base, '/api/library')
  assert.strictEqual(res.status, 200)
  const item = find(res.json, minted.id)
  assert.strictEqual(item.title, 'Broken doc')
  assert.strictEqual(item.tiles, 0)
  assert.strictEqual(item.thumb, null)
})

test('PATCH sets name, tags and group, resets an empty name, and keeps them across a re-push', async () => {
  const c = await mintPushed(ctx.base, payloadGraph)
  const group = (await newGroup('Batch')).json
  const res = await patch(c.id, { name: '  Renamed  ', tags: ['Prod', 'prod', 'batch'], groupId: group.id })
  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.json.name, 'Renamed')
  assert.deepStrictEqual(res.json.tags, ['Prod', 'batch'])
  assert.strictEqual(res.json.groupId, group.id)

  const again = await api(ctx.base, `/api/canvas/${c.id}`, { method: 'PUT', token: c.writeToken, ifMatch: 1, body: payloadGraph })
  assert.strictEqual(again.status, 200)
  const item = find(await list(), c.id)
  assert.strictEqual(item.rev, 2)
  assert.strictEqual(item.name, 'Renamed')
  assert.deepStrictEqual(item.tags, ['Prod', 'batch'])
  assert.strictEqual(item.groupId, group.id)

  const reset = await patch(c.id, { name: '   ', groupId: null })
  assert.strictEqual(reset.json.name, null)
  assert.strictEqual(reset.json.groupId, null)
})

test('PATCH validation', async () => {
  const c = await mintPushed(ctx.base, minimalGraph)
  const bad = [
    { name: 'x'.repeat(121) }, { name: 5 }, { tags: 'a' }, { tags: ['x'.repeat(33)] },
    { tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }, { tags: ['a\nb'] }, { groupId: 'nope' }, { groupId: 7 },
    { colour: 'red' }, {}, { name: 'ok', extra: 1 },
  ]
  for (const body of bad) {
    const res = await patch(c.id, body)
    assert.strictEqual(res.status, 400, JSON.stringify(body))
    assert.strictEqual(errorCode(res), 'INVALID_REQUEST')
  }
  const notObject = await api(ctx.base, `/api/library/canvases/${c.id}`, { method: 'PATCH', body: [] })
  assert.strictEqual(notObject.status, 400)
  const unknown = await patch('u'.repeat(22), { name: 'x' })
  assert.strictEqual(unknown.status, 404)
  const unpushed = (await api(ctx.base, '/api/canvas', { method: 'POST' })).json
  assert.strictEqual((await patch(unpushed.id, { name: 'x' })).status, 404)
})

test('markup-shaped names and tags are stored and returned literally', async () => {
  const c = await mintPushed(ctx.base, minimalGraph)
  const evil = '<img src=x onerror=alert(1)>'
  const res = await patch(c.id, { name: evil, tags: [evil] })
  assert.strictEqual(res.status, 200)
  const item = find(await list(), c.id)
  assert.strictEqual(item.name, evil)
  assert.deepStrictEqual(item.tags, [evil])
})

test('concurrent patches of different fields both persist', async () => {
  const c = await mintPushed(ctx.base, minimalGraph)
  const [a, b] = await Promise.all([patch(c.id, { name: 'Both' }), patch(c.id, { tags: ['one'] })])
  assert.strictEqual(a.status, 200)
  assert.strictEqual(b.status, 200)
  const item = find(await list(), c.id)
  assert.strictEqual(item.name, 'Both')
  assert.deepStrictEqual(item.tags, ['one'])
})

test('groups: create, list, rename, move, and reject bad names and parents', async () => {
  const parent = await newGroup('Parent')
  assert.strictEqual(parent.status, 201)
  assert.deepStrictEqual(Object.keys(parent.json).sort(), ['id', 'name', 'parentId'])
  const child = (await newGroup('Child', parent.json.id)).json
  assert.strictEqual(child.parentId, parent.json.id)
  const library = await list()
  assert.ok(library.groups.some((g) => g.id === child.id && g.parentId === parent.json.id))

  const renamed = await api(ctx.base, `/api/library/groups/${child.id}`, { method: 'PATCH', body: { name: 'Kid' } })
  assert.strictEqual(renamed.json.name, 'Kid')
  const moved = await api(ctx.base, `/api/library/groups/${child.id}`, { method: 'PATCH', body: { parentId: null } })
  assert.strictEqual(moved.json.parentId, null)

  for (const body of [{ name: '' }, { name: 'x'.repeat(81) }, { name: 'a\nb' }, {}, { name: 'ok', parentId: 'nope' }, { name: 'ok', parentId: 3 }, { name: 'ok', extra: 1 }]) {
    const res = await api(ctx.base, '/api/library/groups', { method: 'POST', body })
    assert.strictEqual(res.status, 400, JSON.stringify(body))
  }
  assert.strictEqual((await api(ctx.base, '/api/library/groups/nope', { method: 'PATCH', body: { name: 'x' } })).status, 404)
})

test('groups reject cycles and nesting deeper than 8, including a moved subtree', async () => {
  const chain = []
  for (let i = 1; i <= 6; i++) chain.push((await newGroup(`c${i}`, i === 1 ? undefined : chain[i - 2].id)).json)
  const x = (await newGroup('x')).json
  const y = (await newGroup('y', x.id)).json
  await newGroup('z', y.id)
  const move = (id, parentId) => api(ctx.base, `/api/library/groups/${id}`, { method: 'PATCH', body: { parentId } })

  assert.strictEqual((await move(chain[0].id, chain[0].id)).status, 400)
  assert.strictEqual((await move(chain[0].id, chain[5].id)).status, 400)
  assert.strictEqual((await move(x.id, chain[5].id)).status, 400)
  assert.strictEqual((await move(x.id, chain[4].id)).status, 200)

  let parent = chain[5]
  for (let depth = 7; depth <= 8; depth++) parent = (await newGroup(`d${depth}`, parent.id)).json
  const tooDeep = await newGroup('d9', parent.id)
  assert.strictEqual(tooDeep.status, 400)
})

test('deleting a group moves its sub-groups and diagrams up a level', async () => {
  const top = (await newGroup('Top')).json
  const mid = (await newGroup('Mid', top.id)).json
  const leaf = (await newGroup('Leaf', mid.id)).json
  const c = await mintPushed(ctx.base, minimalGraph)
  await patch(c.id, { groupId: mid.id })

  const del = await api(ctx.base, `/api/library/groups/${mid.id}`, { method: 'DELETE' })
  assert.deepStrictEqual(del.json, { id: mid.id, deleted: true })
  let library = await list()
  assert.strictEqual(library.groups.find((g) => g.id === leaf.id).parentId, top.id)
  assert.strictEqual(find(library, c.id).groupId, top.id)
  assert.ok(!library.groups.some((g) => g.id === mid.id))

  await api(ctx.base, `/api/library/groups/${top.id}`, { method: 'DELETE' })
  library = await list()
  assert.strictEqual(library.groups.find((g) => g.id === leaf.id).parentId, null)
  assert.strictEqual(find(library, c.id).groupId, null)
  assert.strictEqual((await api(ctx.base, `/api/library/groups/${top.id}`, { method: 'DELETE' })).status, 404)
})

test('library responses are not cacheable', async () => {
  const res = await api(ctx.base, '/api/library')
  assert.strictEqual(res.headers.get('cache-control'), 'no-store')
})
