const test = require('node:test')
const assert = require('node:assert')
const { minimalGraph, postmarkRefactorGraph, payloadGraph } = require('@coldtea/pr-lens-schema/examples')
const { startTestApp, api } = require('./helpers')

let ctx
test.before(async () => { ctx = await startTestApp() })
test.after(async () => { await ctx.close() })

async function pushed (docs) {
  const minted = (await api(ctx.base, '/api/canvas', { method: 'POST' })).json
  for (let rev = 0; rev < docs.length; rev++) {
    const res = await api(ctx.base, `/api/canvas/${minted.id}`, { method: 'PUT', token: minted.writeToken, ifMatch: rev, body: docs[rev] })
    assert.strictEqual(res.status, 200)
  }
  return minted
}

const count = (nodes, delta) => nodes.filter((node) => node.delta === delta).length

test('rev + base returns a diff document, its tiles and the base', async () => {
  const c = await pushed([minimalGraph, postmarkRefactorGraph, payloadGraph])
  const res = await api(ctx.base, `/api/canvas/${c.id}?rev=2&base=1`)
  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.json.rev, 2)
  assert.strictEqual(res.json.base, 1)
  assert.strictEqual(res.json.latestRev, 3)
  assert.strictEqual(count(res.json.document.nodes, 'added'), postmarkRefactorGraph.nodes.length)
  assert.strictEqual(count(res.json.document.nodes, 'removed'), minimalGraph.nodes.length)
  assert.ok(res.json.tiles.every((tile) => tile.images.light.includes(`/c/${c.id}/r/2/b/1/assets/`)))
  const asset = await api(ctx.base, new URL(res.json.tiles[0].images.light).pathname)
  assert.strictEqual(asset.status, 200)
  assert.ok(asset.text.includes('<svg'))
})

test('base without rev diffs the latest version; two equal documents are all unchanged', async () => {
  const c = await pushed([postmarkRefactorGraph, payloadGraph])
  const res = await api(ctx.base, `/api/canvas/${c.id}?base=1`)
  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.json.rev, 2)
  assert.strictEqual(res.json.base, 1)
  assert.ok(res.json.document.nodes.every((node) => node.delta === 'unchanged'))
})

test('plain reads carry no base', async () => {
  const c = await pushed([postmarkRefactorGraph])
  const res = await api(ctx.base, `/api/canvas/${c.id}`)
  assert.ok(!('base' in res.json))
})

test('base validation: same as rev, malformed and repeated are 400; unstored is 404', async () => {
  const c = await pushed([minimalGraph, postmarkRefactorGraph])
  for (const query of ['rev=2&base=2', 'base=2', 'rev=1&base=abc', 'rev=1&base=0', 'rev=1&base=1.5', 'rev=2&base=1&base=1']) {
    const res = await api(ctx.base, `/api/canvas/${c.id}?${query}`)
    assert.strictEqual(res.status, 400, query)
    assert.strictEqual(res.json.error.code, 'INVALID_REQUEST', query)
  }
  assert.strictEqual((await api(ctx.base, `/api/canvas/${c.id}?rev=2&base=9`)).status, 404)
  assert.strictEqual((await api(ctx.base, `/api/canvas/${c.id}?rev=9&base=1`)).status, 404)
})

test('the page and svg honour base and reject a bad one', async () => {
  const c = await pushed([minimalGraph, postmarkRefactorGraph])
  const page = await api(ctx.base, `/c/${c.id}?rev=2&base=1`)
  assert.strictEqual(page.status, 200)
  assert.ok(page.text.includes(`/c/${c.id}/r/2/b/1/assets/`))
  const svg = await api(ctx.base, `/c/${c.id}.svg?rev=2&base=1`)
  assert.strictEqual(svg.status, 200)
  assert.ok(svg.text.includes('NEW'))
  // the page is a shell, so a bad diff link still loads and the app shows the API error; the svg stays strict
  for (const query of ['rev=2&base=2', 'rev=2&base=9', 'rev=2&base=abc']) {
    assert.strictEqual((await api(ctx.base, `/c/${c.id}?${query}`)).status, 200, query)
    assert.strictEqual((await api(ctx.base, `/c/${c.id}.svg?${query}`)).status >= 400, true, query)
  }
  assert.strictEqual((await api(ctx.base, `/c/${'z'.repeat(22)}?base=1`)).status, 404)
  assert.strictEqual((await api(ctx.base, `/c/${c.id}/r/2/b/1/assets/nope.svg`)).status, 404)
})

