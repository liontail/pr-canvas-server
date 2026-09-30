const test = require('node:test')
const assert = require('node:assert')
const { parseGraphDoc } = require('@coldtea/pr-lens-schema')
const { postmarkRefactorGraph, minimalGraph } = require('@coldtea/pr-lens-schema/examples')
const { renderCanvas, renderStored } = require('../src/render')

const BASE = 'http://canvas.test/c/abc/assets'

test('one tile per view, exactly one hero, and it is first', () => {
  const { tiles } = renderCanvas(parseGraphDoc(postmarkRefactorGraph), BASE)
  assert.deepStrictEqual(
    tiles.map((t) => t.id),
    ['view:overview', 'view:new-batch-path', 'view:retired-path', 'view:send-pipeline-view'],
  )
  assert.strictEqual(tiles.filter((t) => t.hero).length, 1)
  assert.strictEqual(tiles[0].hero, true)
})

test('every tile image points at a rendered file, and renders are svg strings', () => {
  const { tiles, files } = renderCanvas(parseGraphDoc(postmarkRefactorGraph), BASE)
  assert.strictEqual(files.size, 8)
  for (const tile of tiles) {
    for (const theme of ['light', 'dark']) {
      assert.ok(tile.images[theme].startsWith(`${BASE}/`))
      const fileName = tile.images[theme].slice(BASE.length + 1)
      assert.strictEqual(files.get(fileName), tile.renders[theme])
      assert.ok(tile.renders[theme].startsWith('<svg'))
    }
    assert.ok(tile.width > 0 && tile.height > 0)
  }
})

test('view tiles use the view title and end their crumbs with it', () => {
  const { tiles } = renderCanvas(parseGraphDoc(postmarkRefactorGraph), BASE)
  for (const tile of tiles) {
    assert.ok(tile.crumbs.length >= 1)
    assert.strictEqual(tile.crumbs[tile.crumbs.length - 1], tile.title)
  }
})

test('a document without views gets one lens tile', () => {
  const { tiles } = renderCanvas(parseGraphDoc(minimalGraph), BASE)
  assert.strictEqual(tiles.length, 1)
  assert.strictEqual(tiles[0].id, 'lens:architecture')
  assert.strictEqual(tiles[0].title, 'architecture')
  assert.deepStrictEqual(tiles[0].crumbs, [])
  assert.strictEqual(tiles[0].hero, true)
})

test('rendering is deterministic', () => {
  const doc = parseGraphDoc(postmarkRefactorGraph)
  assert.deepStrictEqual(renderCanvas(doc, BASE).tiles, renderCanvas(doc, BASE).tiles)
})

test('renderStored parses raw JSON and rejects invalid documents', () => {
  assert.strictEqual(renderStored(minimalGraph, BASE).tiles.length, 1)
  assert.throws(() => renderStored({ kind: 'graph' }, BASE))
})
