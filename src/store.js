const crypto = require('crypto')
const { MongoClient } = require('mongodb')

function hashToken (token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// 128 random bits as base64url: 22 chars, no padding
function newSecret () {
  return crypto.randomBytes(16).toString('base64url')
}

async function createStore ({ uri, dbName }) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 })
  await client.connect()
  const db = client.db(dbName)
  const canvases = db.collection('canvases')
  const groups = db.collection('groups')
  const LIBRARY_PROJECTION = { tokenHash: 0, doc: 0 }

  async function tokenStatus (id, token) {
    const row = await canvases.findOne({ _id: id }, { projection: { tokenHash: 1, rev: 1 } })
    if (!row) return { status: 'not_found' }
    if (row.tokenHash !== hashToken(token)) return { status: 'unauthorized' }
    return { status: 'ok', rev: row.rev }
  }

  return {
    async mint () {
      const id = newSecret()
      const writeToken = newSecret()
      await canvases.insertOne({
        _id: id,
        tokenHash: hashToken(writeToken),
        rev: 0,
        doc: null,
        createdAt: new Date(),
        lastWriteAt: null,
      })
      return { id, writeToken }
    },

    async load (id) {
      const row = await canvases.findOne({ _id: id }, { projection: { rev: 1, doc: 1 } })
      if (!row) return null
      return { rev: row.rev, document: row.doc === null ? null : JSON.parse(row.doc) }
    },

    async checkToken (id, token) {
      return (await tokenStatus(id, token)).status
    },

    // The document is stored as a JSON string: it fits the 16 MiB BSON limit at the
    // 10,000,000-byte push cap and sidesteps Mongo's rules on "." / "$" in field names.
    async push (id, token, ifMatch, document, summary = null) {
      const set = { doc: JSON.stringify(document), lastWriteAt: new Date() }
      if (summary) set.summary = summary
      const updated = await canvases.findOneAndUpdate(
        { _id: id, tokenHash: hashToken(token), rev: ifMatch },
        { $set: set, $inc: { rev: 1 } },
        { returnDocument: 'after', projection: { rev: 1 } },
      )
      if (updated) return { status: 'ok', rev: updated.rev }
      const check = await tokenStatus(id, token)
      if (check.status === 'ok') return { status: 'moved', rev: check.rev }
      return { status: check.status }
    },

    async rotate (id, bearer, newToken) {
      const row = await canvases.findOne({ _id: id }, { projection: { tokenHash: 1 } })
      if (!row) return 'not_found'
      const newHash = hashToken(newToken)
      if (row.tokenHash === newHash) return 'ok'
      if (!bearer || row.tokenHash !== hashToken(bearer)) return 'unauthorized'
      const res = await canvases.updateOne(
        { _id: id, tokenHash: row.tokenHash },
        { $set: { tokenHash: newHash } },
      )
      return res.matchedCount === 1 ? 'ok' : 'unauthorized'
    },

    async remove (id, token) {
      const res = await canvases.deleteOne({ _id: id, tokenHash: hashToken(token) })
      if (res.deletedCount === 1) return 'ok'
      const { status } = await tokenStatus(id, token)
      return status === 'ok' ? 'not_found' : status
    },

    listLibrary () {
      return canvases.find({ rev: { $gt: 0 } }, { projection: LIBRARY_PROJECTION }).sort({ lastWriteAt: -1, _id: 1 }).toArray()
    },

    getLibraryRow (id) {
      return canvases.findOne({ _id: id, rev: { $gt: 0 } }, { projection: LIBRARY_PROJECTION })
    },

    async setSummary (id, rev, summary) {
      const res = await canvases.updateOne({ _id: id, rev }, { $set: { summary } })
      return res.matchedCount === 1
    },

    patchMeta (id, patch) {
      const set = {}
      if ('name' in patch) set['meta.name'] = patch.name
      if ('tags' in patch) set['meta.tags'] = patch.tags
      if ('groupId' in patch) set['meta.groupId'] = patch.groupId
      return canvases.findOneAndUpdate(
        { _id: id, rev: { $gt: 0 } },
        { $set: set },
        { returnDocument: 'after', projection: LIBRARY_PROJECTION },
      )
    },

    listGroups () {
      return groups.find({}).sort({ createdAt: 1, _id: 1 }).toArray()
    },

    getGroup (id) {
      return groups.findOne({ _id: id })
    },

    async createGroup ({ name, parentId }) {
      const row = { _id: newSecret(), name, parentId, createdAt: new Date() }
      await groups.insertOne(row)
      return row
    },

    updateGroup (id, patch) {
      const set = {}
      if ('name' in patch) set.name = patch.name
      if ('parentId' in patch) set.parentId = patch.parentId
      return groups.findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: 'after' })
    },

    // Not transactional: a crash between steps can leave contents pointing at a deleted group
    // ponytail: wrap in a Mongo transaction if that ever matters on a replica set
    async deleteGroup (id) {
      const group = await groups.findOne({ _id: id })
      if (!group) return false
      await groups.updateMany({ parentId: id }, { $set: { parentId: group.parentId } })
      await canvases.updateMany({ 'meta.groupId': id }, { $set: { 'meta.groupId': group.parentId } })
      await groups.deleteOne({ _id: id })
      return true
    },

    dropDatabase () { return db.dropDatabase() },
    close () { return client.close() },
  }
}

module.exports = { createStore }
