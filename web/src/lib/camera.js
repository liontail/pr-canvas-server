export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4

export function clampZoom (zoom) {
  if (Number.isNaN(zoom)) return 1
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function fit (bounds, viewport, { padding = 48, insetLeft = 0, maxZoom = MAX_ZOOM } = {}) {
  const width = Math.max(1, bounds.width)
  const height = Math.max(1, bounds.height)
  const availW = Math.max(1, viewport.width - insetLeft - padding * 2)
  const availH = Math.max(1, viewport.height - padding * 2)
  const zoom = Math.min(clampZoom(Math.min(availW / width, availH / height)), maxZoom)
  return {
    x: insetLeft + padding + (availW - width * zoom) / 2 - bounds.x * zoom,
    y: padding + (availH - height * zoom) / 2 - bounds.y * zoom,
    zoom,
  }
}

export function zoomAt (camera, point, factor) {
  const zoom = clampZoom(camera.zoom * factor)
  const k = zoom / camera.zoom
  return { x: point.x - (point.x - camera.x) * k, y: point.y - (point.y - camera.y) * k, zoom }
}

export function panBy (camera, dx, dy) {
  return { x: camera.x + dx, y: camera.y + dy, zoom: camera.zoom }
}

export function expand (box, margin) {
  return { x: box.x - margin, y: box.y - margin, width: box.width + margin * 2, height: box.height + margin * 2 }
}

export function ease (t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function lerpCamera (a, b, t) {
  const e = ease(t)
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, zoom: a.zoom + (b.zoom - a.zoom) * e }
}
