const { renderAll, renderAssetFileName } = require('@coldtea/pr-lens-renderer')
const { parseGraphDoc } = require('@coldtea/pr-lens-schema')

function indexViews (views, trail, out) {
  for (const view of views) {
    const crumbs = [...trail, view.title]
    out.set(view.id, { title: view.title, crumbs })
    indexViews(view.children, crumbs, out)
  }
  return out
}

class WalkthroughError extends Error {}

function unionBox (boxes) {
  const x1 = Math.min(...boxes.map((box) => box.x))
  const y1 = Math.min(...boxes.map((box) => box.y))
  const x2 = Math.max(...boxes.map((box) => box.x + box.width))
  const y2 = Math.max(...boxes.map((box) => box.y + box.height))
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

function pickTile (step, tiles) {
  const { stage } = step
  if (!stage) return tiles[0]
  if (stage.kind === 'view') {
    const tile = tiles.find((item) => item.id === `view:${stage.view}`)
    if (!tile) throw new WalkthroughError(`Walkthrough step "${step.id}" is staged on view "${stage.view}", which was not drawn`)
    return tile
  }
  const tile = tiles.find((item) => Object.hasOwn(item.atlas.messages, stage.flow))
  if (!tile) throw new WalkthroughError(`Walkthrough step "${step.id}" is staged on flow "${stage.flow}", which was not drawn`)
  return tile
}

function focusRects (step, tile) {
  const { focus, stage } = step
  if (focus.kind === 'all') return []
  const rects = []
  const missing = []
  for (const kind of ['lanes', 'nodes', 'edges']) {
    for (const id of focus[kind]) {
      const box = Object.hasOwn(tile.atlas[kind], id) ? tile.atlas[kind][id] : undefined
      if (box) rects.push(box)
      else missing.push(`${kind.slice(0, -1)} "${id}"`)
    }
  }
  for (const id of focus.messages) {
    let box
    if (stage && stage.kind === 'flow' && Object.hasOwn(tile.atlas.messages, stage.flow) && Object.hasOwn(tile.atlas.messages[stage.flow], id)) {
      box = tile.atlas.messages[stage.flow][id]
    }
    if (box) rects.push(box)
    else missing.push(`message "${id}"`)
  }
  if (missing.length) {
    throw new WalkthroughError(`Walkthrough step "${step.id}" names ${missing.join(', ')}, which the "${tile.title}" diagram does not contain`)
  }
  return rects
}

function attachSteps (doc, tiles, strict) {
  const steps = doc.walkthrough ? doc.walkthrough.steps : []
  for (const step of steps) {
    try {
      const tile = pickTile(step, tiles)
      const rects = focusRects(step, tile)
      const bounds = rects.length ? unionBox(rects) : { x: 0, y: 0, width: tile.width, height: tile.height }
      tile.steps.push({ id: step.id, rects, bounds })
    } catch (err) {
      if (strict || !(err instanceof WalkthroughError)) throw err
    }
  }
}

function renderCanvas (doc, assetBaseUrl, { strict = true } = {}) {
  const { assets } = renderAll(doc)
  const views = indexViews(doc.views, [], new Map())
  const files = new Map()
  const groups = new Map()

  for (const rendered of assets) {
    const { asset } = rendered
    const fileName = renderAssetFileName(
      { lens: asset.lens, theme: asset.theme, view: asset.view },
      asset.contentHash,
    )
    files.set(fileName, rendered.svg)
    const key = `${asset.view ?? ''}|${asset.lens}`
    if (!groups.has(key)) groups.set(key, { asset, themes: {} })
    groups.get(key).themes[asset.theme] = {
      svg: rendered.svg,
      fileName,
      width: rendered.width,
      height: rendered.height,
      atlas: rendered.atlas,
    }
  }

  const drawn = [...groups.values()].map(({ asset, themes }, index) => {
    const info = asset.view ? views.get(asset.view) : undefined
    return {
      id: asset.view ? `view:${asset.view}` : `lens:${asset.lens}`,
      title: info ? info.title : asset.lens,
      lens: asset.lens,
      crumbs: info ? info.crumbs : [],
      hero: index === 0,
      width: themes.light.width,
      height: themes.light.height,
      renders: { light: themes.light.svg, dark: themes.dark.svg },
      images: {
        light: `${assetBaseUrl}/${themes.light.fileName}`,
        dark: `${assetBaseUrl}/${themes.dark.fileName}`,
      },
      steps: [],
      atlas: themes.light.atlas,
    }
  })

  attachSteps(doc, drawn, strict)
  const tiles = drawn.map(({ atlas, ...tile }) => ({
    ...tile,
    hits: { nodes: atlas.nodes, edges: atlas.edges, messages: atlas.messages },
  }))
  return { files, tiles }
}

// Stored documents were valid when pushed; a walkthrough that stopped resolving must not break reading them
function renderStored (document, assetBaseUrl) {
  return renderCanvas(parseGraphDoc(document), assetBaseUrl, { strict: false })
}

function buildSummary (document, tiles) {
  const repo = document.provenance && document.provenance.repo
  const hero = tiles.find((tile) => tile.hero)
  const fileOf = (url) => url.slice(url.lastIndexOf('/') + 1)
  return {
    title: document.title,
    repo: repo ? `${repo.owner}/${repo.name}` : null,
    tileCount: tiles.length,
    thumb: hero ? { light: fileOf(hero.images.light), dark: fileOf(hero.images.dark) } : null,
  }
}

module.exports = { renderCanvas, renderStored, buildSummary, WalkthroughError }
