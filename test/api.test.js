const test = require('node:test')
const assert = require('node:assert')
const http = require('node:http')
const { postmarkRefactorGraph } = require('@coldtea/pr-lens-schema/examples')
const { startTestApp, api, mintPushed } = require('./helpers')

const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/
let ctx
test.before(async () => { ctx = await startTestApp() })
test.after(async () => { await ctx.close() })

const put = (c, body, opts = {}) => api(ctx.base, `/api/canvas/${c.id}`, {
  method: 'PUT', token: c.writeToken, ifMatch: 0, body, ...opts,
})

test('mint returns secrets, links and sets no-store', async () => {
  const res = await api(ctx.base, '/api/canvas', { method: 'POST' })
  assert.strictEqual(res.status, 201)
  assert.strictEqual(res.headers.get('cache-control'), 'no-store')
  const { id, writeToken, rev, viewUrl, editUrl, embedUrl } = res.json
  assert.match(id, TOKEN_RE)
  assert.match(writeToken, TOKEN_RE)
  assert.strictEqual(rev, 0)
  assert.strictEqual(viewUrl, `http://canvas.test/c/${id}`)
  assert.strictEqual(editUrl, `${viewUrl}#w=${writeToken}`)
  assert.strictEqual(embedUrl, `${viewUrl}.svg`)
})

test('mint ignores the install header and an account Authorization header', async () => {
  const res = await api(ctx.base, '/api/canvas', {
    method: 'POST',
    headers: { 'x-pr-lens-install': 'prl_i_abc', authorization: 'Bearer prl_u_whatever' },
  })
  assert.strictEqual(res.status, 201)
})

test('fetch of an unpushed or unknown canvas is NOT_FOUND in the error envelope', async () => {
  const minted = (await api(ctx.base, '/api/canvas', { method: 'POST' })).json
  for (const id of [minted.id, 'k'.repeat(22)]) {
    const res = await api(ctx.base, `/api/canvas/${id}`)
    assert.strictEqual(res.status, 404)
    assert.strictEqual(res.json.error.code, 'NOT_FOUND')
    assert.strictEqual(typeof res.json.error.message, 'string')
  }
})

test('push then fetch: rev 1, four tiles with one hero, same document', async () => {
  const c = await mintPushed(ctx.base, postmarkRefactorGraph)
  assert.strictEqual(c.pushed.status, 200)
  assert.strictEqual(c.pushed.json.rev, 1)
  assert.strictEqual(c.pushed.json.editUrl, `http://canvas.test/c/${c.id}#w=${c.writeToken}`)
  assert.strictEqual(c.pushed.json.tiles.length, 4)

  const fetched = await api(ctx.base, `/api/canvas/${c.id}`)
  assert.strictEqual(fetched.status, 200)
  assert.strictEqual(fetched.json.rev, 1)
  assert.deepStrictEqual(fetched.json.document, postmarkRefactorGraph)
  assert.strictEqual(fetched.json.tiles.filter((t) => t.hero).length, 1)
  assert.strictEqual(fetched.json.embedUrl, `http://canvas.test/c/${c.id}.svg`)
})

test('a quoted If-Match is tolerated and advances the rev', async () => {
  const c = await mintPushed(ctx.base, postmarkRefactorGraph)
  const res = await put(c, postmarkRefactorGraph, { ifMatch: '"1"' })
  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.json.rev, 2)
})

test('a stale If-Match is REVISION_MOVED with the current rev', async () => {
  const c = await mintPushed(ctx.base, postmarkRefactorGraph)
  const res = await put(c, postmarkRefactorGraph, { ifMatch: 0 })
  assert.strictEqual(res.status, 409)
  assert.strictEqual(res.json.error.code, 'REVISION_MOVED')
  assert.strictEqual(res.json.error.rev, 1)
})

test('odd If-Match values are INVALID_REQUEST, never a crash', async () => {
  const c = await api(ctx.base, '/api/canvas', { method: 'POST' }).then((r) => r.json)
  for (const value of ['abc', '-1', '1.5', '*', '']) {
    const res = await put(c, postmarkRefactorGraph, { ifMatch: value })
    assert.strictEqual(res.status, 400, `If-Match: "${value}"`)
    assert.strictEqual(res.json.error.code, 'INVALID_REQUEST')
  }
  const missing = await api(ctx.base, `/api/canvas/${c.id}`, {
    method: 'PUT', token: c.writeToken, body: postmarkRefactorGraph,
  })
  assert.strictEqual(missing.status, 400)
})

