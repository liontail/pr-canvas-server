import test from 'node:test'
import assert from 'node:assert'
import { layoutTiles } from '../src/lib/layout.js'

const SIZES = [
  { id: 'a', width: 1378, height: 968 },
  { id: 'b', width: 964, height: 418 },
  { id: 'c', width: 880, height: 522 },
  { id: 'd', width: 1028, height: 413 },
]

const overlaps = (p, q, sizeP, sizeQ) =>
  p.x < q.x + sizeQ.width && q.x < p.x + sizeP.width && p.y < q.y + sizeQ.height && q.y < p.y + sizeP.height

test('the first tile sits at the origin below its caption strip', () => {
  const { positions } = layoutTiles(SIZES)
  assert.deepStrictEqual(positions.a, { x: 0, y: 36 })
})

test('tiles never overlap and all fit inside the bounds', () => {
  const { positions, bounds } = layoutTiles(SIZES)
  for (const p of SIZES) {
    for (const q of SIZES) {
      if (p.id !== q.id) assert.ok(!overlaps(positions[p.id], positions[q.id], p, q), `${p.id} vs ${q.id}`)
    }
    const at = positions[p.id]
    assert.ok(at.x >= bounds.x && at.y - 36 >= bounds.y)
    assert.ok(at.x + p.width <= bounds.x + bounds.width)
    assert.ok(at.y + p.height <= bounds.y + bounds.height)
  }
})

test('rows wrap when the next tile would pass maxRowWidth', () => {
  const { positions } = layoutTiles(SIZES, { maxRowWidth: 3200 })
  assert.ok(positions.b.y === positions.a.y)
  assert.ok(positions.c.y > positions.a.y + 968)
  assert.strictEqual(positions.c.x, 0)
  assert.strictEqual(positions.d.y, positions.c.y)
})

test('layout is deterministic and handles an empty list', () => {
  assert.deepStrictEqual(layoutTiles(SIZES), layoutTiles(SIZES))
  assert.deepStrictEqual(layoutTiles([]), { positions: {}, bounds: { x: 0, y: 0, width: 0, height: 0 } })
})
