const express = require('express')
const { rateLimit } = require('express-rate-limit')
const { safeParseGraphDoc } = require('@coldtea/pr-lens-schema')
const { PrLensRenderError } = require('@coldtea/pr-lens-renderer')
const { ApiError, notFound, errorHandler } = require('./errors')
const { renderCanvas, renderStored, buildSummary, WalkthroughError } = require('./render')
const { parseRev } = require('./rev')
const { createViewerRouter } = require('./viewer')
const { createLibraryRouter } = require('./library')

const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/

function bearer (req) {
  const match = /^Bearer (.+)$/i.exec(req.headers.authorization || '')
  return match ? match[1] : null
}

function parseIfMatch (header) {
  const match = /^"?(\d+)"?$/.exec((header || '').trim())
  return match ? Number(match[1]) : null
}

function createApp ({ store, config }) {
  const app = express()
  const base = config.publicBaseUrl
  const links = (id) => ({ viewUrl: `${base}/c/${id}`, embedUrl: `${base}/c/${id}.svg` })
  const assetBase = (id, rev = null) => (rev ? `${base}/c/${id}/r/${rev}/assets` : `${base}/c/${id}/assets`)

  app.disable('x-powered-by')
  if (config.trustProxy) app.set('trust proxy', config.trustProxy)
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    next()
  })
  // body-parser drains the whole oversized body before answering, so reject on the declared length first
  app.use((req, res, next) => {
    if (Number(req.headers['content-length']) > config.maxBodyBytes) {
      return next(new ApiError('TOO_LARGE', 'Request body exceeds the size limit'))
    }
    next()
  })
  app.use(express.json({ limit: config.maxBodyBytes }))

  const mintLimiter = rateLimit({
    windowMs: 60_000,
    limit: config.mintRateLimit,
    standardHeaders: false,
    legacyHeaders: false,
    handler: (req, res, next) => {
      const resetAt = req.rateLimit.resetTime || new Date(Date.now() + 60_000)
      next(new ApiError('RATE_LIMITED', 'Too many canvases minted; retry later', { retryAt: resetAt.toISOString() }))
    },
  })

  app.post('/api/canvas', mintLimiter, async (req, res) => {
    const { id, writeToken } = await store.mint()
    const { viewUrl, embedUrl } = links(id)
    res.status(201).json({ id, writeToken, rev: 0, viewUrl, editUrl: `${viewUrl}#w=${writeToken}`, embedUrl })
  })

  app.get('/api/canvas/:id', async (req, res) => {
    const { id } = req.params
    const rev = parseRev(req.query.rev)
    const canvas = await store.load(id)
    if (!canvas || canvas.rev === 0) throw notFound()
    let served = canvas
    let assetRev = null
    if (rev !== null && rev !== canvas.rev) {
      served = await store.loadRevision(id, rev)
      if (!served) throw notFound()
      assetRev = rev
    }
    const { tiles } = renderStored(served.document, assetBase(id, assetRev))
    res.json({ id, rev: served.rev, latestRev: canvas.rev, ...links(id), document: served.document, tiles })
  })

  app.get('/api/canvas/:id/versions', async (req, res) => {
    const { id } = req.params
    const latestRev = await store.currentRev(id)
    if (!latestRev) throw notFound()
    const rows = await store.listVersions(id)
    res.json({
      latestRev,
      versions: rows.map(({ rev, createdAt, summary }) => ({
        rev,
        createdAt: createdAt.toISOString(),
        title: (summary && summary.title) || null,
        tiles: summary && typeof summary.tileCount === 'number' ? summary.tileCount : null,
      })),
    })
  })

  app.put('/api/canvas/:id', async (req, res) => {
    const { id } = req.params
    const ifMatch = parseIfMatch(req.headers['if-match'])
    if (ifMatch === null) throw new ApiError('INVALID_REQUEST', 'If-Match must be an integer revision')
    const token = bearer(req)
    if (!token) throw notFound()

    const access = await store.checkToken(id, token)
    if (access === 'not_found') throw notFound()
    if (access === 'unauthorized') throw notFound()

    if (!req.body || typeof req.body !== 'object') {
      throw new ApiError('INVALID_REQUEST', 'Body must be a JSON graph document')
    }
    const parsed = safeParseGraphDoc(req.body)
    if (!parsed.ok) throw new ApiError('INVALID_DOCUMENT', parsed.error.message, { issues: parsed.error.issues })

    let drawn
    try {
      drawn = renderCanvas(parsed.value, assetBase(id))
    } catch (err) {
      if (err instanceof PrLensRenderError || err instanceof WalkthroughError) throw new ApiError('CANNOT_DRAW', err.message)
      throw err
    }

    const result = await store.push(id, token, ifMatch, req.body, buildSummary(parsed.value, drawn.tiles))
    if (result.status === 'moved') {
      throw new ApiError('REVISION_MOVED', 'The canvas has moved on; pull again, then push', { rev: result.rev })
    }
    if (result.status === 'not_found') throw notFound()
    if (result.status === 'unauthorized') throw notFound()

    const { viewUrl, embedUrl } = links(id)
    res.json({ id, rev: result.rev, viewUrl, editUrl: `${viewUrl}#w=${token}`, embedUrl, tiles: drawn.tiles })
  })

  app.post('/api/canvas/:id/rotate', async (req, res) => {
    const { id } = req.params
    const newToken = req.body && req.body.writeToken
    if (typeof newToken !== 'string' || !TOKEN_RE.test(newToken)) {
      throw new ApiError('INVALID_REQUEST', 'writeToken must be 22 base64url characters')
    }
    const status = await store.rotate(id, bearer(req), newToken)
    if (status === 'not_found') throw notFound()
    if (status === 'unauthorized') throw notFound()
    res.json({ id, editUrl: `${base}/c/${id}#w=${newToken}` })
  })

  app.delete('/api/canvas/:id', async (req, res) => {
    const { id } = req.params
    const token = bearer(req)
    if (!token) throw notFound()
    const status = await store.remove(id, token)
    if (status === 'not_found') throw notFound()
    if (status === 'unauthorized') throw notFound()
    res.json({ id, deleted: true })
  })

  app.use('/api/library', createLibraryRouter({ store, config }))
  app.use(createViewerRouter({ store, config }))
  app.use((req, res, next) => next(new ApiError('NOT_FOUND', 'Route not found')))
  app.use(errorHandler)
  return app
}

module.exports = { createApp }
