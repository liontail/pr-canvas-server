const REV_RE = /^[1-9]\d{0,8}$/

export function parseRev (search) {
  const value = new URLSearchParams(search).get('rev')
  return value !== null && REV_RE.test(value) ? Number(value) : null
}

export function withRev (search, rev, latestRev) {
  const params = new URLSearchParams(search)
  if (rev === null || rev === latestRev) params.delete('rev')
  else params.set('rev', String(rev))
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function versionLabel (version, latestRev) {
  if (version.rev === latestRev) return `Latest (rev ${version.rev})`
  return `rev ${version.rev} · ${new Date(version.createdAt).toLocaleString()}`
}
