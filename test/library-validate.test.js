const test = require('node:test')
const assert = require('node:assert')
const { ApiError } = require('../src/errors')
const v = require('../src/library-validate')

const rejects = (fn) => assert.throws(fn, (err) => err instanceof ApiError && err.code === 'INVALID_REQUEST' && err.status === 400)

test('normalizeName trims, resets empty to null and enforces limits', () => {
  assert.strictEqual(v.normalizeName('  My diagram  '), 'My diagram')
  assert.strictEqual(v.normalizeName('   '), null)
  assert.strictEqual(v.normalizeName(''), null)
  assert.strictEqual(v.normalizeName(null), null)
  assert.strictEqual(v.normalizeName('x'.repeat(120)), 'x'.repeat(120))
  rejects(() => v.normalizeName('x'.repeat(121)))
  rejects(() => v.normalizeName(5))
  rejects(() => v.normalizeName(undefined))
  rejects(() => v.normalizeName('a\nb'))
  rejects(() => v.normalizeName('a\u0000b'))
})

test('markup-shaped names are accepted as plain text', () => {
  assert.strictEqual(v.normalizeName('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>')
})

test('normalizeTags trims, collapses spaces and dedupes case-insensitively keeping the first casing', () => {
  assert.deepStrictEqual(v.normalizeTags(['  Foo  bar ', 'foo BAR', 'baz']), ['Foo bar', 'baz'])
  assert.deepStrictEqual(v.normalizeTags([]), [])
})

test('normalizeTags rejects bad input', () => {
  rejects(() => v.normalizeTags('a'))
  rejects(() => v.normalizeTags([1]))
  rejects(() => v.normalizeTags(['']))
  rejects(() => v.normalizeTags(['   ']))
  rejects(() => v.normalizeTags(['x'.repeat(33)]))
  rejects(() => v.normalizeTags(['a\tb']))
  rejects(() => v.normalizeTags(Array.from({ length: 21 }, (_, i) => `t${i}`)))
  assert.strictEqual(v.normalizeTags(Array.from({ length: 20 }, (_, i) => `t${i}`)).length, 20)
  assert.strictEqual(v.normalizeTags(['x'.repeat(32)])[0].length, 32)
})

test('20 entries that dedupe below the limit are fine, 21 distinct are not', () => {
  assert.deepStrictEqual(v.normalizeTags(Array.from({ length: 30 }, () => 'same')), ['same'])
})

test('normalizeGroupName requires a trimmed 1-80 char string without control characters', () => {
  assert.strictEqual(v.normalizeGroupName('  Team A '), 'Team A')
  rejects(() => v.normalizeGroupName(''))
  rejects(() => v.normalizeGroupName('   '))
  rejects(() => v.normalizeGroupName('x'.repeat(81)))
  rejects(() => v.normalizeGroupName(null))
  rejects(() => v.normalizeGroupName('a\nb'))
  assert.strictEqual(v.normalizeGroupName('x'.repeat(80)).length, 80)
})

function chain (length) {
  const groups = []
  for (let i = 1; i <= length; i++) groups.push({ _id: `c${i}`, parentId: i === 1 ? null : `c${i - 1}` })
  return groups
}

test('checkPlacement allows top level and rejects a missing parent', () => {
  v.checkPlacement(chain(2), null, null)
  v.checkPlacement(chain(2), 'c2', null)
  rejects(() => v.checkPlacement(chain(2), null, 'nope'))
})

test('checkPlacement rejects moving into itself or a descendant', () => {
  rejects(() => v.checkPlacement(chain(3), 'c1', 'c1'))
  rejects(() => v.checkPlacement(chain(3), 'c1', 'c3'))
  v.checkPlacement(chain(3), 'c3', 'c1')
})

test('checkPlacement enforces the depth limit of 8 including the moved subtree', () => {
  v.checkPlacement(chain(7), null, 'c7')
  rejects(() => v.checkPlacement(chain(8), null, 'c8'))
  const groups = [...chain(6), { _id: 'x', parentId: null }, { _id: 'y', parentId: 'x' }, { _id: 'z', parentId: 'y' }]
  rejects(() => v.checkPlacement(groups, 'x', 'c6'))
  v.checkPlacement(groups, 'x', 'c5')
})

test('MAX_DEPTH is 8', () => {
  assert.strictEqual(v.MAX_DEPTH, 8)
})
