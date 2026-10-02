import test from 'node:test'
import assert from 'node:assert'
import { askQuestion, parseSse } from '../src/lib/ask.js'

test('parses complete events and keeps the unfinished tail', () => {
  const { events, rest } = parseSse('data: {"t":"a"}\n\ndata: {"t":"b"}\n\nevent: done\ndata: {}\n\ndata: {"t":"c')
  assert.deepStrictEqual(events, [
    { event: 'message', data: '{"t":"a"}' },
    { event: 'message', data: '{"t":"b"}' },
    { event: 'done', data: '{}' },
  ])
  assert.strictEqual(rest, 'data: {"t":"c')
})

test('an event split across two reads is parsed once the rest arrives', () => {
  const first = parseSse('data: {"t":"he')
  assert.deepStrictEqual(first.events, [])
  const second = parseSse(first.rest + 'llo"}\n\n')
  assert.deepStrictEqual(second.events, [{ event: 'message', data: '{"t":"hello"}' }])
  assert.strictEqual(second.rest, '')
})

test('error events carry their name', () => {
  const { events } = parseSse('event: error\ndata: {"message":"x"}\n\n')
  assert.deepStrictEqual(events, [{ event: 'error', data: '{"message":"x"}' }])
})

function sseFetch (chunks, init = {}) {
  const encoder = new TextEncoder()
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return {
      ok: true,
      status: 200,
      body: new ReadableStream({
        start (controller) {
          for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
          controller.close()
        },
      }),
      ...init,
    }
  }
  return { calls, restore: () => { globalThis.fetch = original } }
}

const args = { canvasId: 'c1', question: 'why', rev: 2, selected: { kind: 'component', id: 'a' } }

test('askQuestion accumulates deltas and resolves on done', async () => {
  const stub = sseFetch(['data: {"t":"Hel"}\n\n', 'data: {"t":"lo"}\n\nevent: done\ndata: {}\n\n'])
  const seen = []
  try {
    await askQuestion({ ...args, onText: (t) => seen.push(t) })
  } finally {
    stub.restore()
  }
  assert.deepStrictEqual(seen, ['Hel', 'Hello'])
})

test('askQuestion rejects with the message of an error event', async () => {
  const stub = sseFetch(['event: error\ndata: {"message":"nope"}\n\n'])
  try {
    await assert.rejects(askQuestion({ ...args, onText () {} }), { message: 'nope' })
  } finally {
    stub.restore()
  }
})

test('askQuestion rejects when the stream ends without done', async () => {
  const stub = sseFetch(['data: {"t":"partial"}\n\n'])
  try {
    await assert.rejects(askQuestion({ ...args, onText () {} }), { message: 'The answer was interrupted' })
  } finally {
    stub.restore()
  }
})

test('askQuestion surfaces the JSON error message of a non-2xx response', async () => {
  const stub = sseFetch([], {
    ok: false,
    status: 429,
    json: async () => ({ error: { message: 'Too many questions, try again shortly' } }),
  })
  try {
    await assert.rejects(askQuestion({ ...args, onText () {} }), { message: 'Too many questions, try again shortly' })
  } finally {
    stub.restore()
  }
})

test('askQuestion POSTs the question, rev and selection as JSON', async () => {
  const stub = sseFetch(['event: done\ndata: {}\n\n'])
  try {
    await askQuestion({ ...args, onText () {} })
  } finally {
    stub.restore()
  }
  const { url, options } = stub.calls[0]
  assert.strictEqual(url, '/api/canvas/c1/ask')
  assert.strictEqual(options.method, 'POST')
  assert.deepStrictEqual(JSON.parse(options.body), { question: 'why', rev: 2, selected: { kind: 'component', id: 'a' } })
})
