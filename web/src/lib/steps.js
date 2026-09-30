export function buildSteps (document, tiles) {
  const walkthrough = document && document.walkthrough
  if (!walkthrough) return []

  const geometry = new Map()
  for (const tile of tiles) {
    for (const step of tile.steps || []) {
      geometry.set(step.id, { tileId: tile.id, rects: step.rects, bounds: step.bounds })
    }
  }

  const steps = []
  for (const step of walkthrough.steps) {
    const found = geometry.get(step.id)
    if (found) steps.push({ id: step.id, heading: step.heading, body: step.body, ...found })
  }
  return steps
}

export function toWorld (step, position) {
  const shift = (box) => ({ x: box.x + position.x, y: box.y + position.y, width: box.width, height: box.height })
  return { ...step, rects: step.rects.map(shift), bounds: shift(step.bounds) }
}