test('library DELETE removes a canvas and its versions', async () => {
  const c = await pushed([minimalGraph, postmarkRefactorGraph])
  const other = await pushed([payloadGraph])
  const res = await api(ctx.base, `/api/library/canvases/${c.id}`, { method: 'DELETE' })
  assert.deepStrictEqual(res.json, { id: c.id, deleted: true })
  assert.strictEqual((await api(ctx.base, `/api/canvas/${c.id}`)).status, 404)
  assert.strictEqual((await api(ctx.base, `/api/canvas/${c.id}/versions`)).status, 404)
  const list = (await api(ctx.base, '/api/library')).json.canvases.map((item) => item.id)
  assert.ok(!list.includes(c.id))
  assert.ok(list.includes(other.id))
  assert.strictEqual((await api(ctx.base, `/api/library/canvases/${c.id}`, { method: 'DELETE' })).status, 404)
  const minted = (await api(ctx.base, '/api/canvas', { method: 'POST' })).json
  assert.strictEqual((await api(ctx.base, `/api/library/canvases/${minted.id}`, { method: 'DELETE' })).status, 404)
})

test('library DELETE of a version: middle, latest, only, malformed and missing', async () => {
  const c = await pushed([minimalGraph, postmarkRefactorGraph, payloadGraph])
  const middle = await api(ctx.base, `/api/library/canvases/${c.id}/versions/2`, { method: 'DELETE' })
  assert.deepStrictEqual(middle.json, { id: c.id, rev: 2, deleted: true, latestRev: 3 })
  assert.deepStrictEqual((await api(ctx.base, `/api/canvas/${c.id}/versions`)).json.versions.map((v) => v.rev), [3, 1])
  assert.strictEqual((await api(ctx.base, `/api/canvas/${c.id}?rev=2`)).status, 404)

  const latest = await api(ctx.base, `/api/library/canvases/${c.id}/versions/3`, { method: 'DELETE' })
  assert.deepStrictEqual(latest.json, { id: c.id, rev: 3, deleted: true, latestRev: 1 })
  const now = await api(ctx.base, `/api/canvas/${c.id}`)
  assert.strictEqual(now.json.rev, 1)
  assert.strictEqual(now.json.document.title, minimalGraph.title)

  const only = await api(ctx.base, `/api/library/canvases/${c.id}/versions/1`, { method: 'DELETE' })
  assert.strictEqual(only.status, 409)
  assert.strictEqual(only.json.error.code, 'LAST_VERSION')
  assert.strictEqual((await api(ctx.base, `/api/canvas/${c.id}`)).status, 200)

  for (const rev of ['abc', '0', '1.5']) {
    assert.strictEqual((await api(ctx.base, `/api/library/canvases/${c.id}/versions/${rev}`, { method: 'DELETE' })).status, 400, rev)
  }
  assert.strictEqual((await api(ctx.base, `/api/library/canvases/${c.id}/versions/9`, { method: 'DELETE' })).status, 404)
})

test('after deleting the latest a push at the promoted rev succeeds', async () => {
  const c = await pushed([minimalGraph, postmarkRefactorGraph])
  await api(ctx.base, `/api/library/canvases/${c.id}/versions/2`, { method: 'DELETE' })
  const res = await api(ctx.base, `/api/canvas/${c.id}`, { method: 'PUT', token: c.writeToken, ifMatch: 1, body: payloadGraph })
  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.json.rev, 2)
  assert.deepStrictEqual((await api(ctx.base, `/api/canvas/${c.id}/versions`)).json.versions.map((v) => v.rev), [2, 1])
})
