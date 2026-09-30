import test from 'node:test'
import assert from 'node:assert'
import { payloadGraph } from '@coldtea/pr-lens-schema/examples'
import { detailModel, diffPaths, fileText } from '../src/lib/detail.js'

const message = (id) => payloadGraph.flows[0].messages.find((m) => m.id === id)
const target = (id) => ({ kind: 'message', flow: 'send-pipeline', id })

test('a message model has route, kind, change and one section per payload side', () => {
  const m = message('enqueue')
  const model = detailModel(payloadGraph, target('enqueue'))
  assert.strictEqual(model.kind, 'message')
  assert.strictEqual(model.title, m.label)
  assert.deepStrictEqual(model.meta.slice(0, 3), [['Route', `${m.from} → ${m.to}`], ['Kind', m.kind], ['Change', m.delta]])
  assert.deepStrictEqual(model.sides.map((s) => s.name), ['Request', 'Response'])
  assert.strictEqual(model.sides[0].type, 'BroadcastJob')
  assert.strictEqual(model.sides[1].type, 'WriteResult')
})

test('a side exposes shape, pretty sample and before, and derives changed paths', () => {
  const m = message('enqueue')
  const [request] = detailModel(payloadGraph, target('enqueue')).sides
  assert.strictEqual(typeof request.shape, 'string')
  assert.deepStrictEqual(JSON.parse(request.sample), m.payload.request.sample)
  assert.deepStrictEqual(JSON.parse(request.before), m.payload.request.before)
  assert.ok(request.changedPaths.includes('batchSize'))
  assert.ok(request.changedPaths.includes('recipientCount'))
})

test('declared changedPaths win over the computed diff', () => {
  const doc = {
    flows: [{ id: 'f', messages: [{ id: 'm', from: 'a', to: 'b', label: 'L', kind: 'sync', delta: 'added', files: [], payload: { request: { type: 'T', sample: { a: 2 }, before: { a: 1 }, changedPaths: ['x'] } } }] }],
  }
  assert.deepStrictEqual(detailModel(doc, { kind: 'message', flow: 'f', id: 'm' }).sides[0].changedPaths, ['x'])
})

test('a repeated message shows how often, and a message without payload has no sides', () => {
  assert.ok(detailModel(payloadGraph, target('batch-post')).meta.some(([k, v]) => k === 'Repeats' && v === '4 per run'))
  assert.deepStrictEqual(detailModel(payloadGraph, target('suppressions-response')).sides, [])
})

test('a node model has kind, change, the lane label, badges and files as text', () => {
  const model = detailModel(payloadGraph, { kind: 'node', id: 'broadcast-composer' })
  assert.strictEqual(model.kind, 'node')
  assert.strictEqual(model.title, 'Broadcast composer')
  assert.ok(model.meta.some(([k, v]) => k === 'Lane' && v === 'Next.js'))
  assert.ok(model.meta.some(([k, v]) => k === 'Kind' && v === 'ui'))
  assert.deepStrictEqual(model.files, ['app/broadcasts/new/page.tsx'])
  assert.deepStrictEqual(model.badges, [])
})

test('an edge model shows its route and label', () => {
  const model = detailModel(payloadGraph, { kind: 'edge', id: 'composer-to-queue' })
  assert.strictEqual(model.title, 'send broadcast')
  assert.ok(model.meta.some(([k, v]) => k === 'Route' && v === 'broadcast-composer → queue-route'))
})

test('unknown targets give null', () => {
  assert.strictEqual(detailModel(payloadGraph, { kind: 'node', id: 'nope' }), null)
  assert.strictEqual(detailModel({}, target('x')), null)
})

test('fileText formats paths with optional line ranges', () => {
  assert.strictEqual(fileText({ path: 'a.ts', startLine: 3, endLine: 7 }), 'a.ts:3-7')
  assert.strictEqual(fileText({ path: 'b.ts', startLine: 5, endLine: 5 }), 'b.ts:5')
  assert.strictEqual(fileText({ path: 'c.ts' }), 'c.ts')
})

test('diffPaths lists changed, added and removed paths', () => {
  assert.deepStrictEqual(diffPaths({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } }), ['b.c'])
  assert.deepStrictEqual(diffPaths([1, 2], [1, 3]), ['[1]'])
  assert.deepStrictEqual(diffPaths({ a: 1 }, { a: 1, z: 9 }), ['z'])
  assert.deepStrictEqual(diffPaths({ a: 1, y: 2 }, { a: 1 }), ['y'])
  assert.deepStrictEqual(diffPaths({ a: 1 }, { a: 1 }), [])
  assert.deepStrictEqual(diffPaths(1, 2), ['$'])
})
