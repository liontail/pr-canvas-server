import test from 'node:test'
import assert from 'node:assert'
import { parseHash, serializeHash } from '../src/lib/hash.js'

test('parses the camera fragment', () => {
  assert.deepStrictEqual(parseHash('#v=433,184,1.469'), {
    view: { x: 433, y: 184, zoom: 1.469 }, step: null, w: null,
  })
})

test('parses a step, and a step with the edit token', () => {
  assert.strictEqual(parseHash('#s=2').step, 2)
  const both = parseHash('#w=abc_DEF-123&s=3')
  assert.strictEqual(both.step, 3)
  assert.strictEqual(both.w, 'abc_DEF-123')
})

test('garbage and out-of-range fragments parse to nulls', () => {
  for (const hash of ['', '#', '#v=1,2', '#v=NaN,1,1', '#v=1,2,0', '#v=1,2,-1', '#v=a,b,c', '#s=0', '#s=abc', '#s=-1', '#s=1.5', '#zzz']) {
    const parsed = parseHash(hash)
    assert.strictEqual(parsed.view, null, hash)
    assert.strictEqual(parsed.step, null, hash)
  }
})

test('serialises rounded camera, step first, and keeps the token only when given', () => {
  assert.strictEqual(serializeHash({ view: { x: 433.4, y: 184.2, zoom: 1.4694 } }), '#v=433,184,1.469')
  assert.strictEqual(serializeHash({ step: 2 }), '#s=2')
  assert.strictEqual(serializeHash({ step: 2, view: { x: 1, y: 2, zoom: 1 } }), '#s=2')
  assert.strictEqual(serializeHash({ view: { x: 1, y: 2, zoom: 1 }, w: 'tok' }), '#v=1,2,1&w=tok')
  assert.strictEqual(serializeHash({}), '')
  assert.strictEqual(serializeHash({ w: 'tok' }), '#w=tok')
})

test('round-trips', () => {
  const view = { x: 12, y: -40, zoom: 0.5 }
  assert.deepStrictEqual(parseHash(serializeHash({ view, w: 'tok' })), { view, step: null, w: 'tok' })
})

test('rejects v values with empty parts', () => {
  const hashes = ['#v=1,,3', '#v=,2,3', '#v=1,2,', '#v= ,2,3']
  for (const hash of hashes) {
    const parsed = parseHash(hash)
    assert.strictEqual(parsed.view, null, hash)
  }
})

test('rejects v values with zoom outside [0.1, 4]', () => {
  const hashes = ['#v=1,2,1e9', '#v=1,2,1e-320', '#v=1,2,4.5', '#v=1,2,0.05']
  for (const hash of hashes) {
    const parsed = parseHash(hash)
    assert.strictEqual(parsed.view, null, hash)
  }
})

test('rejects v values with extreme x or y coordinates', () => {
  const hashes = ['#v=1e300,2,1', '#v=1,-1e300,1']
  for (const hash of hashes) {
    const parsed = parseHash(hash)
    assert.strictEqual(parsed.view, null, hash)
  }
})

test('accepts v values with zoom at boundaries and reasonable coordinates', () => {
  const tests = [
    ['#v=1,2,4', { x: 1, y: 2, zoom: 4 }],
    ['#v=1,2,0.1', { x: 1, y: 2, zoom: 0.1 }],
    ['#v=-5000,9000,1', { x: -5000, y: 9000, zoom: 1 }],
  ]
  for (const [hash, expected] of tests) {
    const parsed = parseHash(hash)
    assert.deepStrictEqual(parsed.view, expected, hash)
  }
})