test('missing or wrong write token and unknown id are all NOT_FOUND', async () => {
  const c = await api(ctx.base, '/api/canvas', { method: 'POST' }).then((r) => r.json)
  const none = await api(ctx.base, `/api/canvas/${c.id}`, { method: 'PUT', ifMatch: 0, body: {} })
  assert.strictEqual(none.status, 404)
  assert.strictEqual(none.json.error.code, 'NOT_FOUND')
  const wrong = await put({ id: c.id, writeToken: 'w'.repeat(22) }, postmarkRefactorGraph)
  assert.strictEqual(wrong.status, 404)
  assert.strictEqual(wrong.json.error.code, 'NOT_FOUND')
  const unknown = await put({ id: 'u'.repeat(22), writeToken: c.writeToken }, postmarkRefactorGraph)
  assert.strictEqual(unknown.status, 404)
})

test('a lowercase bearer scheme works; a junk Authorization header is 404, not 500', async () => {
  const c = await api(ctx.base, '/api/canvas', { method: 'POST' }).then((r) => r.json)
  const lower = await put(c, postmarkRefactorGraph, { token: undefined, headers: { authorization: `bearer ${c.writeToken}` } })
  assert.strictEqual(lower.status, 200)
  for (const authorization of ['Bearer', 'Bearer ', 'Basic abc', 'x'.repeat(5000)]) {
    const res = await put(c, postmarkRefactorGraph, { token: undefined, ifMatch: 1, headers: { authorization } })
    assert.strictEqual(res.status, 404, authorization.slice(0, 20))
  }
})

test('an invalid document is INVALID_DOCUMENT and leaves the canvas untouched', async () => {
  const c = await api(ctx.base, '/api/canvas', { method: 'POST' }).then((r) => r.json)
  for (const body of [{ kind: 'graph' }, []]) {
    const res = await put(c, body)
    assert.strictEqual(res.status, 422)
    assert.strictEqual(res.json.error.code, 'INVALID_DOCUMENT')
  }
  assert.strictEqual((await api(ctx.base, `/api/canvas/${c.id}`)).status, 404)
})

test('INVALID_DOCUMENT carries the validator issues', async () => {
  const c = await api(ctx.base, '/api/canvas', { method: 'POST' }).then((r) => r.json)
  const res = await put(c, { kind: 'graph' })
  const { issues } = res.json.error
  assert.ok(Array.isArray(issues) && issues.length > 0)
  for (const issue of issues) {
    for (const key of ['code', 'path', 'message']) assert.strictEqual(typeof issue[key], 'string', key)
  }
})

test('a non-JSON or malformed body is INVALID_REQUEST', async () => {
  const c = await api(ctx.base, '/api/canvas', { method: 'POST' }).then((r) => r.json)
  const plain = await put(c, undefined, { raw: 'hello', headers: { 'content-type': 'text/plain' } })
  assert.strictEqual(plain.status, 400)
  assert.strictEqual(plain.json.error.code, 'INVALID_REQUEST')
  const broken = await put(c, undefined, { raw: '{"a":', headers: { 'content-type': 'application/json' } })
  assert.strictEqual(broken.status, 400)
  assert.strictEqual(broken.json.error.code, 'INVALID_REQUEST')
})

test('a body over 10,000,000 bytes is TOO_LARGE', async () => {
  const url = new URL(ctx.base)
  const result = await new Promise((resolve, reject) => {
    const req = http.request({
      host: url.hostname, port: url.port, path: '/api/canvas/whatever', method: 'PUT',
      headers: { 'content-type': 'application/json', 'content-length': '10000001' },
    }, (res) => {
      let text = ''
      res.on('data', (d) => { text += d })
      res.on('end', () => { resolve({ status: res.statusCode, json: JSON.parse(text) }); req.destroy() })
    })
    req.on('error', reject)
    req.write('{"a":')
  })
  assert.strictEqual(result.status, 413)
  assert.strictEqual(result.json.error.code, 'TOO_LARGE')
})

