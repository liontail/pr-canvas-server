import { useEffect, useRef } from 'preact/hooks'
import { panBy, zoomAt } from '../lib/camera.js'
import { screenToWorld } from '../lib/hit.js'

const CLICK_SLOP = 4

export function Canvas ({ tiles, layout, camera, cameraRef, theme, interactive = true, pointing = false, onCamera, onHover, onClick, children }) {
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
                <img src={tile.images[theme]} style={size} alt={tile.title} draggable={false} />
              </figure>
            )
          })}
          {children}
        </div>
      )}
    </div>
  )
}
