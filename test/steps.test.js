const test = require('node:test')
const assert = require('node:assert')
const { parseGraphDoc } = require('@coldtea/pr-lens-schema')
const { postmarkRefactorGraph, minimalGraph } = require('@coldtea/pr-lens-schema/examples')
const { renderCanvas, renderStored, WalkthroughError } = require('../src/render')
const { foreignNode } = require('./fixtures')

const BASE = 'http://canvas.test/c/abc/assets'
const raw = () => JSON.parse(JSON.stringify(postmarkRefactorGraph))
const stepsOf = (tiles, id) => tiles.find((tile) => tile.id === id).steps

test('each step lands on the tile it is staged on, in document order', () => {
  const { tiles } = renderCanvas(parseGraphDoc(raw()), BASE)
  assert.deepStrictEqual(stepsOf(tiles, 'view:overview').map((s) => s.id), ['batches-of-500', 'old-path-goes-dark', 'blast-radius'])
  assert.deepStrictEqual(stepsOf(tiles, 'view:new-batch-path').map((s) => s.id), ['suppression-first'])
  assert.deepStrictEqual(stepsOf(tiles, 'view:retired-path'), [])
  assert.deepStrictEqual(stepsOf(tiles, 'view:send-pipeline-view').map((s) => s.id), ['sequence-start-to-finish', 'four-batch-calls'])
})

test('a node selection yields one rect per node and a bounds covering them', () => {
  const { tiles } = renderCanvas(parseGraphDoc(raw()), BASE)
  const step = stepsOf(tiles, 'view:overview').find((s) => s.id === 'batches-of-500')
  assert.strictEqual(step.rects.length, 3)
  for (const rect of step.rects) {
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Number.isFinite(rect[key]))
    assert.ok(step.bounds.x <= rect.x && step.bounds.y <= rect.y)
    assert.ok(step.bounds.x + step.bounds.width >= rect.x + rect.width)
    assert.ok(step.bounds.y + step.bounds.height >= rect.y + rect.height)
  }
})

test('focus "all" has no rects and covers the whole tile', () => {
  const { tiles } = renderCanvas(parseGraphDoc(raw()), BASE)
  const tile = tiles.find((t) => t.id === 'view:send-pipeline-view')
  const step = tile.steps.find((s) => s.id === 'sequence-start-to-finish')
  assert.deepStrictEqual(step.rects, [])
  assert.deepStrictEqual(step.bounds, { x: 0, y: 0, width: tile.width, height: tile.height })
})

test('message focus on a flow stage resolves to message boxes', () => {
  const { tiles } = renderCanvas(parseGraphDoc(raw()), BASE)
  const step = stepsOf(tiles, 'view:send-pipeline-view').find((s) => s.id === 'four-batch-calls')
  assert.strictEqual(step.rects.length, 2)
})

test('documents without a walkthrough get empty steps on every tile', () => {
  for (const tile of renderCanvas(parseGraphDoc(minimalGraph), BASE).tiles) assert.deepStrictEqual(tile.steps, [])
})

test('strict mode throws WalkthroughError naming the step and the missing element', () => {
  const doc = parseGraphDoc(raw())
  doc.walkthrough.steps[1].focus.nodes = ['nope']
  assert.throws(() => renderCanvas(doc, BASE), (err) => {
    assert.ok(err instanceof WalkthroughError)
    assert.match(err.message, /suppression-first/)
    assert.match(err.message, /node "nope"/)
    return true
  })
})

test('a node that exists but is not in the staged diagram is missing too', () => {
  const doc = parseGraphDoc(raw())
  doc.walkthrough.steps[1].focus.nodes = [foreignNode(raw())]
  assert.throws(() => renderCanvas(doc, BASE), WalkthroughError)
})

test('an unknown view or flow stage, and messages on a view stage, are errors', () => {
  const badView = parseGraphDoc(raw())
  badView.walkthrough.steps[0].stage = { kind: 'view', view: 'ghost' }
  assert.throws(() => renderCanvas(badView, BASE), /view "ghost"/)

  const badFlow = parseGraphDoc(raw())
  badFlow.walkthrough.steps[3].stage = { kind: 'flow', flow: 'ghost' }
  assert.throws(() => renderCanvas(badFlow, BASE), /flow "ghost"/)

  const badMessages = parseGraphDoc(raw())
  badMessages.walkthrough.steps[0].focus = { kind: 'selection', lanes: [], nodes: [], edges: [], messages: ['m1'] }
  assert.throws(() => renderCanvas(badMessages, BASE), /message "m1"/)
})

test('non-strict mode (stored documents) skips unresolvable steps instead of throwing', () => {
  const doc = parseGraphDoc(raw())
  doc.walkthrough.steps[1].focus.nodes = [foreignNode(raw())]
  const { tiles } = renderCanvas(doc, BASE, { strict: false })
  const all = tiles.flatMap((t) => t.steps.map((s) => s.id))
  assert.ok(!all.includes('suppression-first'))
  assert.ok(all.includes('batches-of-500'))
})

test('renderStored never throws for a walkthrough that stopped resolving', () => {
  const stored = raw()
  stored.walkthrough.steps[1].focus.nodes = [foreignNode(raw())]
  const { tiles } = renderStored(stored, BASE)
  assert.ok(!tiles.flatMap((t) => t.steps.map((s) => s.id)).includes('suppression-first'))
})

test('tiles expose steps but never the internal atlas', () => {
  for (const tile of renderCanvas(parseGraphDoc(raw()), BASE).tiles) {
    assert.ok(Array.isArray(tile.steps))
    assert.ok(!('atlas' in tile))
  }
})

test('inherited property names like "constructor" in focus nodes throw in strict mode', () => {
  const doc = parseGraphDoc(raw())
  doc.walkthrough.steps[1].focus.nodes = ['constructor']
  assert.throws(() => renderCanvas(doc, BASE), (err) => {
    assert.ok(err instanceof WalkthroughError)
    assert.match(err.message, /suppression-first/)
    return true
  })
})

test('inherited property names like "toString" in focus nodes throw in strict mode', () => {
  const doc = parseGraphDoc(raw())
  doc.walkthrough.steps[1].focus.nodes = ['toString']
  assert.throws(() => renderCanvas(doc, BASE), (err) => {
    assert.ok(err instanceof WalkthroughError)
    assert.match(err.message, /suppression-first/)
    return true
  })
})

test('inherited property names like "constructor" in flow stage throw in strict mode', () => {
  const doc = parseGraphDoc(raw())
  doc.walkthrough.steps[3].stage = { kind: 'flow', flow: 'constructor' }
  assert.throws(() => renderCanvas(doc, BASE), (err) => {
    assert.ok(err instanceof WalkthroughError)
    assert.match(err.message, /flow "constructor"/)
    return true
  })
})

test('inherited property names like "constructor" in message focus throw in strict mode', () => {
  const doc = parseGraphDoc(raw())
  doc.walkthrough.steps[4].focus.messages = ['constructor']
  assert.throws(() => renderCanvas(doc, BASE), (err) => {
    assert.ok(err instanceof WalkthroughError)
    assert.match(err.message, /message "constructor"/)
    return true
  })
})

test('inherited property names in focus nodes with strict: false do not throw and skip the step', () => {
  const doc = parseGraphDoc(raw())
  doc.walkthrough.steps[1].focus.nodes = ['constructor']
  const { tiles } = renderCanvas(doc, BASE, { strict: false })
  const all = tiles.flatMap((t) => t.steps.map((s) => s.id))
  assert.ok(!all.includes('suppression-first'))
  assert.ok(all.includes('batches-of-500'))
})
