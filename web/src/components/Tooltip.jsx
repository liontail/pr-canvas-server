export function Tooltip ({ text, client, viewport }) {
  if (!text) return null
  const width = Math.min(360, text.length * 7.5 + 20)
  const left = Math.max(8, Math.min(client.x - width / 2, viewport.width - width - 8))
  const top = Math.max(8, client.y - 44)
  return <div class="tooltip" role="tooltip" style={{ left: `${left}px`, top: `${top}px` }}>{text}</div>
}
