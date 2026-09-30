import { lookup } from './describe.js'

const pretty = (value) => JSON.stringify(value, null, 2)
const isObject = (value) => value !== null && typeof value === 'object'

export function fileText (file) {
  if (!file.startLine) return file.path
  const end = file.endLine && file.endLine !== file.startLine ? `-${file.endLine}` : ''
  return `${file.path}:${file.startLine}${end}`
}

export function diffPaths (before, after, path = '') {
  if (JSON.stringify(before) === JSON.stringify(after)) return []
  if (!isObject(before) || !isObject(after) || Array.isArray(before) !== Array.isArray(after)) return [path || '$']
  const out = []
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const child = Array.isArray(before) ? `${path}[${key}]` : (path ? `${path}.${key}` : key)
    out.push(...diffPaths(before[key], after[key], child))
  }
  return out
}

function side (name, data) {
  const declared = data.changedPaths && data.changedPaths.length ? data.changedPaths : null
  const computed = data.before !== undefined && data.sample !== undefined ? diffPaths(data.before, data.sample) : []
  return {
    name,
    type: data.type,
    shape: data.shape || null,
    sample: data.sample === undefined ? null : pretty(data.sample),
    before: data.before === undefined ? null : pretty(data.before),
    changedPaths: declared || computed,
  }
}

export function detailModel (document, target) {
  const item = lookup(document, target)
  if (!item) return null
  const files = (item.files || []).map(fileText)

  if (target.kind === 'message') {
    const meta = [['Route', `${item.from} → ${item.to}`], ['Kind', item.kind], ['Change', item.delta]]
    if (item.repeat > 1) meta.push(['Repeats', `${item.repeat} per run`])
    const sides = []
    if (item.payload && item.payload.request) sides.push(side('Request', item.payload.request))
    if (item.payload && item.payload.response) sides.push(side('Response', item.payload.response))
    return { kind: 'message', title: item.label, note: item.note || null, meta, badges: [], sides, files }
  }

  if (target.kind === 'node') {
    const meta = [['Kind', item.kind], ['Change', item.delta]]
    const lane = (document.lanes || []).find((entry) => entry.id === item.lane)
    if (lane) meta.push(['Lane', lane.label])
    return { kind: 'node', title: item.label, note: item.summary || item.subtitle || null, meta, badges: item.badges || [], sides: [], files }
  }

  const meta = [['Route', `${item.from} → ${item.to}`], ['Kind', item.kind], ['Change', item.delta]]
  return { kind: 'edge', title: item.label || `${item.from} → ${item.to}`, note: null, meta, badges: [], sides: [], files }
}
