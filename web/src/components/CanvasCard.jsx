import { useRef, useState } from 'preact/hooks'
import { displayName } from '../lib/filter.js'
import { addTag, removeTag } from '../lib/tags.js'

const focusOnMount = (el) => { if (el) el.focus() }

export function CanvasCard ({ canvas, options, theme, onRename, onTags, onMove }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [tagText, setTagText] = useState('')
  const done = useRef(true)
  const name = displayName(canvas)
  const file = canvas.thumb && canvas.thumb[theme]

  function startEdit () {
    done.current = false
    setDraft(canvas.name || canvas.title)
    setEditing(true)
  }

  function save () {
    if (done.current) return
    done.current = true
    setEditing(false)
    const next = draft.trim()
    if (next === (canvas.name || canvas.title)) return
    onRename(next === '' || next === canvas.title ? null : next)
  }

  function cancel () {
    done.current = true
    setEditing(false)
  }

  function onTagKey (event) {
    if (event.isComposing) return
    if (event.key !== 'Enter' && event.key !== ',') return
    event.preventDefault()
    const next = addTag(canvas.tags, tagText)
    setTagText('')
    if (next !== canvas.tags) onTags(next)
  }

  return (
    <article class="card">
      <a class="cover" href={`/c/${canvas.id}`} aria-label={`Open ${name}`}>
        {file ? <img src={`/c/${canvas.id}/assets/${file}`} alt="" loading="lazy" /> : <span class="nothumb">No preview</span>}
      </a>
      <div class="body">
        {editing ? (
          <form onSubmit={(event) => { event.preventDefault(); save() }}>
            <input
              ref={focusOnMount}
              class="rename"
              value={draft}
              maxLength={120}
              aria-label="Diagram name"
              onInput={(event) => setDraft(event.currentTarget.value)}
              onBlur={save}
              onKeyDown={(event) => { if (event.key === 'Escape') cancel() }}
            />
          </form>
        ) : (
          <h2>
            <a href={`/c/${canvas.id}`}>{name}</a>
            <button type="button" class="edit" aria-label={`Rename ${name}`} title="Rename" onClick={startEdit}>✎</button>
          </h2>
        )}
        {canvas.name && canvas.name !== canvas.title && <p class="orig">{canvas.title}</p>}
        <p class="meta">
          {canvas.repo ? `${canvas.repo} · ` : ''}rev {canvas.rev} · {canvas.tiles} diagram{canvas.tiles === 1 ? '' : 's'} ·{' '}
          <time dateTime={canvas.lastWriteAt}>{new Date(canvas.lastWriteAt).toLocaleString()}</time>
        </p>
        <div class="tags">
          {canvas.tags.map((tag) => (
            <span class="tag" key={tag}>
              {tag}
              <button type="button" aria-label={`Remove tag ${tag}`} onClick={() => onTags(removeTag(canvas.tags, tag))}>×</button>
            </span>
          ))}
          <input
            class="addtag"
            value={tagText}
            maxLength={32}
            placeholder="+ tag"
            aria-label={`Add tag to ${name}`}
            onInput={(event) => setTagText(event.currentTarget.value)}
            onKeyDown={onTagKey}
          />
        </div>
        <label class="move">
          Group
          <select value={canvas.groupId || ''} aria-label={`Group for ${name}`} onChange={(event) => onMove(event.currentTarget.value || null)}>
            <option value="">Ungrouped</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>{'  '.repeat(option.depth)}{option.name}</option>
            ))}
          </select>
        </label>
      </div>
    </article>
  )
}
