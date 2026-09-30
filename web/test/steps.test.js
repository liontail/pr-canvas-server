import test from 'node:test'
import assert from 'node:assert'
import { buildSteps, toWorld } from '../src/lib/steps.js'

const box = (x, y, width, height) => ({ x, y, width, height })

const DOCUMENT = {
  walkthrough: {
    steps: [
      { id: 'a', heading: 'A', body: 'first' },
      { id: 'b', heading: 'B', body: 'second' },
      { id: 'ghost', heading: 'G', body: 'no geometry' },
    ],
  },
}

const TILES = [
  { id: 't1', steps: [{ id: 'b', rects: [box(1, 2, 3, 4)], bounds: box(1, 2, 3, 4) }] },
  { id: 't2', steps: [{ id: 'a', rects: [], bounds: box(0, 0, 100, 50) }] },
  { id: 't3' },
]

test('steps follow the document order and carry tile and geometry', () => {
  const steps = buildSteps(DOCUMENT, TILES)
  assert.deepStrictEqual(steps.map((s) => [s.id, s.tileId]), [['a', 't2'], ['b', 't1']])
  assert.strictEqual(steps[0].heading, 'A')
  assert.strictEqual(steps[1].body, 'second')
  assert.deepStrictEqual(steps[1].rects, [box(1, 2, 3, 4)])
})

test('no walkthrough means no steps', () => {
  assert.deepStrictEqual(buildSteps({}, TILES), [])
  assert.deepStrictEqual(buildSteps(null, TILES), [])
})

test('toWorld shifts rects and bounds by the tile position', () => {
  const [a, b] = buildSteps(DOCUMENT, TILES)
  assert.deepStrictEqual(toWorld(b, { x: 10, y: 100 }).rects, [box(11, 102, 3, 4)])
  assert.deepStrictEqual(toWorld(a, { x: 10, y: 100 }).bounds, box(10, 100, 100, 50))
  assert.deepStrictEqual(toWorld(a, { x: 10, y: 100 }).rects, [])
})
