const test = require('node:test')
const assert = require('node:assert')
const { staticSvg } = require('../src/viewer')

test('staticSvg drops animated flow dots and keeps the rest', () => {
  const svg = '<svg><path d="M0 0"/><circle r="3" fill="#6e7681"><animateMotion dur="2.1s" repeatCount="indefinite" path="M1,2 L3,4"/></circle><rect/></svg>'
  assert.strictEqual(staticSvg(svg), '<svg><path d="M0 0"/><rect/></svg>')
})

test('staticSvg removes stray animate elements but leaves static circles', () => {
  const svg = '<svg><circle r="3"/><rect><animate attributeName="x" dur="1s"/></rect></svg>'
  assert.strictEqual(staticSvg(svg), '<svg><circle r="3"/><rect></rect></svg>')
})
