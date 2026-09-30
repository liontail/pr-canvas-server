const { ApiError } = require('./errors')

const MAX_DEPTH = 8
const CONTROL = /[\u0000-\u001f\u007f]/

const invalid = (message) => new ApiError('INVALID_REQUEST', message)

function normalizeName (value) {
  if (value === null) return null
  if (typeof value !== 'string') throw invalid('name must be a string or null')
  const name = value.trim()
  if (name.length > 120) throw invalid('name must be at most 120 characters')
  if (CONTROL.test(name)) throw invalid('name must not contain control characters')
  return name === '' ? null : name
}

function normalizeTags (value) {
  if (!Array.isArray(value)) throw invalid('tags must be an array of strings')
  const seen = new Set()
  const tags = []
  for (const item of value) {
    if (typeof item !== 'string') throw invalid('tags must be strings')
    const raw = item.trim()
    if (CONTROL.test(raw)) throw invalid('tags must not contain control characters')
    const tag = raw.replace(/\s+/g, ' ')
    if (tag.length < 1 || tag.length > 32) throw invalid('each tag must be 1-32 characters')
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }
  if (tags.length > 20) throw invalid('at most 20 tags')
  return tags
}

function normalizeGroupName (value) {
  if (typeof value !== 'string') throw invalid('name must be a string')
  const name = value.trim()
  if (name.length < 1 || name.length > 80) throw invalid('group name must be 1-80 characters')
  if (CONTROL.test(name)) throw invalid('group name must not contain control characters')
  return name
}

function childrenIndex (groups) {
  const children = new Map()
  for (const group of groups) {
    const key = group.parentId || null
    if (!children.has(key)) children.set(key, [])
    children.get(key).push(group._id)
  }
  return children
}

function subtree (groups, id) {
  const children = childrenIndex(groups)
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

function subtreeHeight (groups, id) {
  const children = childrenIndex(groups)
  const height = (node, seen) => {
    if (seen.has(node)) return 0
    seen.add(node)
    return 1 + Math.max(0, ...(children.get(node) || []).map((child) => height(child, seen)))
  }
  return height(id, new Set())
}

function depthOf (byId, id) {
  let depth = 0
  const seen = new Set()
  let cursor = id
  while (cursor && byId.has(cursor) && !seen.has(cursor)) {
    seen.add(cursor)
    depth += 1
    cursor = byId.get(cursor).parentId
  }
  return depth
}

function checkPlacement (groups, id, parentId) {
  if (parentId === null) return
  const byId = new Map(groups.map((group) => [group._id, group]))
  if (!byId.has(parentId)) throw invalid('parent group does not exist')
  if (id && (parentId === id || subtree(groups, id).has(parentId))) {
    throw invalid('a group cannot be moved into itself or one of its own sub-groups')
  }
  const height = id ? subtreeHeight(groups, id) : 1
  if (depthOf(byId, parentId) + height > MAX_DEPTH) {
    throw invalid(`groups can be nested at most ${MAX_DEPTH} levels deep`)
  }
}

module.exports = { MAX_DEPTH, normalizeName, normalizeTags, normalizeGroupName, checkPlacement }