test('rotate: new token works, old one is rejected, replay and self-rotation are ok', async () => {
  const c = await mintPushed(ctx.base, postmarkRefactorGraph)
  const next = 'n'.repeat(22)
  const rotated = await api(ctx.base, `/api/canvas/${c.id}/rotate`, { method: 'POST', token: c.writeToken, body: { writeToken: next } })
  assert.strictEqual(rotated.status, 200)
  assert.strictEqual(rotated.json.editUrl, `http://canvas.test/c/${c.id}#w=${next}`)

  const old = await put({ id: c.id, writeToken: c.writeToken }, postmarkRefactorGraph, { ifMatch: 1 })
  assert.strictEqual(old.status, 404)
  const fresh = await put({ id: c.id, writeToken: next }, postmarkRefactorGraph, { ifMatch: 1 })
  assert.strictEqual(fresh.status, 200)

  const replay = await api(ctx.base, `/api/canvas/${c.id}/rotate`, { method: 'POST', token: c.writeToken, body: { writeToken: next } })
  assert.strictEqual(replay.status, 200)
  const self = await api(ctx.base, `/api/canvas/${c.id}/rotate`, { method: 'POST', token: next, body: { writeToken: next } })
  assert.strictEqual(self.status, 200)
  const unknown = await api(ctx.base, `/api/canvas/${'r'.repeat(22)}/rotate`, { method: 'POST', token: next, body: { writeToken: next } })
  assert.strictEqual(unknown.status, 404)
  const stranger = await api(ctx.base, `/api/canvas/${c.id}/rotate`, { method: 'POST', token: 'w'.repeat(22), body: { writeToken: 'z'.repeat(22) } })
  assert.strictEqual(stranger.status, 404)
})

test('rotate rejects malformed and injection-shaped writeToken bodies', async () => {
  const c = await api(ctx.base, '/api/canvas', { method: 'POST' }).then((r) => r.json)
  for (const writeToken of ['short', 12345, { $ne: '' }, ['x'.repeat(22)], null, undefined]) {
    const res = await api(ctx.base, `/api/canvas/${c.id}/rotate`, { method: 'POST', token: c.writeToken, body: { writeToken } })
    assert.strictEqual(res.status, 400, JSON.stringify(writeToken))
    assert.strictEqual(res.json.error.code, 'INVALID_REQUEST')
  }
  const noBody = await api(ctx.base, `/api/canvas/${c.id}/rotate`, { method: 'POST', token: c.writeToken })
  assert.strictEqual(noBody.status, 400)
})

test('delete needs the write token and removes the canvas', async () => {
  const c = await mintPushed(ctx.base, postmarkRefactorGraph)
  const wrong = await api(ctx.base, `/api/canvas/${c.id}`, { method: 'DELETE', token: 'w'.repeat(22) })
  assert.strictEqual(wrong.status, 404)
  const ok = await api(ctx.base, `/api/canvas/${c.id}`, { method: 'DELETE', token: c.writeToken })
  assert.strictEqual(ok.status, 200)
  assert.deepStrictEqual(ok.json, { id: c.id, deleted: true })
  assert.strictEqual((await api(ctx.base, `/api/canvas/${c.id}`)).status, 404)
  const again = await api(ctx.base, `/api/canvas/${c.id}`, { method: 'DELETE', token: c.writeToken })
  assert.strictEqual(again.status, 404)
})

test('odd ids in the path are NOT_FOUND, never a match', async () => {
  for (const id of ['%00', 'a'.repeat(3000), '%7B%22%24ne%22%3A1%7D', '..%2F..%2Fetc']) {
    const res = await api(ctx.base, `/api/canvas/${id}`)
    assert.strictEqual(res.status, 404, id.slice(0, 20))
    assert.strictEqual(res.json.error.code, 'NOT_FOUND')
  }
})

test('optional and unknown routes answer with the JSON NOT_FOUND envelope', async () => {
  for (const path of ['/api/canvases', '/api/nope']) {
    const res = await api(ctx.base, path)
    assert.strictEqual(res.status, 404, path)
    assert.strictEqual(res.json.error.code, 'NOT_FOUND')
  }
  const claim = await api(ctx.base, `/api/canvas/${'c'.repeat(22)}/claim`, { method: 'POST', body: {} })
  assert.strictEqual(claim.status, 404)
})

test('mint is rate limited with RATE_LIMITED and retryAt', async () => {
  const limited = await startTestApp({ mintRateLimit: 2 })
  try {
    assert.strictEqual((await api(limited.base, '/api/canvas', { method: 'POST' })).status, 201)
    assert.strictEqual((await api(limited.base, '/api/canvas', { method: 'POST' })).status, 201)
    const res = await api(limited.base, '/api/canvas', { method: 'POST' })
    assert.strictEqual(res.status, 429)
    assert.strictEqual(res.json.error.code, 'RATE_LIMITED')
    assert.ok(!Number.isNaN(Date.parse(res.json.error.retryAt)))
  } finally {
    await limited.close()
  }
})
