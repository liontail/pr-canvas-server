import test from 'node:test'
import assert from 'node:assert'
import { groupByRepo, limitSections, readGroupBy, saveGroupBy } from '../src/lib/group.js'

const C = (id, repo) => ({ id, repo })
const LIST = [C('1', 'b/two'), C('2', 'a/one'), C('3', null), C('4', 'b/two'), C('5', 'a/one'), C('6', 'c/three')]
const ids = (section) => section.canvases.map((c) => c.id)

test('groups by repo keeping incoming order, sections ordered by first appearance for updated', () => {
  const sections = groupByRepo(LIST, 'updated')
  assert.deepStrictEqual(sections.map((s) => s.key), ['b/two', 'a/one', 'c/three', '__none__'])
  assert.deepStrictEqual(ids(sections[0]), ['1', '4'])
  assert.deepStrictEqual(ids(sections[1]), ['2', '5'])
  assert.strictEqual(sections[0].repo, 'b/two')
})

test('sort name orders sections alphabetically by repo', () => {
  const sections = groupByRepo(LIST, 'name')
  assert.deepStrictEqual(sections.map((s) => s.key), ['a/one', 'b/two', 'c/three', '__none__'])
})

test('canvases without a repo form the last section keyed __none__ with null repo', () => {
  const sections = groupByRepo([C('1', null), C('2', 'x/y'), C('3', '')], 'updated')
  const last = sections[sections.length - 1]
  assert.strictEqual(last.key, '__none__')
  assert.strictEqual(last.repo, null)
  assert.deepStrictEqual(ids(last), ['1', '3'])
  assert.strictEqual(sections[0].key, 'x/y')
})

test('repo keys are case-sensitive', () => {
  assert.strictEqual(groupByRepo([C('1', 'A/b'), C('2', 'a/b')], 'updated').length, 2)
})

test('empty input gives no sections and input is not mutated', () => {
  assert.deepStrictEqual(groupByRepo([], 'updated'), [])
  const copy = LIST.slice()
  groupByRepo(LIST, 'name')
  assert.deepStrictEqual(LIST, copy)
})

test('limitSections truncates exactly across a section boundary and keeps total', () => {
  const sections = groupByRepo(LIST, 'updated')
  const limited = limitSections(sections, 3)
  assert.deepStrictEqual(limited.map((s) => s.key), ['b/two', 'a/one'])
  assert.deepStrictEqual(ids(limited[1]), ['2'])
  assert.deepStrictEqual(limited.map((s) => s.total), [2, 2])
  assert.strictEqual(sections[1].canvases.length, 2)
})

test('limitSections drops empty sections and returns everything when limit exceeds total', () => {
  const sections = groupByRepo(LIST, 'updated')
  assert.deepStrictEqual(limitSections(sections, 2).map((s) => s.key), ['b/two'])
  assert.deepStrictEqual(limitSections(sections, 0), [])
  const all = limitSections(sections, 100)
  assert.strictEqual(all.reduce((n, s) => n + s.canvases.length, 0), 6)
  assert.strictEqual(all.length, 4)
})

test('readGroupBy and saveGroupBy never throw without localStorage', () => {
  assert.strictEqual(readGroupBy(), 'repo')
  assert.doesNotThrow(() => saveGroupBy('none'))
})
