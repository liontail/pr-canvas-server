const MARKER = /\[\[(component|message|diagram):([^\]\s]{1,200})\]\]/g
const OPEN_TAIL = /(\[\[[^\]]*\]?|\[)$/

const named = (list, id) => (Array.isArray(list) ? list.find((item) => item.id === id) : undefined)
const shift = (box, at) => ({ x: box.x + at.x, y: box.y + at.y, width: box.width, height: box.height })

function findItem (ref, document) {
  if (ref.kind === 'component') return named(document.nodes, ref.id)
  if (ref.kind === 'diagram') return named(document.views, ref.id) || named(document.flows, ref.id)
  const slash = ref.id.indexOf('/')
  if (slash < 1) return undefined
  const flow = named(document.flows, ref.id.slice(0, slash))
  return flow ? named(flow.messages, ref.id.slice(slash + 1)) : undefined
}

export function parseCitations (text, document, streaming = false) {
  const body = streaming ? text.replace(OPEN_TAIL, '') : text
  const parts = []
  let last = 0
  for (const match of body.matchAll(MARKER)) {
    const ref = { kind: match[1], id: match[2] }
    const item = document ? findItem(ref, document) : undefined
    if (!item) continue
    if (match.index > last) parts.push({ text: body.slice(last, match.index) })
    parts.push({ text: item.label || item.title || ref.id, ref })
    last = match.index + match[0].length
  }
  if (last < body.length) parts.push({ text: body.slice(last) })
  return parts
}

export function locateCitation (ref, tiles, positions) {
  if (ref.kind === 'component') {
    const tile = tiles.find((item) => item.hits && Object.hasOwn(item.hits.nodes, ref.id))
    if (!tile || !positions[tile.id]) return null
    const box = tile.hits.nodes[ref.id]
    return { tileId: tile.id, world: shift(box, positions[tile.id]), target: { kind: 'node', id: ref.id, box, tileId: tile.id } }
  }
  if (ref.kind === 'message') {
    const slash = ref.id.indexOf('/')
    if (slash < 1) return null
    const flow = ref.id.slice(0, slash)
    const id = ref.id.slice(slash + 1)
    const tile = tiles.find((item) => item.hits && item.hits.messages[flow] && Object.hasOwn(item.hits.messages[flow], id))
    if (!tile || !positions[tile.id]) return null
    const box = tile.hits.messages[flow][id]
    return { tileId: tile.id, world: shift(box, positions[tile.id]), target: { kind: 'message', flow, id, box, tileId: tile.id } }
  }
  const tile = tiles.find((item) => item.id === `view:${ref.id}`) ||
    tiles.find((item) => item.hits && Object.hasOwn(item.hits.messages, ref.id))
  if (!tile || !positions[tile.id]) return null
  return { tileId: tile.id, world: { ...positions[tile.id], width: tile.width, height: tile.height }, target: null }
}

export function selectionHint (selected) {
  if (!selected) return null
  if (selected.kind === 'node') return { kind: 'component', id: selected.id }
  if (selected.kind === 'message') return { kind: 'message', id: `${selected.flow}/${selected.id}` }
  return null
}
