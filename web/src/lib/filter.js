import { subtreeIds } from './tree.js'

export function displayName (canvas) {
  return canvas.name || canvas.title || 'Untitled'
}

const sameTag = (a, b) => a.toLowerCase() === b.toLowerCase()

export function filterCanvases ({ canvases, groups, group = 'all', tag = null, query = '' }) {
  const wanted = group === 'all' || group === 'none' ? null : subtreeIds(groups, group)
  const needle = query.trim().toLowerCase()
  return canvases.filter((canvas) => {
    if (group === 'none' && canvas.groupId) return false
    if (wanted && !wanted.has(canvas.groupId)) return false
    if (tag && !canvas.tags.some((existing) => sameTag(existing, tag))) return false
    if (!needle) return true
    return [displayName(canvas), canvas.title, canvas.repo || '', ...canvas.tags].some((text) => text.toLowerCase().includes(needle))
  })
}

export function sortCanvases (list, by = 'updated') {
  const copy = [...list]
  if (by === 'name') {
    return copy.sort((a, b) => displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id))
  }
  return copy.sort((a, b) => (a.lastWriteAt < b.lastWriteAt ? 1 : a.lastWriteAt > b.lastWriteAt ? -1 : a.id.localeCompare(b.id)))
}

export function allTags (canvases) {
  const counts = new Map()
  for (const canvas of canvases) {
    for (const tag of canvas.tags) {
      const key = tag.toLowerCase()
      const entry = counts.get(key)
      if (entry) entry.count += 1
      else counts.set(key, { tag, count: 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, undefined, { sensitivity: 'base' }))
}
