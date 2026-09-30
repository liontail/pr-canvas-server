import test from 'node:test'
import assert from 'node:assert'
import { payloadGraph } from '@coldtea/pr-lens-schema/examples'
import { lookup, tooltipText } from '../src/lib/describe.js'

const message = (id) => payloadGraph.flows[0].messages.find((m) => m.id === id)
const target = (id) => ({ kind: 'message', flow: 'send-pipeline', id })

test('a message with both payload sides reads Request → Response', () => {
  assert.strictEqual(tooltipText(payloadGraph, target('enqueue')), 'BroadcastJob → WriteResult')
})

test('a missing response side reads void', () => {
  assert.strictEqual(tooltipText(payloadGraph, target('trigger')), 'Change<BroadcastJob> → void')
})

test('a missing request side reads void and a repeat above one is shown', () => {
  assert.strictEqual(tooltipText(payloadGraph, target('batch-results')), 'void → BatchResult[500]')
  assert.strictEqual(tooltipText(payloadGraph, target('batch-post')), 'EmailBatch[500] → BatchResult[500] × 4')
})

test('a message without a payload falls back to its label', () => {
  assert.strictEqual(tooltipText(payloadGraph, target('suppressions-response')), message('suppressions-response').label)
})

test('a node shows its label and subtitle, or only the label', () => {
  assert.strictEqual(tooltipText(payloadGraph, { kind: 'node', id: 'broadcast-composer' }), 'Broadcast composer · app/broadcasts/new')
  assert.strictEqual(tooltipText({ nodes: [{ id: 'n', label: 'Only label' }] }, { kind: 'node', id: 'n' }), 'Only label')
})

test('an edge shows its label, or from → to when unlabelled', () => {
  assert.strictEqual(tooltipText(payloadGraph, { kind: 'edge', id: 'composer-to-queue' }), 'send broadcast')
  assert.strictEqual(tooltipText({ edges: [{ id: 'e', from: 'a', to: 'b' }] }, { kind: 'edge', id: 'e' }), 'a → b')
})

test('unknown targets and missing collections give an empty string, never throw', () => {
  assert.strictEqual(tooltipText(payloadGraph, { kind: 'node', id: 'nope' }), '')
  assert.strictEqual(tooltipText(payloadGraph, { kind: 'message', flow: 'nope', id: 'x' }), '')
  assert.strictEqual(tooltipText({}, { kind: 'edge', id: 'x' }), '')
  assert.strictEqual(lookup({}, { kind: 'message', flow: 'f', id: 'm' }), undefined)
})
