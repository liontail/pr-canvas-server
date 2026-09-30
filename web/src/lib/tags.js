const CONTROL = /[\u0000-\u001f\u007f]/

export function normalizeTag (text) {
  const raw = String(text).trim()
  if (!raw || CONTROL.test(raw)) return null
  const tag = raw.replace(/\s+/g, ' ')
  return tag.length <= 32 ? tag : null
}

export function addTag (tags, text) {
  const tag = normalizeTag(text)
  if (!tag || tags.length >= 20 || tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return tags
  return [...tags, tag]
}

export function removeTag (tags, tag) {
  return tags.filter((existing) => existing !== tag)
}
