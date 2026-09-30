const test = require('node:test')
const assert = require('node:assert')
const ex = require('@coldtea/pr-lens-schema/examples')
const { safeParseGraphDoc } = require('@coldtea/pr-lens-schema')
const { diffGraphs } = require('../src/diff')
const { renderCanvas } = require('../src/render')

const node = (id, extra = {}) => ({ id, label: id.toUpperCase(), kind: 'module', delta: 'unchanged', lane: 'l1', ...extra })
const edge = (id, from, to, extra = {}) => ({ id, from, to, kind: 'call', delta: 'unchanged', ...extra })
const doc = (nodes, edges = [], lanes = [{ id: 'l1', label: 'Lane 1' }], extra = {}) => ({ title: 'T', nodes, edges, lanes, ...extra })
const deltas = (list) => Object.fromEntries(list.map((item) => [item.id, item.delta]))

test('nodes and edges are marked added, removed, modified or unchanged by id', () => {
  const base = doc([node('a'), node('b'), node('c')], [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')])
  const target = doc([node('a'), node('b', { label: 'Renamed' }), node('d')], [edge('ab', 'a', 'b'), edge('bd', 'b', 'd')])
  const out = diffGraphs(base, target)
  assert.deepStrictEqual(deltas(out.nodes), { a: 'unchanged', b: 'modified', d: 'added', c: 'removed' })
  assert.deepStrictEqual(deltas(out.edges), { ab: 'unchanged', bd: 'added', bc: 'removed' })
})

test('the removed elements are copied whole from the base', () => {
  const base = doc([node('a'), node('c', { summary: 'gone' })])
  const out = diffGraphs(base, doc([node('a')]))
  assert.deepStrictEqual(out.nodes.find((n) => n.id === 'c'), node('c', { summary: 'gone', delta: 'removed' }))
})

test('a lane that only the base had comes back as removed when a removed node needs it', () => {
  const base = doc([node('a'), node('x', { lane: 'old' })], [], [{ id: 'l1', label: 'L1' }, { id: 'old', label: 'Old' }])
  const target = doc([node('a')], [], [{ id: 'l1', label: 'L1' }])
  const out = diffGraphs(base, target)
  assert.deepStrictEqual(deltas(out.lanes), { l1: 'unchanged', old: 'removed' })
})

test('a lane change is modified; author deltas are ignored and overwritten', () => {
  const base = doc([node('a', { delta: 'added' })], [], [{ id: 'l1', label: 'One' }])
  const target = doc([node('a', { delta: 'removed' })], [], [{ id: 'l1', label: 'Uno' }])
  const out = diffGraphs(base, target)
  assert.strictEqual(out.nodes[0].delta, 'unchanged')
  assert.strictEqual(out.lanes[0].delta, 'modified')
})

test('key order does not matter and identical documents are all unchanged', () => {
  const a = doc([{ id: 'a', label: 'A', kind: 'module', delta: 'unchanged', lane: 'l1' }])
  const b = doc([{ lane: 'l1', delta: 'unchanged', kind: 'module', label: 'A', id: 'a' }])
  const out = diffGraphs(a, b)
  assert.ok([...out.nodes, ...out.edges, ...out.lanes].every((item) => item.delta === 'unchanged'))
})

test('inputs are not mutated, stats is dropped, other target fields are kept', () => {
  const base = doc([node('a')])
  const target = doc([node('a')], [], undefined, { stats: { nodes: 1 }, title: 'Keep me' })
  const beforeBase = JSON.stringify(base)
  const beforeTarget = JSON.stringify(target)
  const out = diffGraphs(base, target)
  assert.strictEqual(JSON.stringify(base), beforeBase)
  assert.strictEqual(JSON.stringify(target), beforeTarget)
  assert.ok(!('stats' in out))
  assert.strictEqual(out.title, 'Keep me')
})

test('diff documents of the example graphs validate and draw with the expected badges', () => {
  const cases = [
    [ex.minimalGraph, ex.postmarkRefactorGraph, ['NEW', 'REMOVED']],
    [ex.postmarkRefactorGraph, ex.minimalGraph, ['NEW', 'REMOVED']],
    [ex.broadcastBaselineGraph, ex.postmarkRefactorGraph, ['NEW', 'CHANGED']],
    [ex.postmarkRefactorGraph, ex.payloadGraph, []],
    [ex.payloadGraph, ex.payloadGraph, []],
  ]
  for (const [base, target, badges] of cases) {
    const parsed = safeParseGraphDoc(diffGraphs(base, target))
    assert.ok(parsed.ok, parsed.ok ? '' : JSON.stringify(parsed.error.issues.slice(0, 2)))
    const { tiles } = renderCanvas(parsed.value, 'http://x/assets', { strict: false })
    const svg = tiles[0].renders.light
    for (const badge of badges) assert.ok(svg.includes(badge), `${badge} missing`)
  }
})
