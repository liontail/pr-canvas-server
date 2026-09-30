import test from 'node:test'
import assert from 'node:assert'
import { parseBase, previousRev, withVersion } from '../src/lib/versions.js'

test('parseBase reads a positive integer and ignores the rest', () => {
  assert.strictEqual(parseBase('?rev=3&base=2'), 2)
  for (const search of ['', '?base=0', '?base=abc', '?base=1.5', '?base=']) {
    assert.strictEqual(parseBase(search), null, search)
  }
})

test('withVersion sets rev and base, drops rev for the latest and base when null', () => {
  assert.strictEqual(withVersion('', { rev: 2, base: 1 }, 5), '?rev=2&base=1')
  assert.strictEqual(withVersion('?rev=2&base=1', { rev: 5, base: 4 }, 5), '?base=4')
  assert.strictEqual(withVersion('?rev=2&base=1', { rev: 2, base: null }, 5), '?rev=2')
  assert.strictEqual(withVersion('?rev=2&base=1', { rev: null, base: null }, 5), '')
  assert.strictEqual(withVersion('?a=1&rev=2', { rev: 3, base: 2 }, 5), '?a=1&rev=3&base=2')
})

test('previousRev is the next lower stored rev, or null', () => {
  const versions = [{ rev: 5 }, { rev: 3 }, { rev: 1 }]
  assert.strictEqual(previousRev(versions, 5), 3)
  assert.strictEqual(previousRev(versions, 3), 1)
  assert.strictEqual(previousRev(versions, 1), null)
  assert.strictEqual(previousRev(versions, 4), 3)
})
