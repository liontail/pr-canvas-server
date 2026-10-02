const test = require('node:test')
const assert = require('node:assert')
const { loadConfig } = require('../src/config')

test('throws naming every missing required variable', () => {
  assert.throws(() => loadConfig({}), /MONGODB_URI, PUBLIC_BASE_URL/)
})

test('applies defaults and strips trailing slashes from the base URL', () => {
  const config = loadConfig({ MONGODB_URI: 'mongodb://x', PUBLIC_BASE_URL: 'https://canvas.example.com//' })
  assert.deepStrictEqual(config, {
    mongoUri: 'mongodb://x',
    mongoDb: 'pr_canvas',
    publicBaseUrl: 'https://canvas.example.com',
    port: 3000,
    mintRateLimit: 30,
    maxBodyBytes: 10_000_000,
    trustProxy: undefined,
  })
})

test('reads overrides and converts a numeric TRUST_PROXY to a number', () => {
  const config = loadConfig({
    MONGODB_URI: 'mongodb://x',
    PUBLIC_BASE_URL: 'http://h',
    MONGODB_DB: 'other',
    PORT: '8080',
    MINT_RATE_LIMIT: '5',
    TRUST_PROXY: '1',
  })
  assert.strictEqual(config.mongoDb, 'other')
  assert.strictEqual(config.port, 8080)
  assert.strictEqual(config.mintRateLimit, 5)
  assert.strictEqual(config.trustProxy, 1)
})

test('rejects TRUST_PROXY=true and accepts loopback', () => {
  const env = { MONGODB_URI: 'mongodb://x', PUBLIC_BASE_URL: 'http://h' }
  assert.throws(() => loadConfig({ ...env, TRUST_PROXY: 'true' }), /hop count/)
  assert.strictEqual(loadConfig({ ...env, TRUST_PROXY: 'loopback' }).trustProxy, 'loopback')
})

test('rejects a base URL with a path or without a scheme', () => {
  const env = { MONGODB_URI: 'mongodb://x' }
  assert.throws(() => loadConfig({ ...env, PUBLIC_BASE_URL: 'https://h/canvas' }), /PUBLIC_BASE_URL/)
  assert.throws(() => loadConfig({ ...env, PUBLIC_BASE_URL: 'canvas.example.com' }), /PUBLIC_BASE_URL/)
})

const ENV = { MONGODB_URI: 'mongodb://x', PUBLIC_BASE_URL: 'http://h' }
const ASK_ENV = { OPEN_AI_API_KEY: 'k', OPEN_AI_MODEL: 'm', OPEN_AI_BASEURL: 'http://bifrost.test/v1' }

test('ask is absent when no OPEN_AI_* variable is set', () => {
  assert.strictEqual('ask' in loadConfig(ENV), false)
})

test('ask is configured with defaults when all three OPEN_AI_* variables are set', () => {
  assert.deepStrictEqual(loadConfig({ ...ENV, ...ASK_ENV }).ask, {
    apiKey: 'k',
    model: 'm',
    baseUrl: 'http://bifrost.test/v1',
    rateLimit: 10,
    dailyCap: 500,
  })
})

test('ASK_RATE_LIMIT and ASK_DAILY_CAP override the defaults', () => {
  const { ask } = loadConfig({ ...ENV, ...ASK_ENV, ASK_RATE_LIMIT: '3', ASK_DAILY_CAP: '40' })
  assert.strictEqual(ask.rateLimit, 3)
  assert.strictEqual(ask.dailyCap, 40)
})

test('a partial OPEN_AI_* set throws naming the missing variables', () => {
  assert.throws(() => loadConfig({ ...ENV, OPEN_AI_API_KEY: 'k' }), /OPEN_AI_MODEL, OPEN_AI_BASEURL/)
})
