const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id)

export function buildTree (groups) {
  const ids = new Set(groups.map((group) => group.id))
  const children = new Map()
  for (const group of groups) {
    const key = group.parentId && ids.has(group.parentId) ? group.parentId : null
    if (!children.has(key)) children.set(key, [])
    children.get(key).push(group)
  }
  const build = (parentId) => [...(children.get(parentId) || [])].sort(byName).map((group) => ({ ...group, children: build(group.id) }))
  return build(null)
}

export function flatten (groups) {
  const out = []
  const walk = (nodes, depth) => {
    for (const node of nodes) {
      out.push({ id: node.id, name: node.name, parentId: node.parentId, depth })
      walk(node.children, depth + 1)
    }
  }
  walk(buildTree(groups), 0)
  return out
}

export function subtreeIds (groups, id) {
  const children = new Map()
  for (const group of groups) {
    if (!children.has(group.parentId)) children.set(group.parentId, [])
    children.get(group.parentId).push(group.id)
  }
  const out = new Set()
  const stack = [id]
  while (stack.length) {
    const next = stack.pop()
    if (out.has(next)) continue
    out.add(next)
    for (const child of children.get(next) || []) stack.push(child)
  }
  return out
}

export function wouldCycle (groups, id, newParentId) {
  return newParentId !== null && (newParentId === id || subtreeIds(groups, id).has(newParentId))
}

export function breadcrumb (groups, id) {
  const byId = new Map(groups.map((group) => [group.id, group]))
  const path = []
  const seen = new Set()
  let cursor = byId.get(id)
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id)
    path.unshift(cursor)
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  return path
}
