const test = require('node:test')
const assert = require('node:assert')
const { ApiError, notFound, errorHandler } = require('../src/errors')

function fakeRes () {
  return {
    headersSent: false,
    status (code) { this.code = code; return this },
    json (body) { this.body = body; return this },
  }
}

test('maps each documented code to its status', () => {
  const expected = {
    INVALID_REQUEST: 400, UNAUTHENTICATED: 401, NOT_OWNER: 403, NOT_FOUND: 404,
    REVISION_MOVED: 409, TOO_LARGE: 413, INVALID_DOCUMENT: 422, CANNOT_DRAW: 422, RATE_LIMITED: 429,
  }
  for (const [code, status] of Object.entries(expected)) {
    assert.strictEqual(new ApiError(code, 'm').status, status, code)
  }
})

test('serialises an ApiError with its extra fields', () => {
  const res = fakeRes()
  errorHandler(new ApiError('REVISION_MOVED', 'moved', { rev: 3 }), {}, res, () => {})
  assert.strictEqual(res.code, 409)
  assert.deepStrictEqual(res.body, { error: { code: 'REVISION_MOVED', message: 'moved', rev: 3 } })
})

test('notFound is a 404 NOT_FOUND', () => {
  const res = fakeRes()
  errorHandler(notFound(), {}, res, () => {})
  assert.strictEqual(res.code, 404)
  assert.strictEqual(res.body.error.code, 'NOT_FOUND')
})

test('body-parser too-large and parse errors map to TOO_LARGE / INVALID_REQUEST', () => {
  const big = fakeRes()
  errorHandler(Object.assign(new Error('x'), { type: 'entity.too.large', status: 413 }), {}, big, () => {})
  assert.strictEqual(big.code, 413)
  assert.strictEqual(big.body.error.code, 'TOO_LARGE')

  const bad = fakeRes()
  errorHandler(Object.assign(new Error('x'), { type: 'entity.parse.failed', status: 400 }), {}, bad, () => {})
  assert.strictEqual(bad.code, 400)
  assert.strictEqual(bad.body.error.code, 'INVALID_REQUEST')
})

test('unknown errors become a generic 500 without leaking the message', () => {
  const original = console.error
  console.error = () => {}
  try {
    const res = fakeRes()
    errorHandler(new Error('secret db detail'), {}, res, () => {})
    assert.strictEqual(res.code, 500)
    assert.strictEqual(res.body.error.code, 'INTERNAL')
    assert.ok(!JSON.stringify(res.body).includes('secret'))
  } finally {
    console.error = original
  }
})

test('delegates to next when headers were already sent', () => {
  const res = fakeRes()
  res.headersSent = true
  let passed
  errorHandler(new Error('late'), {}, res, (err) => { passed = err })
  assert.strictEqual(passed.message, 'late')
})
