import { cn } from '@/lib/utils'

export function Switcher ({ tiles, theme, activeId, onSelect }) {
  return (
    <nav aria-label="Diagrams" className="absolute bottom-3.5 left-1/2 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 gap-2 overflow-x-auto rounded-xl border bg-card p-1.5 shadow-sm">
      {tiles.map((tile) => (
        <button
          type="button"
          key={tile.id}
          title={tile.crumbs.join(' › ') || tile.title}
          onClick={() => onSelect(tile.id)}
          className={cn(
            'grid min-w-[150px] grid-cols-[56px_1fr] items-center gap-x-2 rounded-lg border border-transparent p-1 pr-2 text-left text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
            tile.id === activeId && 'border-border bg-accent',
          )}
        >
          <img src={tile.images[theme]} alt="" draggable={false} className="row-span-2 h-9 w-14 rounded bg-background object-contain" />
          <span className="truncate">{tile.title}</span>
          <small className="font-mono text-[11px] text-muted-foreground">{tile.lens}</small>
        </button>
      ))}
    </nav>
  )
}
