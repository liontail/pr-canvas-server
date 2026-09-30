const express = require('express')
const { ApiError, notFound } = require('./errors')
const { buildSummary, renderStored } = require('./render')
const { parseRev } = require('./rev')
const validate = require('./library-validate')

const invalid = (message) => new ApiError('INVALID_REQUEST', message)

function bodyObject (req, allowed) {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Body must be a JSON object')
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key))
  if (unknown.length) throw invalid(`Unknown field: ${unknown.join(', ')}`)
  return body
}

function createLibraryRouter ({ store, config }) {
  const router = express.Router()
  const base = config.publicBaseUrl

  const toGroup = (row) => ({ id: row._id, name: row.name, parentId: row.parentId })

  function toCanvas (row, versions = 1) {
    const summary = row.summary || {}
    const meta = row.meta || {}
    return {
      id: row._id,
      name: meta.name ?? null,
      title: summary.title ?? '',
      repo: summary.repo ?? null,
      rev: row.rev,
      createdAt: row.createdAt.toISOString(),
      lastWriteAt: row.lastWriteAt.toISOString(),
      tiles: summary.tileCount ?? 0,
      tags: meta.tags || [],
      groupId: meta.groupId ?? null,
      thumb: summary.thumb ?? null,
      viewUrl: `${base}/c/${row._id}`,
      versions,
    }
  }

  async function ensureSummaries (rows) {
    for (const row of rows) {
      if (row.summary) continue
      const loaded = await store.load(row._id)
      const document = loaded && loaded.document
      let summary = { title: (document && document.title) || 'Untitled', repo: null, tileCount: 0, thumb: null }
      if (document) {
        try {
          summary = buildSummary(document, renderStored(document, `${base}/c/${row._id}/assets`).tiles)
        } catch {}
      }
      await store.setSummary(row._id, row.rev, summary)
      row.summary = summary
    }
  }

  router.get('/', async (req, res) => {
    const rows = await store.listLibrary()
    await ensureSummaries(rows)
    const groups = await store.listGroups()
    const counts = await store.versionCounts()
    res.json({ groups: groups.map(toGroup), canvases: rows.map((row) => toCanvas(row, counts.get(row._id) || 1)) })
  })

  router.patch('/canvases/:id', async (req, res) => {
    const body = bodyObject(req, ['name', 'tags', 'groupId'])
    const patch = {}
    if ('name' in body) patch.name = validate.normalizeName(body.name)
    if ('tags' in body) patch.tags = validate.normalizeTags(body.tags)
    if ('groupId' in body) {
      if (body.groupId !== null && typeof body.groupId !== 'string') throw invalid('groupId must be a string or null')
      if (body.groupId !== null && !(await store.getGroup(body.groupId))) throw invalid('group does not exist')
      patch.groupId = body.groupId
    }
    if (!Object.keys(patch).length) throw invalid('Nothing to update')
    const row = await store.patchMeta(req.params.id, patch)
    if (!row) throw notFound()
    res.json(toCanvas(row, (await store.versionCount(row._id)) || 1))
  })

  router.post('/groups', async (req, res) => {
    const body = bodyObject(req, ['name', 'parentId'])
    const name = validate.normalizeGroupName(body.name)
    const parentId = body.parentId === undefined ? null : body.parentId
    if (parentId !== null && typeof parentId !== 'string') throw invalid('parentId must be a string or null')
    validate.checkPlacement(await store.listGroups(), null, parentId)
    res.status(201).json(toGroup(await store.createGroup({ name, parentId })))
  })

  router.patch('/groups/:id', async (req, res) => {
    const body = bodyObject(req, ['name', 'parentId'])
    const groups = await store.listGroups()
    const current = groups.find((group) => group._id === req.params.id)
    if (!current) throw notFound()
    const patch = {}
    if ('name' in body) patch.name = validate.normalizeGroupName(body.name)
    if ('parentId' in body) {
      if (body.parentId !== null && typeof body.parentId !== 'string') throw invalid('parentId must be a string or null')
      validate.checkPlacement(groups, current._id, body.parentId)
      patch.parentId = body.parentId
    }
    if (!Object.keys(patch).length) throw invalid('Nothing to update')
    const row = await store.updateGroup(current._id, patch)
    if (!row) throw notFound()
    res.json(toGroup(row))
  })

  router.delete('/canvases/:id', async (req, res) => {
    if (!(await store.deleteCanvas(req.params.id))) throw notFound()
    res.json({ id: req.params.id, deleted: true })
  })

  router.delete('/canvases/:id/versions/:rev', async (req, res) => {
    const rev = parseRev(req.params.rev)
    const result = await store.deleteVersion(req.params.id, rev)
    if (result === 'not_found') throw notFound()
    if (result === 'last_version') throw new ApiError('LAST_VERSION', 'This is the only version; delete the diagram instead')
    res.json({ id: req.params.id, rev, deleted: true, latestRev: await store.currentRev(req.params.id) })
  })

  router.delete('/groups/:id', async (req, res) => {
    if (!(await store.deleteGroup(req.params.id))) throw notFound()
    res.json({ id: req.params.id, deleted: true })
  })

  return router
}

module.exports = { createLibraryRouter }
