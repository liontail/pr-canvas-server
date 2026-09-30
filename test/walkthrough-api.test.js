const test = require('node:test')
const assert = require('node:assert')
const { postmarkRefactorGraph } = require('@coldtea/pr-lens-schema/examples')
const { startTestApp, api, mintPushed } = require('./helpers')
const { foreignNode } = require('./fixtures')

let ctx
test.before(async () => { ctx = await startTestApp() })
test.after(async () => { await ctx.close() })

const brokenDoc = () => {
  const doc = JSON.parse(JSON.stringify(postmarkRefactorGraph))
  doc.walkthrough.steps[1].focus.nodes = [foreignNode(postmarkRefactorGraph)]
  return doc
}

test('push and fetch carry step geometry on the tiles', async () => {
  const c = await mintPushed(ctx.base, postmarkRefactorGraph)
  assert.strictEqual(c.pushed.status, 200)
  const ids = (res, tileId) => res.json.tiles.find((t) => t.id === tileId).steps.map((s) => s.id)
  assert.deepStrictEqual(ids(c.pushed, 'view:overview'), ['batches-of-500', 'old-path-goes-dark', 'blast-radius'])
  const fetched = await api(ctx.base, `/api/canvas/${c.id}`)
  assert.strictEqual(fetched.status, 200)
  assert.deepStrictEqual(ids(fetched, 'view:overview'), ['batches-of-500', 'old-path-goes-dark', 'blast-radius'])
  const step = fetched.json.tiles.find((t) => t.id === 'view:overview').steps[0]
  assert.ok(Array.isArray(step.rects) && step.rects.length === 3)
  assert.strictEqual(typeof step.bounds.width, 'number')
})

test('a step naming an element its diagram lacks is CANNOT_DRAW and nothing is stored', async () => {
  const minted = (await api(ctx.base, '/api/canvas', { method: 'POST' })).json
  const res = await api(ctx.base, `/api/canvas/${minted.id}`, {
    method: 'PUT', token: minted.writeToken, ifMatch: 0, body: brokenDoc(),
  })
  assert.strictEqual(res.status, 422)
  assert.strictEqual(res.json.error.code, 'CANNOT_DRAW')
  assert.match(res.json.error.message, /suppression-first/)
  assert.strictEqual((await api(ctx.base, `/api/canvas/${minted.id}`)).status, 404)
})

test('a stored canvas whose walkthrough no longer resolves still loads, minus that step', async () => {
  const minted = (await api(ctx.base, '/api/canvas', { method: 'POST' })).json
  await ctx.store.push(minted.id, minted.writeToken, 0, brokenDoc())
  const fetched = await api(ctx.base, `/api/canvas/${minted.id}`)
  assert.strictEqual(fetched.status, 200)
  const all = fetched.json.tiles.flatMap((t) => t.steps.map((s) => s.id))
  assert.ok(!all.includes('suppression-first'))
  assert.ok(all.includes('batches-of-500'))
  const viewer = await api(ctx.base, `/c/${minted.id}`)
  assert.strictEqual(viewer.status, 200)
})
