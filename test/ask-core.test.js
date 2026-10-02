const test = require('node:test')
const assert = require('node:assert')
const { serverIp, buildMessages, assertDocSize, createDailyCap, MAX_DOC_BYTES } = require('../src/ask')

const doc = { title: 'T', nodes: [{ id: 'a', label: 'A' }] }

test('buildMessages: system prompt first, graph and question only in the user message', () => {
  const [system, user] = buildMessages({ document: doc, question: 'what is A?', selected: null })
  assert.strictEqual(system.role, 'system')
  assert.strictEqual(user.role, 'user')
  assert.match(system.content, /\[\[component:ID\]\]/)
  assert.ok(!system.content.includes('what is A?'))
  assert.ok(user.content.includes(JSON.stringify(doc)))
  assert.ok(user.content.includes('what is A?'))
  assert.ok(!user.content.includes('Selected:'))
})

test('buildMessages: includes the selected place as a hint', () => {
  const [, user] = buildMessages({ document: doc, question: 'q', selected: { kind: 'component', id: 'a' } })
  assert.match(user.content, /Selected: component a/)
})

test('assertDocSize passes under the limit and throws TOO_LARGE over it', () => {
  assert.doesNotThrow(() => assertDocSize(doc))
  assert.throws(() => assertDocSize(doc, 10), (err) => err.code === 'TOO_LARGE' && err.status === 413)
  assert.strictEqual(MAX_DOC_BYTES, 200_000)
})

test('createDailyCap allows up to the limit per UTC day, then resets next day', () => {
  let now = Date.UTC(2026, 9, 2, 12)
  const cap = createDailyCap(2, () => now)
  assert.deepStrictEqual([cap.take(), cap.take(), cap.take()], [true, true, false])
  now = Date.UTC(2026, 9, 3, 0, 0, 1)
  assert.strictEqual(cap.take(), true)
})

test('serverIp: undefined or a non-loopback IPv4 address', () => {
  const ip = serverIp()
  if (ip === undefined) return
  assert.match(ip, /^\d{1,3}(\.\d{1,3}){3}$/)
  assert.ok(!ip.startsWith('127.'))
})
