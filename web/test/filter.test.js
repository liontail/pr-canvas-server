import test from 'node:test'
import assert from 'node:assert'
import { allTags, displayName, filterCanvases, sortCanvases } from '../src/lib/filter.js'

const G = (id, name, parentId = null) => ({ id, name, parentId })
const C = (id, extra = {}) => ({ id, name: null, title: `Title ${id}`, repo: 'acme/app', tags: [], groupId: null, lastWriteAt: '2026-01-01T00:00:00.000Z', ...extra })

const GROUPS = [G('g1', 'Team'), G('g2', 'Sub', 'g1'), G('g3', 'Other')]
const CANVASES = [
  C('c1', { groupId: 'g1', tags: ['prod'], lastWriteAt: '2026-03-01T00:00:00.000Z' }),
  C('c2', { groupId: 'g2', tags: ['Prod', 'batch'], name: 'Zebra', lastWriteAt: '2026-02-01T00:00:00.000Z' }),
  C('c3', { groupId: 'g3', repo: 'other/repo' }),
  C('c4', { title: '' }),
]
const ids = (list) => list.map((c) => c.id)

test('displayName prefers the custom name, then the title, then Untitled', () => {
  assert.strictEqual(displayName(C('x', { name: 'Mine' })), 'Mine')
  assert.strictEqual(displayName(C('x')), 'Title x')
  assert.strictEqual(displayName(C('x', { title: '' })), 'Untitled')
})

test('group "all" keeps everything, "none" keeps ungrouped, a group id includes its subtree', () => {
  assert.deepStrictEqual(ids(filterCanvases({ canvases: CANVASES, groups: GROUPS })), ['c1', 'c2', 'c3', 'c4'])
  assert.deepStrictEqual(ids(filterCanvases({ canvases: CANVASES, groups: GROUPS, group: 'none' })), ['c4'])
  assert.deepStrictEqual(ids(filterCanvases({ canvases: CANVASES, groups: GROUPS, group: 'g1' })), ['c1', 'c2'])
  assert.deepStrictEqual(ids(filterCanvases({ canvases: CANVASES, groups: GROUPS, group: 'g2' })), ['c2'])
  assert.deepStrictEqual(ids(filterCanvases({ canvases: CANVASES, groups: GROUPS, group: 'missing' })), [])
})

test('tag filter is case-insensitive', () => {
  assert.deepStrictEqual(ids(filterCanvases({ canvases: CANVASES, groups: GROUPS, tag: 'PROD' })), ['c1', 'c2'])
  assert.deepStrictEqual(ids(filterCanvases({ canvases: CANVASES, groups: GROUPS, tag: 'batch' })), ['c2'])
})

test('query matches display name, title, repo and tags case-insensitively', () => {
  assert.deepStrictEqual(ids(filterCanvases({ canvases: CANVASES, groups: GROUPS, query: 'zebra' })), ['c2'])
  assert.deepStrictEqual(ids(filterCanvases({ canvases: CANVASES, groups: GROUPS, query: 'title c1' })), ['c1'])
  assert.deepStrictEqual(ids(filterCanvases({ canvases: CANVASES, groups: GROUPS, query: 'OTHER/' })), ['c3'])
  assert.deepStrictEqual(ids(filterCanvases({ canvases: CANVASES, groups: GROUPS, query: 'batch' })), ['c2'])
  assert.deepStrictEqual(ids(filterCanvases({ canvases: CANVASES, groups: GROUPS, query: '   ' })), ['c1', 'c2', 'c3', 'c4'])
})

test('filters combine', () => {
  assert.deepStrictEqual(ids(filterCanvases({ canvases: CANVASES, groups: GROUPS, group: 'g1', tag: 'batch', query: 'zeb' })), ['c2'])
  assert.deepStrictEqual(ids(filterCanvases({ canvases: CANVASES, groups: GROUPS, group: 'g3', tag: 'prod' })), [])
})

test('sortCanvases orders by recency or name and never mutates its input', () => {
  const input = [...CANVASES]
  assert.deepStrictEqual(ids(sortCanvases(input, 'updated')).slice(0, 2), ['c1', 'c2'])
  assert.deepStrictEqual(ids(sortCanvases(input, 'name')), ['c1', 'c3', 'c4', 'c2'])
  assert.deepStrictEqual(input, CANVASES)
})

test('allTags merges casing, counts, and orders by count then name', () => {
  assert.deepStrictEqual(allTags(CANVASES), [{ tag: 'prod', count: 2 }, { tag: 'batch', count: 1 }])
  assert.deepStrictEqual(allTags([]), [])
})
