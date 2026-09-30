export function Tooltip ({ text, client, viewport }) {
  if (!text) return null
  const width = Math.min(360, text.length * 7.5 + 20)
  const left = Math.max(8, Math.min(client.x - width / 2, viewport.width - width - 8))
  const top = Math.max(8, client.y - 44)
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 max-w-[360px] overflow-hidden rounded-md border bg-popover px-2 py-1 font-mono text-xs text-ellipsis whitespace-nowrap text-popover-foreground shadow-md"
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      {text}
    </div>
  )
}
