const byId = (list, id) => (Array.isArray(list) ? list.find((item) => item.id === id) : undefined)

export function lookup (document, target) {
  if (!document || !target) return undefined
  if (target.kind === 'message') {
    const flow = byId(document.flows, target.flow)
    return flow ? byId(flow.messages, target.id) : undefined
  }
  if (target.kind === 'node') return byId(document.nodes, target.id)
  return byId(document.edges, target.id)
}

export function tooltipText (document, target) {
  const item = lookup(document, target)
  if (!item) return ''
  if (target.kind === 'message') {
    const { payload } = item
    if (!payload) return item.label
    const request = payload.request ? payload.request.type : 'void'
    const response = payload.response ? payload.response.type : 'void'
    return `${request} → ${response}${item.repeat > 1 ? ` × ${item.repeat}` : ''}`
  }
  if (target.kind === 'node') return item.subtitle ? `${item.label} · ${item.subtitle}` : item.label
  return item.label || `${item.from} → ${item.to}`
}
