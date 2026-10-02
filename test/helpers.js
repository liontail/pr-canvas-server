const crypto = require('crypto')
const { createStore } = require('../src/store')

if (!process.env.MONGODB_URI) {
  throw new Error('Set MONGODB_URI to run these tests; each file uses a throwaway database that is dropped afterwards')
}
const uri = process.env.MONGODB_URI

async function openTestStore (options = {}) {
  const dbName = `pr_canvas_test_${crypto.randomBytes(6).toString('hex')}`
  const store = await createStore({ uri, dbName, ...options })
  return {
    store,
    dbName,
    async close () {
      await store.dropDatabase()
      await store.close()
    },
  }
}

async function startTestApp (configOverrides = {}, { askClient } = {}) {
  const { createApp } = require('../src/app')
  const { store, close: closeStore } = await openTestStore()
  const config = {
    publicBaseUrl: 'http://canvas.test',
    maxBodyBytes: 10_000_000,
    mintRateLimit: 1000,
    ...configOverrides,
  }
  const server = await new Promise((resolve) => {
    const s = createApp({ store, config, askClient }).listen(0, '127.0.0.1', () => resolve(s))
  })
  const base = `http://127.0.0.1:${server.address().port}`
  return {
    base,
    config,
    store,
    async close () {
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
      await closeStore()
    },
  }
}

async function api (base, path, { method = 'GET', token, ifMatch, body, raw, headers = {} } = {}) {
  const h = { ...headers }
  if (token) h.authorization = `Bearer ${token}`
  if (ifMatch !== undefined) h['if-match'] = String(ifMatch)
  let payload
  if (raw !== undefined) {
    payload = raw
  } else if (body !== undefined) {
    payload = JSON.stringify(body)
    h['content-type'] = 'application/json'
  }
  const res = await fetch(base + path, { method, headers: h, body: payload })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, headers: res.headers, text, json }
}

async function mintPushed (base, document) {
  const minted = (await api(base, '/api/canvas', { method: 'POST' })).json
  const pushed = await api(base, `/api/canvas/${minted.id}`, {
    method: 'PUT', token: minted.writeToken, ifMatch: 0, body: document,
  })
  return { ...minted, pushed }
}

module.exports = { openTestStore, startTestApp, api, mintPushed }
