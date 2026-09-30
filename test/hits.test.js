const test = require('node:test')
const assert = require('node:assert')
const { parseGraphDoc } = require('@coldtea/pr-lens-schema')
const { payloadGraph, postmarkRefactorGraph, minimalGraph } = require('@coldtea/pr-lens-schema/examples')
const { renderCanvas } = require('../src/render')

const BASE = 'http://canvas.test/c/abc/assets'
const draw = (raw) => renderCanvas(parseGraphDoc(JSON.parse(JSON.stringify(raw))), BASE).tiles
const boxesOf = (hits) => [
  ...Object.values(hits.nodes),
  ...Object.values(hits.edges),
  ...Object.values(hits.messages).flatMap((flow) => Object.values(flow)),
]

test('every tile carries hits with finite boxes inside the tile', () => {
  for (const raw of [payloadGraph, postmarkRefactorGraph, minimalGraph]) {
    for (const tile of draw(raw)) {
      assert.deepStrictEqual(Object.keys(tile.hits).sort(), ['edges', 'messages', 'nodes'])
      for (const box of boxesOf(tile.hits)) {
        for (const key of ['x', 'y', 'width', 'height']) assert.ok(Number.isFinite(box[key]), `${tile.id} ${key}`)
        assert.ok(box.x >= -0.5 && box.y >= -0.5, tile.id)
        assert.ok(box.x + box.width <= tile.width + 0.5, tile.id)
        assert.ok(box.y + box.height <= tile.height + 0.5, tile.id)
      }
    }
  }
})

test('hit ids belong to the document', () => {
  const doc = JSON.parse(JSON.stringify(payloadGraph))
  const nodeIds = new Set(doc.nodes.map((n) => n.id))
  const edgeIds = new Set(doc.edges.map((e) => e.id))
  for (const tile of draw(payloadGraph)) {
    for (const id of Object.keys(tile.hits.nodes)) assert.ok(nodeIds.has(id), `node ${id}`)
    for (const id of Object.keys(tile.hits.edges)) assert.ok(edgeIds.has(id), `edge ${id}`)
    for (const [flowId, messages] of Object.entries(tile.hits.messages)) {
      const flow = doc.flows.find((f) => f.id === flowId)
      assert.ok(flow, `flow ${flowId}`)
      for (const id of Object.keys(messages)) assert.ok(flow.messages.some((m) => m.id === id), `message ${id}`)
    }
  }
})

test('the data-flow tile has a box for every message of its flow', () => {
  const tile = draw(payloadGraph).find((t) => t.id === 'view:send-pipeline-view')
  const flow = payloadGraph.flows.find((f) => f.id === 'send-pipeline')
  assert.deepStrictEqual(Object.keys(tile.hits.messages['send-pipeline']).sort(), flow.messages.map((m) => m.id).sort())
})

test('architecture tiles have no message boxes and do have node boxes', () => {
  for (const tile of draw(payloadGraph).filter((t) => t.lens === 'architecture')) {
    assert.deepStrictEqual(tile.hits.messages, {})
    assert.ok(Object.keys(tile.hits.nodes).length > 0, tile.id)
  }
})

test('hits are deterministic and the internal atlas is not exposed', () => {
  assert.deepStrictEqual(draw(payloadGraph), draw(payloadGraph))
  for (const tile of draw(payloadGraph)) assert.ok(!('atlas' in tile))
})
