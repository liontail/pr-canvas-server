const { ApiError } = require('./errors')

const REV_RE = /^[1-9]\d{0,8}$/

function parseRev (value) {
  if (value === undefined) return null
  if (typeof value !== 'string' || !REV_RE.test(value)) {
    throw new ApiError('INVALID_REQUEST', 'rev must be a positive integer')
  }
  return Number(value)
}

module.exports = { parseRev }
