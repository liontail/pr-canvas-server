const fs = require('fs')
const path = require('path')
const express = require('express')
const { ApiError, notFound } = require('./errors')
const { parseRev } = require('./rev')
const { assetBaseFor, resolveVersion } = require('./versioned')

const ID_RE = /^[A-Za-z0-9_-]{22}$/
const PAGE_RE = /^([A-Za-z0-9_-]{22})(\.svg)?$/

const RENDER_CACHE = 50

const SVG_CSP = "default-src 'none'; style-src 'unsafe-inline'"

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

function esc (text) {
  return String(text).replace(/[&<>"']/g, (char) => ESCAPES[char])
}

function loadAssets (distDir) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(distDir, '.vite', 'manifest.json'), 'utf8'))
    const entry = Object.values(manifest).find((item) => item.isEntry)
    if (!entry) return null
    return { js: `/_app/${entry.file}`, css: (entry.css || []).map((file) => `/_app/${file}`) }
  } catch {
    return null
  }
}

function pageCsp (publicBaseUrl) {
  const origin = new URL(publicBaseUrl).origin
  return `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' ${origin} data:; connect-src 'self' ${origin}`
}

function page (hero, id, assets) {
  const picture = `<picture>
<source media="(prefers-color-scheme: dark)" srcset="${esc(hero.images.dark)}">
<img src="${esc(hero.images.light)}" alt="${esc(hero.title)}">
</picture>`
  const styles = assets ? assets.css.map((href) => `<link rel="stylesheet" href="${esc(href)}">`).join('\n') : ''
  const body = assets
    ? `<div id="app" data-canvas-id="${esc(id)}">${picture}</div>\n<script type="module" src="${esc(assets.js)}"></script>`
    : picture
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(hero.title)}</title>
${assets ? '' : fallbackStyle}
${styles}
</head>
<body>
${body}
</body>
</html>
`
}

const fallbackStyle = '<style>body{margin:0;padding:2rem;font-family:system-ui,sans-serif;background:#fff;color:#111}@media(prefers-color-scheme:dark){body{background:#0d1117;color:#c9d1d9}}img{max-width:100%;height:auto}</style>'

function homePage (assets) {
  const styles = assets.css.map((href) => `<link rel="stylesheet" href="${esc(href)}">`).join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diagrams</title>
${styles}
</head>
<body>
<div id="app" data-page="home"></div>
<noscript>The library needs JavaScript.</noscript>
<script type="module" src="${esc(assets.js)}"></script>
</body>
</html>
`
}

function homeFallback () {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diagrams</title>
</head>
<body style="font-family:system-ui,sans-serif;padding:2rem">
<p>The library needs the web app. Run <code>npm run build:web</code> and restart the server.</p>
</body>
</html>
`
}

function createViewerRouter ({ store, config }) {
  const router = express.Router()
  const distDir = config.webDist || path.join(__dirname, '..', 'public')
  const assets = loadAssets(distDir)
  if (assets) {
    router.use('/_app', express.static(distDir, {
      index: false,
      dotfiles: 'ignore',
      setHeaders (res) { res.setHeader('Cache-Control', 'public, max-age=31536000, immutable') },
    }))
  }
  const assetBase = assetBaseFor(config.publicBaseUrl)

  // Rendering re-draws every tile, so cache by the canvas's current rev (a cheap doc-less lookup); Map order gives LRU eviction.
  const rendered = new Map()
  async function drawn (id, rev = null, base = null) {
    if (!ID_RE.test(id)) throw notFound()
    const row = await store.getLibraryRow(id)
    if (!row) return resolveVersion(store, id, rev, base, assetBase)
    const key = `${id}:${row.rev}:${row.lastWriteAt.getTime()}:${rev}:${base}`
    const hit = rendered.get(key)
    if (hit) {
      rendered.delete(key)
      rendered.set(key, hit)
      return hit
    }
    const found = await resolveVersion(store, id, rev, base, assetBase)
    rendered.set(key, found)
    if (rendered.size > RENDER_CACHE) rendered.delete(rendered.keys().next().value)
    return found
  }

  router.get('/', (req, res) => {
    if (!assets) return res.type('html').send(homeFallback())
    res.set('Content-Security-Policy', pageCsp(config.publicBaseUrl)).type('html').send(homePage(assets))
  })

  // One handler for `<id>` and `<id>.svg`: Express would otherwise match `:id` against `abc.svg`
  router.get('/c/:idExt', async (req, res) => {
    const match = PAGE_RE.exec(req.params.idExt)
    if (!match) throw notFound()
    let found
    try {
      found = await drawn(match[1], parseRev(req.query.rev), parseRev(req.query.base))
    } catch (err) {
      // The page is only a shell: for a bad diff link serve the latest so the app can say why the diff failed
      if (match[2] || !(err instanceof ApiError) || req.query.base === undefined) throw err
      found = await drawn(match[1])
    }
    const { tiles } = found
    const hero = tiles.find((tile) => tile.hero)
    if (match[2]) {
      const theme = req.query.theme === 'dark' ? 'dark' : 'light'
      return res.set('Content-Security-Policy', SVG_CSP).type('image/svg+xml').send(hero.renders[theme])
    }
    if (assets) res.set('Content-Security-Policy', pageCsp(config.publicBaseUrl))
    res.type('html').send(page(hero, match[1], assets))
  })

  async function sendAsset (req, res) {
    const { files } = await drawn(req.params.id, parseRev(req.params.rev), parseRev(req.params.base))
    const svg = files.get(req.params.file)
    if (!svg) throw notFound()
    res.set({ 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Security-Policy': SVG_CSP }).type('image/svg+xml').send(svg)
  }
  router.get('/c/:id/assets/:file', sendAsset)
  router.get('/c/:id/r/:rev/assets/:file', sendAsset)
  router.get('/c/:id/r/:rev/b/:base/assets/:file', sendAsset)

  return router
}

module.exports = { createViewerRouter, esc }
