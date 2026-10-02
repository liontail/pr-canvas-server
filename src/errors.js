const STATUS = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  NOT_OWNER: 403,
  NOT_FOUND: 404,
  ASK_DISABLED: 404,
  REVISION_MOVED: 409,
  LAST_VERSION: 409,
  TOO_LARGE: 413,
  INVALID_DOCUMENT: 422,
  CANNOT_DRAW: 422,
  RATE_LIMITED: 429,
  UPSTREAM_FAILED: 502,
}

class ApiError extends Error {
  constructor (code, message, extra = {}) {
    super(message)
    this.code = code
    this.status = STATUS[code]
    this.extra = extra
  }
}

function notFound () {
  return new ApiError('NOT_FOUND', 'Canvas not found')
}

function errorHandler (err, req, res, next) {
  if (res.headersSent) return next(err)

  let apiError = err
  if (!(err instanceof ApiError)) {
    if (err.type === 'entity.too.large') {
      apiError = new ApiError('TOO_LARGE', 'Request body exceeds the size limit')
    } else if (err.type === 'entity.parse.failed' || err.status === 400) {
      apiError = new ApiError('INVALID_REQUEST', 'Request body is not valid JSON')
    } else {
      console.error(err)
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } })
    }
  }
  res.status(apiError.status).json({
    error: { code: apiError.code, message: apiError.message, ...apiError.extra },
  })
}

module.exports = { ApiError, notFound, errorHandler }
