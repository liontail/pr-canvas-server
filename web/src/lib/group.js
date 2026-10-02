export const NO_REPO = '__none__'

export function groupByRepo (canvases, sort) {
  const map = new Map()
  for (const canvas of canvases) {
    const key = canvas.repo || NO_REPO
    if (!map.has(key)) map.set(key, { key, repo: key === NO_REPO ? null : key, canvases: [] })
    map.get(key).canvases.push(canvas)
  }
  const none = map.get(NO_REPO)
  map.delete(NO_REPO)
  const sections = [...map.values()]
  if (sort === 'name') sections.sort((a, b) => a.key.localeCompare(b.key, undefined, { sensitivity: 'base' }))
  if (none) sections.push(none)
  return sections
}

export function limitSections (sections, limit) {
  let left = limit
  const out = []
  for (const section of sections) {
    if (left <= 0) break
    out.push({ ...section, canvases: section.canvases.slice(0, left), total: section.canvases.length })
    left -= section.canvases.length
  }
  return out
}

export function readGroupBy () {
  try {
    const saved = localStorage.getItem('prlens.groupBy')
    if (saved === 'repo' || saved === 'none') return saved
  } catch {}
  return 'repo'
}

export function saveGroupBy (value) {
  try { localStorage.setItem('prlens.groupBy', value) } catch {}
}
