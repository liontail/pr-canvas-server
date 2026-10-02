import { useEffect, useRef } from 'preact/hooks'
import { panBy, scrollThumb, zoomAt } from '../lib/camera.js'
import { screenToWorld } from '../lib/hit.js'

const CLICK_SLOP = 4
const MIN_THUMB = 24
const PAGE = 0.9

function Scrollbar ({ axis, thumb, length, enabled, onPan }) {
  const drag = useRef(null)
  const x = axis === 'x'
  const stop = (event) => event.stopPropagation()
  const coord = (event) => (x ? event.clientX : event.clientY)
  const size = Math.max(MIN_THUMB / length, thumb.size)
  const pos = thumb.pos * (1 - size) / Math.max(1e-9, 1 - thumb.size)
  const box = x ? { left: `${pos * 100}%`, width: `${size * 100}%` } : { top: `${pos * 100}%`, height: `${size * 100}%` }

  function onTrackDown (event) {
    stop(event)
    if (!enabled || event.target !== event.currentTarget) return
    const rect = event.currentTarget.getBoundingClientRect()
    const frac = (coord(event) - (x ? rect.left : rect.top)) / length
    onPan((frac < pos ? 1 : -1) * length * PAGE)
  }

  function onThumbDown (event) {
    stop(event)
    if (!enabled) return
    drag.current = coord(event)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onThumbMove (event) {
    stop(event)
    if (drag.current === null) return
    const delta = coord(event) - drag.current
    drag.current = coord(event)
    onPan(-delta * thumb.span / length)
  }

  function onThumbUp (event) {
    stop(event)
    drag.current = null
  }

  return (
    <div class={`scrollbar scrollbar-${axis}${enabled ? '' : ' disabled'}`} onPointerDown={onTrackDown} onPointerMove={stop} onPointerUp={stop}>
      <div class="scrollbar-thumb" style={box} onPointerDown={onThumbDown} onPointerMove={onThumbMove} onPointerUp={onThumbUp} onPointerCancel={onThumbUp} />
    </div>
  )
}

export function Canvas ({ tiles, layout, bounds, viewport, liveTile, camera, cameraRef, theme, interactive = true, pointing = false, onCamera, onHover, onClick, children }) {
  const ref = useRef(null)
  const drag = useRef(null)
  const live = useRef({ interactive, onCamera, onHover, onClick })
  live.current = { interactive, onCamera, onHover, onClick }

  useEffect(() => {
    const el = ref.current
    const onWheel = (event) => {
      const { interactive: on, onCamera: emit } = live.current
      const current = cameraRef.current
      if (!on || !current) return
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        const rect = el.getBoundingClientRect()
        const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        emit(zoomAt(current, point, Math.exp(-event.deltaY * 0.01)))
      } else {
        emit(panBy(current, -event.deltaX, -event.deltaY))
      }
      if (live.current.onHover) live.current.onHover(null)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [cameraRef])

  function locate (event) {
    const rect = ref.current.getBoundingClientRect()
    const client = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    return { client, world: screenToWorld(cameraRef.current, client) }
  }

  function onPointerDown (event) {
    if (!live.current.interactive || event.button !== 0) return
    drag.current = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: 0 }
    if (live.current.onHover) live.current.onHover(null)
    ref.current.setPointerCapture(event.pointerId)
  }

  function onPointerMove (event) {
    if (!cameraRef.current) return
    if (!drag.current) {
      if (live.current.interactive && live.current.onHover) live.current.onHover(locate(event))
      return
    }
    drag.current.moved = Math.max(drag.current.moved, Math.hypot(event.clientX - drag.current.startX, event.clientY - drag.current.startY))
    live.current.onCamera(panBy(cameraRef.current, event.clientX - drag.current.x, event.clientY - drag.current.y))
    drag.current.x = event.clientX
    drag.current.y = event.clientY
  }

  function onPointerUp (event) {
    const was = drag.current
    drag.current = null
    if (was && was.moved < CLICK_SLOP && cameraRef.current && live.current.onClick) live.current.onClick(locate(event))
  }

  function onPointerCancel () {
    drag.current = null
  }

  function onPointerLeave () {
    if (live.current.onHover) live.current.onHover(null)
  }

  function pan (dx, dy) {
    if (live.current.interactive && cameraRef.current) live.current.onCamera(panBy(cameraRef.current, dx, dy))
  }

  const bars = camera && bounds && viewport && viewport.width > 0 && viewport.height > 0
  const z = camera ? camera.zoom : 1

  return (
    <div
      class={`canvas${pointing ? ' pointing' : ''}`}
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
    >
      {camera && (
        <div class="stage" style={{ transform: `translate(${camera.x}px, ${camera.y}px)` }}>
          {tiles.map((tile) => {
            const at = layout.positions[tile.id]
            const z = camera.zoom
            const size = { width: `${tile.width * z}px`, height: `${tile.height * z}px` }
            return (
              <figure
                class="tile"
                key={tile.id}
                style={{ left: `${at.x * z}px`, top: `${at.y * z}px`, ...size }}
              >
                <figcaption style={{ top: `${-30 * z}px`, fontSize: `${12 * z}px` }}><b>{tile.title}</b> {tile.lens}{tile.hero ? ' · hero' : ''}</figcaption>
                <img src={tile.id === liveTile ? tile.images[theme] : `${tile.images[theme]}?static`} style={size} alt={tile.title} draggable={false} />
              </figure>
            )
          })}
          {children}
        </div>
      )}
      {bars && (
        <>
          <Scrollbar axis="x" length={viewport.width} enabled={interactive} thumb={scrollThumb(bounds.x * z, (bounds.x + bounds.width) * z, -camera.x, viewport.width)} onPan={(d) => pan(d, 0)} />
          <Scrollbar axis="y" length={viewport.height} enabled={interactive} thumb={scrollThumb(bounds.y * z, (bounds.y + bounds.height) * z, -camera.y, viewport.height)} onPan={(d) => pan(0, d)} />
        </>
      )}
    </div>
  )
}
