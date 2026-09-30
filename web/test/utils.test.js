import test from 'node:test'
import assert from 'node:assert'
import { cn } from '../src/lib/utils.js'

test('cn joins class names and drops falsy values', () => {
  assert.strictEqual(cn('a', false, null, undefined, 'b'), 'a b')
})

test('cn accepts arrays and objects', () => {
  assert.strictEqual(cn(['a', { b: true, c: false }], 'd'), 'a b d')
})

test('cn lets the later Tailwind class win', () => {
  assert.strictEqual(cn('px-2 py-1', 'px-4'), 'py-1 px-4')
})
