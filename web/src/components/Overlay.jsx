const PAD = 12

export function Overlay ({ layoutBounds, focus, zoom }) {
  if (!focus) return null
  const { x, y, width, height } = layoutBounds
  const hole = { x: focus.x - PAD, y: focus.y - PAD, width: focus.width + PAD * 2, height: focus.height + PAD * 2 }
  return (
    <svg class="overlay" style={{ left: `${x * zoom}px`, top: `${y * zoom}px` }} width={width * zoom} height={height * zoom} viewBox={`${x} ${y} ${width} ${height}`}>
      <defs>
        <mask id="focus-mask">
          <rect x={x} y={y} width={width} height={height} fill="white" />
          <rect x={hole.x} y={hole.y} width={hole.width} height={hole.height} rx="14" fill="black" />
        </mask>
      </defs>
      <rect class="dim" x={x} y={y} width={width} height={height} mask="url(#focus-mask)" />
      <rect class="rim" x={hole.x} y={hole.y} width={hole.width} height={hole.height} rx="14" stroke-width={2 / zoom} />
    </svg>
  )
}
