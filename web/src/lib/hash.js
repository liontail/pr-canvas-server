import { MIN_ZOOM, MAX_ZOOM } from './camera.js'

const round = (value, digits = 0) => Number(value.toFixed(digits))

export function parseHash (hash) {
  const out = { view: null, step: null, w: null }
  for (const part of String(hash).replace(/^#/, '').split('&')) {
    const at = part.indexOf('=')
    if (at < 0) continue
    const key = part.slice(0, at)
    const value = part.slice(at + 1)
    if (key === 'v') {
      const parts = value.split(',')
      if (parts.length === 3 && parts.every((p) => p.trim() !== '')) {
        const nums = parts.map(Number)
        if (nums.every(Number.isFinite) && nums[2] > 0 && nums[2] >= MIN_ZOOM && nums[2] <= MAX_ZOOM && Math.abs(nums[0]) <= 1e7 && Math.abs(nums[1]) <= 1e7) {
          out.view = { x: nums[0], y: nums[1], zoom: nums[2] }
        }
      }
    } else if (key === 's') {
      if (/^\d+$/.test(value) && Number(value) >= 1) out.step = Number(value)
    } else if (key === 'w') {
      if (/^[A-Za-z0-9_-]+$/.test(value)) out.w = value
    }
  }
  return out
}

export function serializeHash ({ view, step, w } = {}) {
  const parts = []
  if (step) parts.push(`s=${step}`)
  else if (view) parts.push(`v=${round(view.x)},${round(view.y)},${round(view.zoom, 3)}`)
  if (w) parts.push(`w=${w}`)
  return parts.length ? `#${parts.join('&')}` : ''
}
