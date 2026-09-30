import test from 'node:test'
import assert from 'node:assert'
import { breadcrumb, buildTree, flatten, subtreeIds, wouldCycle } from '../src/lib/tree.js'

const G = (id, name, parentId = null) => ({ id, name, parentId })
const GROUPS = [G('b', 'Beta'), G('a', 'alpha'), G('a1', 'Zed', 'a'), G('a2', 'Yak', 'a'), G('a11', 'Deep', 'a1')]

test('buildTree nests groups and sorts siblings by name, case-insensitively', () => {
  const tree = buildTree(GROUPS)
  assert.deepStrictEqual(tree.map((n) => n.id), ['a', 'b'])
  assert.deepStrictEqual(tree[0].children.map((n) => n.id), ['a2', 'a1'])
  assert.deepStrictEqual(tree[0].children[1].children.map((n) => n.id), ['a11'])
})

test('a group whose parent is missing is shown at the top level', () => {
  const tree = buildTree([G('x', 'Orphan', 'gone'), G('y', 'Root')])
  assert.deepStrictEqual(tree.map((n) => n.id), ['x', 'y'])
})

test('flatten returns tree order with depth', () => {
  assert.deepStrictEqual(
    flatten(GROUPS).map((g) => [g.id, g.depth]),
    [['a', 0], ['a2', 1], ['a1', 1], ['a11', 2], ['b', 0]],
  )
})

test('subtreeIds includes the group and all descendants', () => {
  assert.deepStrictEqual([...subtreeIds(GROUPS, 'a')].sort(), ['a', 'a1', 'a11', 'a2'])
  assert.deepStrictEqual([...subtreeIds(GROUPS, 'a11')], ['a11'])
  assert.deepStrictEqual([...subtreeIds(GROUPS, 'nope')], ['nope'])
})

test('wouldCycle detects moves into itself or a descendant', () => {
  assert.ok(wouldCycle(GROUPS, 'a', 'a'))
  assert.ok(wouldCycle(GROUPS, 'a', 'a11'))
  assert.ok(!wouldCycle(GROUPS, 'a11', 'b'))
  assert.ok(!wouldCycle(GROUPS, 'a', null))
})

test('breadcrumb runs from the root to the group, empty for unknown, and survives a cycle', () => {
  assert.deepStrictEqual(breadcrumb(GROUPS, 'a11').map((g) => g.id), ['a', 'a1', 'a11'])
  assert.deepStrictEqual(breadcrumb(GROUPS, 'nope'), [])
  const loop = [G('p', 'P', 'q'), G('q', 'Q', 'p')]
  assert.ok(breadcrumb(loop, 'p').length <= 2)
})
