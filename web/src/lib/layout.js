export function layoutTiles (sizes, { gap = 120, maxRowWidth = 3200, labelHeight = 36 } = {}) {
  const positions = {}
  let x = 0
  let rowTop = 0
  let rowHeight = 0
  let usedWidth = 0

  for (const { id, width, height } of sizes) {
    if (x > 0 && x + width > maxRowWidth) {
      rowTop += rowHeight + gap
      x = 0
      rowHeight = 0
    }
    positions[id] = { x, y: rowTop + labelHeight }
    usedWidth = Math.max(usedWidth, x + width)
    x += width + gap
    rowHeight = Math.max(rowHeight, labelHeight + height)
  }

  return {
    positions,
    bounds: { x: 0, y: 0, width: usedWidth, height: sizes.length ? rowTop + rowHeight : 0 },
  }
}
