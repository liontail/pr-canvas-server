import test from 'node:test'
import assert from 'node:assert'
import { applyTheme } from '../src/lib/theme.js'

function fakeRoot () {
  const calls = []
  return { calls, classList: { toggle: (name, on) => calls.push([name, on]) } }
}

test('dark adds the dark class and records the theme', () => {
  const root = fakeRoot()
  applyTheme('dark', root)
  assert.deepStrictEqual(root.calls, [['dark', true]])
})

test('light removes the dark class and records the theme', () => {
  const root = fakeRoot()
  applyTheme('light', root)
  assert.deepStrictEqual(root.calls, [['dark', false]])
})
