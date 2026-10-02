import test from 'node:test'
import assert from 'node:assert'
import { locateCitation, parseCitations, selectionHint } from '../src/lib/cite.js'

const doc = {
  nodes: [{ id: 'api', label: 'API' }],
  flows: [{ id: 'send', title: 'Send flow', messages: [{ id: 'm1', label: 'POST /send' }] }],
  views: [{ id: 'overview', title: 'Overview' }],
}

test('valid markers become refs labelled by the item; text around them is kept', () => {
  const parts = parseCitations('See [[component:api]] then [[message:send/m1]] in [[diagram:overview]].', doc)
  assert.deepStrictEqual(parts, [
    { text: 'See ' },
    { text: 'API', ref: { kind: 'component', id: 'api' } },
    { text: ' then ' },
    { text: 'POST /send', ref: { kind: 'message', id: 'send/m1' } },
    { text: ' in ' },
    { text: 'Overview', ref: { kind: 'diagram', id: 'overview' } },
    { text: '.' },
  ])
})

test('a flow id is a valid diagram citation', () => {
  assert.deepStrictEqual(parseCitations('[[diagram:send]]', doc), [{ text: 'Send flow', ref: { kind: 'diagram', id: 'send' } }])
})

test('unknown ids and malformed markers stay as plain text', () => {
  const text = 'a [[component:ghost]] b [[message:send]] c [[message:send/zzz]] d [[nope:api]]'
  assert.deepStrictEqual(parseCitations(text, doc), [{ text }])
})

test('a document without flows or views does not throw', () => {
  assert.deepStrictEqual(parseCitations('[[message:a/b]] [[diagram:x]]', { nodes: [] }), [{ text: '[[message:a/b]] [[diagram:x]]' }])
  assert.deepStrictEqual(parseCitations('hi', null), [{ text: 'hi' }])
})

test('streaming hides a trailing half marker but not a finished one', () => {
  assert.deepStrictEqual(parseCitations('Look at [[comp', doc, true), [{ text: 'Look at ' }])
  assert.deepStrictEqual(parseCitations('Look at [[component:api]', doc, true), [{ text: 'Look at ' }])
  assert.deepStrictEqual(parseCitations('Look at [', doc, true), [{ text: 'Look at ' }])
  assert.deepStrictEqual(parseCitations('Look at [[component:api]]', doc, true), [
    { text: 'Look at ' },
    { text: 'API', ref: { kind: 'component', id: 'api' } },
  ])
  assert.deepStrictEqual(parseCitations('Look at [[comp', doc, false), [{ text: 'Look at [[comp' }])
})

const tiles = [
  { id: 'view:overview', width: 400, height: 300, hits: { nodes: { api: { x: 10, y: 20, width: 100, height: 50 } }, edges: {}, messages: {} } },
  { id: 'lens:flow', width: 500, height: 200, hits: { nodes: {}, edges: {}, messages: { send: { m1: { x: 5, y: 6, width: 300, height: 38 } } } } },
]
const positions = { 'view:overview': { x: 0, y: 0 }, 'lens:flow': { x: 1000, y: 100 } }

test('locate a component: world box is shifted by the tile origin, target is a probe-shaped node', () => {
  assert.deepStrictEqual(locateCitation({ kind: 'component', id: 'api' }, tiles, positions), {
    tileId: 'view:overview',
    world: { x: 10, y: 20, width: 100, height: 50 },
    target: { kind: 'node', id: 'api', box: { x: 10, y: 20, width: 100, height: 50 }, tileId: 'view:overview' },
  })
})

test('locate a message in a flow tile', () => {
  assert.deepStrictEqual(locateCitation({ kind: 'message', id: 'send/m1' }, tiles, positions), {
    tileId: 'lens:flow',
    world: { x: 1005, y: 106, width: 300, height: 38 },
    target: { kind: 'message', flow: 'send', id: 'm1', box: { x: 5, y: 6, width: 300, height: 38 }, tileId: 'lens:flow' },
  })
})

test('locate a diagram by view tile id, or by the tile that draws the flow; target is null', () => {
  assert.deepStrictEqual(locateCitation({ kind: 'diagram', id: 'overview' }, tiles, positions), {
    tileId: 'view:overview', world: { x: 0, y: 0, width: 400, height: 300 }, target: null,
  })
  assert.strictEqual(locateCitation({ kind: 'diagram', id: 'send' }, tiles, positions).tileId, 'lens:flow')
})

test('locate returns null when nothing draws the id', () => {
  assert.strictEqual(locateCitation({ kind: 'component', id: 'ghost' }, tiles, positions), null)
  assert.strictEqual(locateCitation({ kind: 'message', id: 'send' }, tiles, positions), null)
})

test('selectionHint maps probe targets to API places', () => {
  assert.deepStrictEqual(selectionHint({ kind: 'node', id: 'api' }), { kind: 'component', id: 'api' })
  assert.deepStrictEqual(selectionHint({ kind: 'message', flow: 'send', id: 'm1' }), { kind: 'message', id: 'send/m1' })
  assert.strictEqual(selectionHint({ kind: 'edge', id: 'e' }), null)
  assert.strictEqual(selectionHint(null), null)
})
