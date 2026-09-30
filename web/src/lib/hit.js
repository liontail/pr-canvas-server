const THIN = 24
const EDGE_SLOP = 6

function inside (box, point, slop = 0) {
  return point.x >= box.x - slop && point.x <= box.x + box.width + slop &&
    point.y >= box.y - slop && point.y <= box.y + box.height + slop
}

export function screenToWorld (camera, point) {
  return { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom }
}

export function tileAt (layout, tiles, world) {
  for (const tile of tiles) {
    const origin = layout.positions[tile.id]
    if (!origin) continue
    if (world.x >= origin.x && world.x <= origin.x + tile.width && world.y >= origin.y && world.y <= origin.y + tile.height) {
      return { tile, origin }
    }
  }
  return null
}

export function hitTest (hits, point) {
  if (!hits) return null
  for (const [flow, messages] of Object.entries(hits.messages || {})) {
    for (const [id, box] of Object.entries(messages)) {
      if (inside(box, point)) return { kind: 'message', flow, id, box }
    }
  }
  for (const [id, box] of Object.entries(hits.nodes || {})) {
    if (inside(box, point)) return { kind: 'node', id, box }
  }
  for (const [id, box] of Object.entries(hits.edges || {})) {
    if (Math.min(box.width, box.height) <= THIN && inside(box, point, EDGE_SLOP)) return { kind: 'edge', id, box }
  }
  return null
}

export function sameTarget (a, b) {
  return Boolean(a && b) && a.kind === b.kind && a.id === b.id && a.flow === b.flow && a.tileId === b.tileId
}
