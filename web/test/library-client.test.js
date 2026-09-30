import test from 'node:test'
import assert from 'node:assert'
import { createGroup, deleteGroup, getLibrary, patchCanvas, updateGroup } from '../src/lib/library.js'

const realFetch = globalThis.fetch
const calls = []

function stub (status, body, raw) {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return { ok: status >= 200 && status < 300, status, json: async () => { if (raw) throw new Error('not json'); return body } }
  }
}

test.beforeEach(() => { calls.length = 0 })
test.after(() => { globalThis.fetch = realFetch })

test('getLibrary GETs /api/library and returns the JSON', async () => {
  stub(200, { groups: [], canvases: [] })
  assert.deepStrictEqual(await getLibrary(), { groups: [], canvases: [] })
  assert.strictEqual(calls[0].url, '/api/library')
  assert.strictEqual(calls[0].options.method, 'GET')
})

test('mutations send JSON bodies to encoded ids', async () => {
  stub(200, {})
  await patchCanvas('a/b c', { name: 'X' })
  assert.strictEqual(calls[0].url, '/api/library/canvases/a%2Fb%20c')
  assert.strictEqual(calls[0].options.method, 'PATCH')
  assert.strictEqual(calls[0].options.headers['content-type'], 'application/json')
  assert.deepStrictEqual(JSON.parse(calls[0].options.body), { name: 'X' })
  await createGroup('G')
  assert.deepStrictEqual(JSON.parse(calls[1].options.body), { name: 'G', parentId: null })
  await updateGroup('g1', { parentId: 'p' })
  assert.strictEqual(calls[2].url, '/api/library/groups/g1')
  await deleteGroup('g1')
  assert.strictEqual(calls[3].options.method, 'DELETE')
  assert.strictEqual(calls[3].options.body, undefined)
})

test('an error envelope becomes an Error with its message', async () => {
  stub(400, { error: { code: 'INVALID_REQUEST', message: 'name must be at most 120 characters' } })
  await assert.rejects(() => patchCanvas('id', { name: 'x' }), { message: 'name must be at most 120 characters' })
})

test('a non-JSON failure falls back to the status', async () => {
  stub(502, null, true)
  await assert.rejects(() => getLibrary(), { message: 'Request failed (502)' })
})
