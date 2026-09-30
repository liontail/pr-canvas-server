const test = require('node:test')
const assert = require('node:assert')
const { payloadGraph } = require('@coldtea/pr-lens-schema/examples')
const { startTestApp, api, mintPushed } = require('./helpers')

let ctx
test.before(async () => { ctx = await startTestApp() })
test.after(async () => { await ctx.close() })

test('push and fetch responses carry hits on every tile', async () => {
  const c = await mintPushed(ctx.base, payloadGraph)
  assert.strictEqual(c.pushed.status, 200)
  const fetched = await api(ctx.base, `/api/canvas/${c.id}`)
  for (const res of [c.pushed, fetched]) {
    assert.ok(res.json.tiles.length > 0)
    for (const tile of res.json.tiles) {
      assert.ok(tile.hits && tile.hits.nodes && tile.hits.edges && tile.hits.messages, tile.id)
    }
    const flowTile = res.json.tiles.find((t) => t.id === 'view:send-pipeline-view')
    assert.strictEqual(Object.keys(flowTile.hits.messages['send-pipeline']).length, 7)
  }
})
