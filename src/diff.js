const { isDeepStrictEqual } = require('node:util')

function byId (list) {
  return new Map((list || []).map((item) => [item.id, item]))
}

function sameApartFromDelta (a, b) {
  const { delta: ignoredA, ...restA } = a
  const { delta: ignoredB, ...restB } = b
  return isDeepStrictEqual(restA, restB)
}

function mergeList (baseList, targetList) {
  const base = byId(baseList)
  const target = byId(targetList)
  const out = (targetList || []).map((item) => {
    const before = base.get(item.id)
    if (!before) return { ...item, delta: 'added' }
    return { ...item, delta: sameApartFromDelta(before, item) ? 'unchanged' : 'modified' }
  })
  for (const [id, item] of base) {
    if (!target.has(id)) out.push({ ...item, delta: 'removed' })
  }
  return out
}

// A graph whose deltas describe how `target` differs from `base`; the authors' own deltas are replaced.
function diffGraphs (base, target) {
  const doc = structuredClone(target)
  const baseLanes = byId(base.lanes)
  const nodes = mergeList(base.nodes, target.nodes)
  const lanes = mergeList(base.lanes, target.lanes)
  const laneIds = new Set(lanes.map((lane) => lane.id))
  for (const node of nodes) {
    if (!laneIds.has(node.lane) && baseLanes.has(node.lane)) {
      lanes.push({ ...baseLanes.get(node.lane), delta: 'removed' })
      laneIds.add(node.lane)
    }
  }
  doc.nodes = nodes
  doc.edges = mergeList(base.edges, target.edges)
  doc.lanes = lanes
  delete doc.stats
  return doc
}

module.exports = { diffGraphs }
