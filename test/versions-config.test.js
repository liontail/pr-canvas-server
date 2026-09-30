const test = require('node:test')
const assert = require('node:assert')
const { loadConfig } = require('../src/config')
const { parseRev } = require('../src/rev')

const base = { MONGODB_URI: 'mongodb://x', PUBLIC_BASE_URL: 'https://h' }

test('MAX_REVISIONS is read only when it is a positive integer', () => {
  assert.strictEqual(loadConfig({ ...base, MAX_REVISIONS: '20' }).maxRevisions, 20)
  for (const value of [undefined, '', '0', '-3', 'abc', '1.5']) {
    assert.ok(!('maxRevisions' in loadConfig({ ...base, MAX_REVISIONS: value })), String(value))
  }
})

test('parseRev accepts positive integers and rejects the rest', () => {
  assert.strictEqual(parseRev(undefined), null)
  assert.strictEqual(parseRev('7'), 7)
  for (const bad of ['abc', '0', '-1', '1.5', '', '01', '1234567890', ['1', '2']]) {
    assert.throws(() => parseRev(bad), (err) => err.code === 'INVALID_REQUEST', String(bad))
  }
})
