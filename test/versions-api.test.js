const test = require('node:test')
const assert = require('node:assert')
const { postmarkRefactorGraph, payloadGraph } = require('@coldtea/pr-lens-schema/examples')
const { startTestApp, api, mintPushed } = require('./helpers')

let ctx
let canvas
test.before(async () => {
  ctx = await startTestApp()
  canvas = await mintPushed(ctx.base, postmarkRefactorGraph)
  const second = await api(ctx.base, `/api/canvas/${canvas.id}`, {
    method: 'PUT', token: canvas.writeToken, ifMatch: 1, body: payloadGraph,
  })
  assert.strictEqual(second.status, 200)
})
test.after(async () => { await ctx.close() })

test('GET ?rev returns that version, latestRev is always present', async () => {
  const old = await api(ctx.base, `/api/canvas/${canvas.id}?rev=1`)
  assert.strictEqual(old.status, 200)
  assert.strictEqual(old.json.rev, 1)
  assert.strictEqual(old.json.latestRev, 2)
  assert.strictEqual(old.json.document.title, postmarkRefactorGraph.title)
  assert.ok(old.json.tiles.every((tile) => tile.images.light.includes(`/c/${canvas.id}/r/1/assets/`)))

  const latest = await api(ctx.base, `/api/canvas/${canvas.id}`)
  assert.strictEqual(latest.json.rev, 2)
  assert.strictEqual(latest.json.latestRev, 2)
  assert.strictEqual(latest.json.document.title, payloadGraph.title)
  assert.ok(latest.json.tiles.every((tile) => !tile.images.light.includes('/r/')))

  const same = await api(ctx.base, `/api/canvas/${canvas.id}?rev=2`)
  assert.deepStrictEqual(same.json.tiles, latest.json.tiles)
})

test('malformed rev is 400, an unstored rev is 404', async () => {
  for (const rev of ['abc', '0', '-1', '1.5', '1&rev=2']) {
    const res = await api(ctx.base, `/api/canvas/${canvas.id}?rev=${rev}`)
    assert.strictEqual(res.status, 400, rev)
    assert.strictEqual(res.json.error.code, 'INVALID_REQUEST')
  }
  const missing = await api(ctx.base, `/api/canvas/${canvas.id}?rev=3`)
  assert.strictEqual(missing.status, 404)
})

test('versions lists newest first with title and tile count', async () => {
  const res = await api(ctx.base, `/api/canvas/${canvas.id}/versions`)
  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.json.latestRev, 2)
  assert.deepStrictEqual(res.json.versions.map((v) => v.rev), [2, 1])
  assert.strictEqual(res.json.versions[0].title, payloadGraph.title)
  assert.strictEqual(res.json.versions[1].title, postmarkRefactorGraph.title)
  assert.strictEqual(typeof res.json.versions[0].tiles, 'number')
  assert.ok(!Number.isNaN(Date.parse(res.json.versions[0].createdAt)))
})

test('versions of a minted or unknown canvas is 404', async () => {
  const minted = (await api(ctx.base, '/api/canvas', { method: 'POST' })).json
  for (const id of [minted.id, 'q'.repeat(22)]) {
    assert.strictEqual((await api(ctx.base, `/api/canvas/${id}/versions`)).status, 404)
  }
})

test('the page and svg honour ?rev and old diagram files resolve', async () => {
  const page = await api(ctx.base, `/c/${canvas.id}?rev=1`)
  assert.strictEqual(page.status, 200)
  assert.ok(page.text.includes(`/c/${canvas.id}/r/1/assets/`))
  const latestPage = await api(ctx.base, `/c/${canvas.id}`)
  assert.ok(!latestPage.text.includes('/r/1/assets/'))
  assert.strictEqual((await api(ctx.base, `/c/${canvas.id}?rev=9`)).status, 404)
  assert.strictEqual((await api(ctx.base, `/c/${canvas.id}?rev=abc`)).status, 400)
  const svg = await api(ctx.base, `/c/${canvas.id}.svg?rev=1`)
  assert.strictEqual(svg.status, 200)
  assert.ok(svg.text.includes('<svg'))

  const old = await api(ctx.base, `/api/canvas/${canvas.id}?rev=1`)
  const url = new URL(old.json.tiles[0].images.light)
  const asset = await api(ctx.base, url.pathname)
  assert.strictEqual(asset.status, 200)
  assert.ok(asset.text.includes('<svg'))
  assert.strictEqual((await api(ctx.base, `/c/${canvas.id}/r/1/assets/nope.svg`)).status, 404)
  assert.strictEqual((await api(ctx.base, `/c/${canvas.id}/r/9/assets/${url.pathname.split('/').pop()}`)).status, 404)
})

test('library canvases carry a version count', async () => {
  const res = await api(ctx.base, '/api/library')
  const item = res.json.canvases.find((c) => c.id === canvas.id)
  assert.strictEqual(item.versions, 2)
  const patched = await api(ctx.base, `/api/library/canvases/${canvas.id}`, { method: 'PATCH', body: { tags: ['x'] } })
  assert.strictEqual(patched.json.versions, 2)
})

test('deleting a canvas removes its versions', async () => {
  const doomed = await mintPushed(ctx.base, postmarkRefactorGraph)
  assert.strictEqual((await api(ctx.base, `/api/canvas/${doomed.id}/versions`)).status, 200)
  assert.strictEqual((await api(ctx.base, `/api/canvas/${doomed.id}`, { method: 'DELETE', token: doomed.writeToken })).status, 200)
  assert.strictEqual((await api(ctx.base, `/api/canvas/${doomed.id}/versions`)).status, 404)
  assert.strictEqual((await api(ctx.base, `/api/canvas/${doomed.id}?rev=1`)).status, 404)
})
