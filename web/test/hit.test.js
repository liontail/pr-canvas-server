import test from 'node:test'
import assert from 'node:assert'
import { hitTest, sameTarget, screenToWorld, tileAt } from '../src/lib/hit.js'

const box = (x, y, width, height) => ({ x, y, width, height })

const HITS = {
  nodes: { n1: box(0, 0, 100, 50), n2: box(200, 0, 100, 50) },
  edges: { thin: box(100, 20, 100, 4), fat: box(0, 100, 300, 200) },
  messages: { flow: { m1: box(0, 300, 300, 38) } },
}

test('a point on a message row hits the message with its flow', () => {
  assert.deepStrictEqual(hitTest(HITS, { x: 10, y: 310 }), { kind: 'message', flow: 'flow', id: 'm1', box: box(0, 300, 300, 38) })
})

test('a point on a node hits the node, inclusive of its edges', () => {
  assert.deepStrictEqual(hitTest(HITS, { x: 50, y: 25 }), { kind: 'node', id: 'n1', box: box(0, 0, 100, 50) })
  assert.strictEqual(hitTest(HITS, { x: 300, y: 50 }).id, 'n2')
})

test('a thin edge hits inside its box and within the 6 unit slop, not beyond', () => {
  assert.strictEqual(hitTest(HITS, { x: 150, y: 22 }).id, 'thin')
  assert.strictEqual(hitTest(HITS, { x: 150, y: 28 }).id, 'thin')
  assert.strictEqual(hitTest(HITS, { x: 150, y: 40 }), null)
})

test('a fat (L-shaped) edge box is never a hover target', () => {
  assert.strictEqual(hitTest(HITS, { x: 150, y: 200 }), null)
})

test('priority is message over node over edge', () => {
  const overlap = { nodes: { n: box(0, 0, 100, 50) }, edges: { e: box(0, 20, 100, 4) }, messages: { f: { m: box(0, 0, 100, 38) } } }
  assert.strictEqual(hitTest(overlap, { x: 10, y: 10 }).kind, 'message')
  assert.strictEqual(hitTest(overlap, { x: 10, y: 45 }).kind, 'node')
  const nodeAndEdge = { nodes: { n: box(0, 0, 100, 50) }, edges: { e: box(0, 20, 100, 4) }, messages: {} }
  assert.strictEqual(hitTest(nodeAndEdge, { x: 10, y: 22 }).kind, 'node')
})

test('missing or empty hits never throw and never hit', () => {
  assert.strictEqual(hitTest(undefined, { x: 1, y: 1 }), null)
  assert.strictEqual(hitTest(null, { x: 1, y: 1 }), null)
  assert.strictEqual(hitTest({}, { x: 1, y: 1 }), null)
  assert.strictEqual(hitTest({ nodes: {}, edges: {}, messages: {} }, { x: 1, y: 1 }), null)
})

test('tileAt finds the tile under a world point and its origin', () => {
  const layout = { positions: { a: { x: 0, y: 36 }, b: { x: 1500, y: 36 } } }
  const tiles = [{ id: 'a', width: 1000, height: 500 }, { id: 'b', width: 400, height: 300 }]
  const first = tileAt(layout, tiles, { x: 10, y: 40 })
  assert.strictEqual(first.tile.id, 'a')
  assert.deepStrictEqual(first.origin, { x: 0, y: 36 })
  assert.strictEqual(tileAt(layout, tiles, { x: 1600, y: 100 }).tile.id, 'b')
  assert.strictEqual(tileAt(layout, tiles, { x: 1200, y: 100 }), null)
  assert.strictEqual(tileAt(layout, tiles, { x: 10, y: 10 }), null)
})

test('sameTarget compares kind, id, flow and tile', () => {
  const a = { kind: 'message', flow: 'f', id: 'm', tileId: 't', box: box(0, 0, 1, 1) }
  assert.ok(sameTarget(a, { ...a, box: box(5, 5, 1, 1) }))
  for (const change of [{ kind: 'node' }, { flow: 'g' }, { id: 'n' }, { tileId: 'u' }]) {
    assert.ok(!sameTarget(a, { ...a, ...change }))
  }
  assert.ok(!sameTarget(a, null))
  assert.ok(!sameTarget(null, null))
})

test('screenToWorld inverts the camera transform', () => {
  const camera = { x: 100, y: 50, zoom: 2 }
  assert.deepStrictEqual(screenToWorld(camera, { x: 300, y: 250 }), { x: 100, y: 100 })
  const point = { x: 640, y: 480 }
  const world = screenToWorld(camera, point)
  assert.deepStrictEqual({ x: camera.x + world.x * camera.zoom, y: camera.y + world.y * camera.zoom }, point)
})
