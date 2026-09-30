const test = require('node:test')
const assert = require('node:assert')
const { parseGraphDoc } = require('@coldtea/pr-lens-schema')
const { payloadGraph, minimalGraph } = require('@coldtea/pr-lens-schema/examples')
const { buildSummary, renderCanvas } = require('../src/render')

const BASE = 'http://canvas.test/c/abc/assets'
const parsed = (raw) => parseGraphDoc(JSON.parse(JSON.stringify(raw)))

test('summary has title, repo, tile count and the hero thumbnail file names', () => {
  const doc = parsed(payloadGraph)
  const { tiles } = renderCanvas(doc, BASE)
  const summary = buildSummary(doc, tiles)
  assert.strictEqual(summary.title, doc.title)
  assert.strictEqual(summary.repo, `${doc.provenance.repo.owner}/${doc.provenance.repo.name}`)
  assert.strictEqual(summary.tileCount, tiles.length)
  assert.match(summary.thumb.light, /^overview-light-[0-9a-f]+\.svg$/)
  assert.match(summary.thumb.dark, /^overview-dark-[0-9a-f]+\.svg$/)
  assert.ok(tiles[0].images.light.endsWith(`/${summary.thumb.light}`))
})

test('a document without a repo gives repo null, and a no-tiles list gives thumb null', () => {
  const doc = parsed(minimalGraph)
  const { tiles } = renderCanvas(doc, BASE)
  const summary = buildSummary({ ...doc, provenance: {} }, tiles)
  assert.strictEqual(summary.repo, null)
  assert.strictEqual(buildSummary(doc, []).thumb, null)
  assert.strictEqual(buildSummary(doc, []).tileCount, 0)
})

test('summary is plain JSON-serialisable data', () => {
  const doc = parsed(payloadGraph)
  const summary = buildSummary(doc, renderCanvas(doc, BASE).tiles)
  assert.deepStrictEqual(JSON.parse(JSON.stringify(summary)), summary)
})
