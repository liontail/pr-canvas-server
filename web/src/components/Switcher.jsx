export function Switcher ({ tiles, theme, activeId, onSelect }) {
  return (
    <nav class="switcher" aria-label="Diagrams">
      {tiles.map((tile) => (
        <button
          type="button"
          key={tile.id}
          class={`thumb${tile.id === activeId ? ' active' : ''}`}
          title={tile.crumbs.join(' › ') || tile.title}
          onClick={() => onSelect(tile.id)}
        >
          <img src={tile.images[theme]} alt="" draggable={false} />
          <span>{tile.title}</span>
          <small>{tile.lens}</small>
        </button>
      ))}
    </nav>
  )
}
