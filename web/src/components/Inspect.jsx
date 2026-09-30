import { sameTarget } from '../lib/hit.js'

const PAD = 4

function worldBox (target, positions) {
  const at = positions[target.tileId]
  return { x: target.box.x + at.x, y: target.box.y + at.y, width: target.box.width, height: target.box.height }
}

export function Inspect ({ layoutBounds, positions, zoom, hover, selected }) {
  const items = []
  if (selected) items.push({ key: 'selected', className: 'inspect-selected', target: selected })
  if (hover && !sameTarget(hover, selected)) {
    items.push({ key: 'hover', className: hover.kind === 'message' ? 'inspect-band' : 'inspect-outline', target: hover })
  }
  if (!items.length) return null
  const { x, y, width, height } = layoutBounds
  return (
    <svg class="overlay" style={{ left: `${x * zoom}px`, top: `${y * zoom}px` }} width={width * zoom} height={height * zoom} viewBox={`${x} ${y} ${width} ${height}`}>
      {items.map(({ key, className, target }) => {
        const box = worldBox(target, positions)
        return (
          <rect
            key={key}
            class={className}
            x={box.x - PAD}
            y={box.y - PAD}
            width={box.width + PAD * 2}
            height={box.height + PAD * 2}
            rx="8"
            stroke-width={2 / zoom}
          />
        )
      })}
    </svg>
  )
}
