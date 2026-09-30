async function request (method, path, body) {
  const headers = { accept: 'application/json' }
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  let json = null
  try { json = await res.json() } catch {}
  if (!res.ok) throw new Error((json && json.error && json.error.message) || `Request failed (${res.status})`)
  return json
}

export const getLibrary = () => request('GET', '/api/library')
export const patchCanvas = (id, patch) => request('PATCH', `/api/library/canvases/${encodeURIComponent(id)}`, patch)
export const createGroup = (name, parentId = null) => request('POST', '/api/library/groups', { name, parentId })
export const updateGroup = (id, patch) => request('PATCH', `/api/library/groups/${encodeURIComponent(id)}`, patch)
export const deleteGroup = (id) => request('DELETE', `/api/library/groups/${encodeURIComponent(id)}`)
export const deleteCanvas = (id) => request('DELETE', `/api/library/canvases/${encodeURIComponent(id)}`)
export const deleteVersion = (id, rev) => request('DELETE', `/api/library/canvases/${encodeURIComponent(id)}/versions/${rev}`)
