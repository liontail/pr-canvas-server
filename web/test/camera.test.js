import test from 'node:test'
import assert from 'node:assert'
import { MAX_ZOOM, MIN_ZOOM, clampZoom, ease, expand, fit, lerpCamera, panBy, scrollThumb, zoomAt } from '../src/lib/camera.js'

test('clampZoom bounds the zoom and tolerates junk', () => {
  assert.strictEqual(clampZoom(100), MAX_ZOOM)
  assert.strictEqual(clampZoom(0.0001), MIN_ZOOM)
  assert.strictEqual(clampZoom(1.5), 1.5)
  assert.strictEqual(clampZoom(Infinity), MAX_ZOOM)
  assert.strictEqual(clampZoom(NaN), 1)
})

test('fit centres bounds inside the padded viewport', () => {
  assert.deepStrictEqual(
    fit({ x: 0, y: 0, width: 100, height: 50 }, { width: 500, height: 300 }, { padding: 50 }),
    { x: 50, y: 50, zoom: 4 },
  )
})

test('fit leaves room for the left inset', () => {
  assert.deepStrictEqual(
    fit({ x: 0, y: 0, width: 100, height: 50 }, { width: 500, height: 300 }, { padding: 50, insetLeft: 100 }),
    { x: 150, y: 75, zoom: 3 },
  )
})

test('a tiny focus is capped by maxZoom', () => {
  assert.deepStrictEqual(
    fit({ x: 0, y: 0, width: 10, height: 10 }, { width: 500, height: 300 }, { padding: 0, maxZoom: 2 }),
    { x: 240, y: 140, zoom: 2 },
  )
})

test('fit never returns NaN or Infinity for degenerate input', () => {
  for (const [bounds, viewport] of [
    [{ x: 0, y: 0, width: 0, height: 0 }, { width: 500, height: 300 }],
    [{ x: 5, y: 5, width: 100, height: 100 }, { width: 0, height: 0 }],
  ]) {
    const camera = fit(bounds, viewport)
    for (const value of Object.values(camera)) assert.ok(Number.isFinite(value), JSON.stringify(camera))
    assert.ok(camera.zoom >= MIN_ZOOM && camera.zoom <= MAX_ZOOM)
  }
})

test('zoomAt keeps the world point under the cursor fixed', () => {
  const camera = { x: 100, y: 50, zoom: 1 }
  const point = { x: 300, y: 200 }
  const next = zoomAt(camera, point, 2)
  assert.strictEqual(next.zoom, 2)
  const before = { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom }
  const after = { x: (point.x - next.x) / next.zoom, y: (point.y - next.y) / next.zoom }
  assert.deepStrictEqual(after, before)
  assert.strictEqual(zoomAt(camera, point, 1000).zoom, MAX_ZOOM)
})

test('panBy moves the camera without changing zoom', () => {
  assert.deepStrictEqual(panBy({ x: 1, y: 2, zoom: 1.5 }, 10, -5), { x: 11, y: -3, zoom: 1.5 })
})

test('expand grows a box on every side', () => {
  assert.deepStrictEqual(expand({ x: 10, y: 20, width: 100, height: 50 }, 5), { x: 5, y: 15, width: 110, height: 60 })
})

test('ease and lerpCamera hit their endpoints', () => {
  assert.strictEqual(ease(0), 0)
  assert.strictEqual(ease(1), 1)
  assert.strictEqual(ease(0.5), 0.5)
  const a = { x: 0, y: 0, zoom: 1 }
  const b = { x: 100, y: 50, zoom: 2 }
  assert.deepStrictEqual(lerpCamera(a, b, 0), a)
  assert.deepStrictEqual(lerpCamera(a, b, 1), b)
})

test('scrollThumb sizes and places the thumb within content plus padding', () => {
  const t = scrollThumb(0, 1000, 0, 500, 100)
  assert.strictEqual(t.span, 1200)
  assert.ok(Math.abs(t.size - 500 / 1200) < 1e-9)
  assert.ok(Math.abs(t.pos - 100 / 1200) < 1e-9)
})

test('scrollThumb keeps the viewport inside the track when panned past the content', () => {
  const t = scrollThumb(0, 1000, 5000, 500, 100)
  assert.ok(t.pos >= 0 && t.pos + t.size <= 1 + 1e-9)
  assert.ok(Math.abs(t.pos + t.size - 1) < 1e-9)
})
