import test from 'node:test'
import assert from 'node:assert'
import { addTag, normalizeTag, removeTag } from '../src/lib/tags.js'

test('normalizeTag trims, collapses inner spaces and enforces 1-32 chars without control characters', () => {
  assert.strictEqual(normalizeTag('  hello   world '), 'hello world')
  assert.strictEqual(normalizeTag('x'.repeat(32)).length, 32)
  assert.strictEqual(normalizeTag('x'.repeat(33)), null)
  assert.strictEqual(normalizeTag('   '), null)
  assert.strictEqual(normalizeTag(''), null)
  assert.strictEqual(normalizeTag('a\tb'), null)
  assert.strictEqual(normalizeTag('<b>bold</b>'), '<b>bold</b>')
})

test('addTag appends, ignores duplicates case-insensitively and keeps the first casing', () => {
  assert.deepStrictEqual(addTag(['Prod'], ' staging '), ['Prod', 'staging'])
  const same = ['Prod']
  assert.strictEqual(addTag(same, 'prod'), same)
})

test('addTag ignores invalid text and refuses a 21st tag, returning the same array', () => {
  const tags = ['a']
  assert.strictEqual(addTag(tags, '  '), tags)
  const full = Array.from({ length: 20 }, (_, i) => `t${i}`)
  assert.strictEqual(addTag(full, 'extra'), full)
})

test('removeTag removes exactly that tag', () => {
  assert.deepStrictEqual(removeTag(['a', 'b', 'c'], 'b'), ['a', 'c'])
  assert.deepStrictEqual(removeTag(['a'], 'z'), ['a'])
})
