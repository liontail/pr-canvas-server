const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { startTestApp, api } = require('./helpers')

function makeDist (withManifest) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prc-home-'))
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

let built
let bare
const dirs = []

test.before(async () => {
  dirs.push(makeDist(true), makeDist(false))
  built = await startTestApp({ webDist: dirs[0] })
  bare = await startTestApp({ webDist: dirs[1] })
})
test.after(async () => {
  await built.close()
  await bare.close()
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true })
})

test('with a build, / is the home shell with the app tags and the same CSP as the canvas shell', async () => {
  const res = await api(built.base, '/')
  assert.strictEqual(res.status, 200)
  assert.match(res.headers.get('content-type'), /text\/html/)
  assert.match(res.text, /<title>Diagrams<\/title>/)
  assert.match(res.text, /<div id="app" data-page="home"><\/div>/)
  assert.match(res.text, /<script type="module" src="\/_app\/assets\/main-abc\.js"><\/script>/)
  assert.match(res.text, /<link rel="stylesheet" href="\/_app\/assets\/main-abc\.css">/)
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/)
  assert.match(res.headers.get('content-security-policy'), /connect-src 'self' http:\/\/canvas\.test/)
})

test('the home shell contains no canvas data', async () => {
  const res = await api(built.base, '/')
  assert.ok(!res.text.includes('tokenHash'))
  assert.ok(!res.text.includes('schemaVersion'))
})

test('without a build, / is a static page that says how to build the web app', async () => {
  const res = await api(bare.base, '/')
  assert.strictEqual(res.status, 200)
  assert.match(res.text, /npm run build:web/)
  assert.ok(!res.text.includes('<script'))
  assert.strictEqual(res.headers.get('content-security-policy'), null)
})

test('other unknown paths still answer with the JSON NOT_FOUND envelope', async () => {
  const res = await api(built.base, '/nope')
  assert.strictEqual(res.status, 404)
  assert.strictEqual(res.json.error.code, 'NOT_FOUND')
})
