const test = require('node:test')
const assert = require('node:assert')
const { startTestApp, api } = require('./helpers')

let ctx
test.before(async () => { ctx = await startTestApp() })
test.after(async () => { await ctx.close() })

test('healthz is ok while the database answers', async () => {
  const res = await api(ctx.base, '/healthz')
  assert.strictEqual(res.status, 200)
  assert.deepStrictEqual(res.json, { status: 'ok' })
})

test('healthz is 503 when the database ping fails', async () => {
  const ping = ctx.store.ping
  ctx.store.ping = async () => { throw new Error('down') }
  try {
    const res = await api(ctx.base, '/healthz')
    assert.strictEqual(res.status, 503)
    assert.deepStrictEqual(res.json, { status: 'unavailable' })
  } finally {
    ctx.store.ping = ping
  }
})
