const REQUIRED = ['MONGODB_URI', 'PUBLIC_BASE_URL']

function loadConfig (env = process.env) {
  const missing = REQUIRED.filter((key) => !env[key])
  if (missing.length) throw new Error(`Missing required env: ${missing.join(', ')}`)

  const proxy = env.TRUST_PROXY
  if (proxy === 'true' || proxy === 'false') {
    throw new Error('TRUST_PROXY must be a hop count (e.g. 1) or a value like loopback, not true/false')
  }
  const publicBaseUrl = env.PUBLIC_BASE_URL.replace(/\/+$/, '')
  let url
  try { url = new URL(publicBaseUrl) } catch { url = null }
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('PUBLIC_BASE_URL must be an http(s) origin without a path, e.g. https://canvas.example.com')
  }
  return {
    mongoUri: env.MONGODB_URI,
    mongoDb: env.MONGODB_DB || 'pr_canvas',
    publicBaseUrl,
    port: Number(env.PORT) || 3000,
    mintRateLimit: Number(env.MINT_RATE_LIMIT) || 30,
    maxBodyBytes: 10_000_000,
    trustProxy: proxy ? (/^\d+$/.test(proxy) ? Number(proxy) : proxy) : undefined,
    ...(/^[1-9]\d*$/.test(env.MAX_REVISIONS || '') ? { maxRevisions: Number(env.MAX_REVISIONS) } : {}),
  }
}

module.exports = { loadConfig }
