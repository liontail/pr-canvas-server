export function parseSse (buffer) {
  const blocks = buffer.split('\n\n')
  const rest = blocks.pop()
  const events = blocks.map((block) => {
    let event = 'message'
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7)
      else if (line.startsWith('data: ')) data += line.slice(6)
    }
    return { event, data }
  })
  return { events, rest }
}

export async function askQuestion ({ canvasId, question, rev, selected, signal, onText }) {
  const res = await fetch(`/api/canvas/${canvasId}/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, rev, selected }),
    signal,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body.error && body.error.message) || `Request failed (${res.status})`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let finished = false
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parsed = parseSse(buffer)
      buffer = parsed.rest
      for (const { event, data } of parsed.events) {
        if (event === 'error') throw new Error(JSON.parse(data).message)
        if (event === 'done') finished = true
        if (event === 'message') {
          text += JSON.parse(data).t
          onText(text)
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }
  if (!finished) throw new Error('The answer was interrupted')
}
