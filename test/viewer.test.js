const test = require('node:test')
const assert = require('node:assert')
const { postmarkRefactorGraph } = require('@coldtea/pr-lens-schema/examples')
const { startTestApp, api, mintPushed } = require('./helpers')
const { esc } = require('../src/viewer')

let ctx
let canvas
test.before(async () => {
  ctx = await startTestApp()
  canvas = await mintPushed(ctx.base, postmarkRefactorGraph)
})
test.after(async () => { await ctx.close() })

test('esc escapes HTML metacharacters', () => {
  assert.strictEqual(esc(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;')
})

test('viewer page is html with a light/dark picture and never inlines the document', async () => {
  const res = await api(ctx.base, `/c/${canvas.id}`)
  assert.strictEqual(res.status, 200)
  assert.match(res.headers.get('content-type'), /text\/html/)
  assert.match(res.text, /<picture>/)
  assert.match(res.text, new RegExp(`http://canvas.test/c/${canvas.id}/assets/overview-light-`))
  assert.match(res.text, new RegExp(`http://canvas.test/c/${canvas.id}/assets/overview-dark-`))
  assert.ok(!res.text.includes('schemaVersion'))
  assert.ok(!res.text.includes('provenance'))
})

test('.svg serves the hero image; ?theme=dark serves the dark one', async () => {
  const light = await api(ctx.base, `/c/${canvas.id}.svg`)
  assert.strictEqual(light.status, 200)
  assert.match(light.headers.get('content-type'), /image\/svg\+xml/)
  assert.ok(light.text.startsWith('<svg'))
  const dark = await api(ctx.base, `/c/${canvas.id}.svg?theme=dark`)
  assert.strictEqual(dark.status, 200)
  assert.notStrictEqual(dark.text, light.text)
})

test('unpushed, unknown and malformed ids are 404 on every viewer route', async () => {
  const minted = (await api(ctx.base, '/api/canvas', { method: 'POST' })).json
  for (const path of [
    `/c/${minted.id}`, `/c/${minted.id}.svg`, `/c/${'k'.repeat(22)}`, '/c/short', '/c/short.svg',
    `/c/${canvas.id}.png`, `/c/${minted.id}/assets/x.svg`,
  ]) {
    const res = await api(ctx.base, path)
    assert.strictEqual(res.status, 404, path)
  }
})

test('every tile image URL is served as an immutable svg; an unknown file is 404', async () => {
  const fetched = (await api(ctx.base, `/api/canvas/${canvas.id}`)).json
  for (const tile of fetched.tiles) {
    for (const theme of ['light', 'dark']) {
      const res = await api(ctx.base, new URL(tile.images[theme]).pathname)
      assert.strictEqual(res.status, 200, tile.images[theme])
      assert.match(res.headers.get('content-type'), /image\/svg\+xml/)
      assert.strictEqual(res.headers.get('cache-control'), 'public, max-age=31536000, immutable')
      assert.strictEqual(res.text, tile.renders[theme])
    }
  }
  const missing = await api(ctx.base, `/c/${canvas.id}/assets/nope.svg`)
  assert.strictEqual(missing.status, 404)
})

test('a deleted canvas disappears from the viewer', async () => {
  const c = await mintPushed(ctx.base, postmarkRefactorGraph)
  await api(ctx.base, `/api/canvas/${c.id}`, { method: 'DELETE', token: c.writeToken })
  assert.strictEqual((await api(ctx.base, `/c/${c.id}`)).status, 404)
  assert.strictEqual((await api(ctx.base, `/c/${c.id}.svg`)).status, 404)
})

test('hardening headers: nosniff everywhere, CSP on svg and assets', async () => {
  const csp = "default-src 'none'; style-src 'unsafe-inline'"
  const fetched = (await api(ctx.base, `/api/canvas/${canvas.id}`))
  assert.strictEqual(fetched.headers.get('x-content-type-options'), 'nosniff')
  const svg = await api(ctx.base, `/c/${canvas.id}.svg`)
  const asset = await api(ctx.base, new URL(fetched.json.tiles[0].images.light).pathname)
  for (const res of [svg, asset]) {
    assert.strictEqual(res.headers.get('content-security-policy'), csp)
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff')
  }
})
