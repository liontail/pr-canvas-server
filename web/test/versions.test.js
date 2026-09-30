import test from 'node:test'
import assert from 'node:assert'
import { parseRev, withRev, versionLabel } from '../src/lib/versions.js'

test('parseRev reads a positive integer and ignores the rest', () => {
  assert.strictEqual(parseRev('?rev=3'), 3)
  assert.strictEqual(parseRev('?x=1&rev=12'), 12)
  for (const search of ['', '?rev=0', '?rev=-1', '?rev=abc', '?rev=1.5', '?rev=']) {
    assert.strictEqual(parseRev(search), null, search)
  }
})

test('withRev sets the parameter, drops it for the latest, keeps other parameters', () => {
  assert.strictEqual(withRev('', 2, 5), '?rev=2')
  assert.strictEqual(withRev('?rev=2', 5, 5), '')
  assert.strictEqual(withRev('?rev=2', null, 5), '')
  assert.strictEqual(withRev('?a=1&rev=2', 3, 5), '?a=1&rev=3')
  assert.strictEqual(withRev('?a=1&rev=2', 5, 5), '?a=1')
})

test('versionLabel marks the latest and dates the others', () => {
  assert.strictEqual(versionLabel({ rev: 5, createdAt: '2026-09-30T10:00:00.000Z' }, 5), 'Latest (rev 5)')
  assert.match(versionLabel({ rev: 3, createdAt: '2026-09-30T10:00:00.000Z' }, 5), /^rev 3 · .+/)
})
