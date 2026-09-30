const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { postmarkRefactorGraph } = require('@coldtea/pr-lens-schema/examples')
const { startTestApp, api, mintPushed } = require('./helpers')

function makeDist (withManifest) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prc-dist-'))
  if (withManifest) {
    fs.mkdirSync(path.join(dir, '.vite'))
    fs.mkdirSync(path.join(dir, 'assets'))
    fs.writeFileSync(path.join(dir, '.vite', 'manifest.json'), JSON.stringify({
      'src/main.jsx': { file: 'assets/main-abc.js', isEntry: true, css: ['assets/main-abc.css'] },
    }))
    fs.writeFileSync(path.join(dir, 'assets', 'main-abc.js'), 'export {}\n')
    fs.writeFileSync(path.join(dir, 'assets', 'main-abc.css'), 'body{}\n')
  }
  return dir
}

let withDist
let without
let built
let bare
let c1
let c2
const dirs = []

test.before(async () => {
  dirs.push(makeDist(true), makeDist(false))
  withDist = await startTestApp({ webDist: dirs[0] })
  without = await startTestApp({ webDist: dirs[1] })
  c1 = await mintPushed(withDist.base, postmarkRefactorGraph)
  c2 = await mintPushed(without.base, postmarkRefactorGraph)
  built = await api(withDist.base, `/c/${c1.id}`)
  bare = await api(without.base, `/c/${c2.id}`)
})
test.after(async () => {
  await withDist.close()
  await without.close()
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true })
})

test('with a build the page is a shell around the server-rendered fallback picture', () => {
  assert.strictEqual(built.status, 200)
  assert.match(built.text, new RegExp(`<div id="app" data-canvas-id="${c1.id}">`))
  assert.match(built.text, /<picture>/)
  assert.match(built.text, /<script type="module" src="\/_app\/assets\/main-abc\.js"><\/script>/)
  assert.match(built.text, /<link rel="stylesheet" href="\/_app\/assets\/main-abc\.css">/)
})

test('the shell page carries a CSP that allows the app, its images and its API only', () => {
  const csp = built.headers.get('content-security-policy')
  assert.match(csp, /default-src 'none'/)
  assert.match(csp, /script-src 'self'/)
  assert.match(csp, /img-src 'self' http:\/\/canvas\.test/)
  assert.match(csp, /connect-src 'self' http:\/\/canvas\.test/)
})

test('built files are served immutable and dotfiles (the manifest) are not', async () => {
  const js = await api(withDist.base, '/_app/assets/main-abc.js')
  assert.strictEqual(js.status, 200)
  assert.match(js.headers.get('content-type'), /javascript/)
  assert.strictEqual(js.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  const manifest = await api(withDist.base, '/_app/.vite/manifest.json')
  assert.strictEqual(manifest.status, 404)
  assert.strictEqual(manifest.json.error.code, 'NOT_FOUND')
})

test('without a build the page is today\'s static page and /_app is a JSON 404', async () => {
  assert.strictEqual(bare.status, 200)
  assert.match(bare.text, /<picture>/)
  assert.ok(!bare.text.includes('id="app"'))
  assert.ok(!bare.text.includes('<script'))
  assert.strictEqual(bare.headers.get('content-security-policy'), null)
  const missing = await api(without.base, '/_app/assets/main-abc.js')
  assert.strictEqual(missing.status, 404)
  assert.strictEqual(missing.json.error.code, 'NOT_FOUND')
})

test('an unreadable manifest also falls back to the static page', async () => {
  const broken = makeDist(false)
  dirs.push(broken)
  fs.mkdirSync(path.join(broken, '.vite'))
  fs.writeFileSync(path.join(broken, '.vite', 'manifest.json'), '{not json')
  const app = await startTestApp({ webDist: broken })
  try {
    const c = await mintPushed(app.base, postmarkRefactorGraph)
    const page = await api(app.base, `/c/${c.id}`)
    assert.strictEqual(page.status, 200)
    assert.ok(!page.text.includes('id="app"'))
  } finally {
    await app.close()
  }
})

test('the shell never contains the canvas document', () => {
  assert.ok(!built.text.includes('schemaVersion'))
  assert.ok(!built.text.includes('provenance'))
})
