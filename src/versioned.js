const { ApiError, notFound } = require('./errors')
const { diffGraphs } = require('./diff')
const { renderStored } = require('./render')

const assetBaseFor = (publicBaseUrl) => (id, rev = null, base = null) => {
  const root = `${publicBaseUrl}/c/${id}`
  if (base !== null) return `${root}/r/${rev}/b/${base}/assets`
  return rev ? `${root}/r/${rev}/assets` : `${root}/assets`
}

// The drawing of version `rev` (default: the latest), or of its diff against version `base`.
async function resolveVersion (store, id, rev, base, assetBase) {
  const canvas = await store.load(id)
  if (!canvas || canvas.rev === 0) throw notFound()
  const target = rev === null || rev === canvas.rev ? canvas : await store.loadRevision(id, rev)
  if (!target) throw notFound()
  const isLatest = target.rev === canvas.rev
  if (base === null) {
    const drawn = renderStored(target.document, assetBase(id, isLatest ? null : target.rev))
    return { latestRev: canvas.rev, rev: target.rev, base: null, document: target.document, ...drawn }
  }
  if (base === target.rev) throw new ApiError('INVALID_REQUEST', 'base must differ from rev')
  const before = base === canvas.rev ? canvas : await store.loadRevision(id, base)
  if (!before) throw notFound()
  const document = diffGraphs(before.document, target.document)
  try {
    const drawn = renderStored(document, assetBase(id, target.rev, base))
    return { latestRev: canvas.rev, rev: target.rev, base, document, ...drawn }
  } catch {
    throw new ApiError('CANNOT_DRAW', 'These two versions cannot be compared')
  }
}

module.exports = { assetBaseFor, resolveVersion }
