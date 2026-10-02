import { useEffect, useRef, useState } from 'preact/hooks'
import { memo } from 'preact/compat'
import { PencilIcon, Trash2Icon, XIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { displayName } from '../lib/filter.js'
import { addTag, removeTag } from '../lib/tags.js'
import { ConfirmDialog } from './ConfirmDialog.jsx'

const NONE = '__none__'
const INDENT = '  '

export const CanvasCard = memo(function CanvasCard ({ canvas, options, theme, onPatch, onDelete }) {
  const [picking, setPicking] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [tagText, setTagText] = useState('')
  const done = useRef(true)
  const form = useRef(null)
  const name = displayName(canvas)
  const groupLabel = (options.find((option) => option.id === canvas.groupId) || { name: 'Ungrouped' }).name
  const file = canvas.thumb && canvas.thumb[theme]

  useEffect(() => {
    if (editing && form.current) {
      const input = form.current.querySelector('input')
      if (input) input.focus()
    }
  }, [editing])

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
    onPatch(canvas.id, { name: next === '' || next === canvas.title ? null : next })
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
    if (next !== canvas.tags) onPatch(canvas.id, { tags: next })
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <a href={`/c/${canvas.id}`} aria-label={`Open ${name}`} className="grid aspect-[16/10] place-items-center border-b bg-muted">
        {file
          ? <img src={`/c/${canvas.id}/assets/${file}`} alt="" loading="lazy" className="h-full w-full object-contain" />
          : <span className="text-xs text-muted-foreground">No preview</span>}
      </a>
      <div className="grid gap-2 p-4">
        {editing ? (
          <form ref={form} onSubmit={(event) => { event.preventDefault(); save() }}>
            <Input
              className="h-8"
              value={draft}
              maxLength={120}
              aria-label="Diagram name"
              onInput={(event) => setDraft(event.currentTarget.value)}
              onBlur={save}
              onKeyDown={(event) => { if (event.key === 'Escape') cancel() }}
            />
          </form>
        ) : (
          <h2 className="flex items-center gap-1 text-[15px] leading-snug font-semibold break-words">
            <a href={`/c/${canvas.id}`} className="hover:underline">{name}</a>
            <Button variant="ghost" size="icon-xs" aria-label={`Rename ${name}`} title="Rename" onClick={startEdit}><PencilIcon /></Button>
            <Button variant="ghost" size="icon-xs" aria-label={`Delete ${name}`} title="Delete" onClick={() => setConfirming(true)}><Trash2Icon /></Button>
          </h2>
        )}
        {canvas.name && canvas.name !== canvas.title && <p className="text-xs break-words text-muted-foreground">{canvas.title}</p>}
        <p className="text-xs break-words text-muted-foreground">
          {canvas.repo ? `${canvas.repo} · ` : ''}rev {canvas.rev} · {canvas.tiles} diagram{canvas.tiles === 1 ? '' : 's'}{canvas.versions > 1 ? ` · ${canvas.versions} versions` : ''} ·{' '}
          <time dateTime={canvas.lastWriteAt}>{new Date(canvas.lastWriteAt).toLocaleString()}</time>
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {canvas.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                className="rounded-full p-0.5 opacity-60 outline-none hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                onClick={() => onPatch(canvas.id, { tags: removeTag(canvas.tags, tag) })}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          <Input
            className="h-7 w-24 px-2 text-xs"
            value={tagText}
            maxLength={32}
            placeholder="+ tag"
            aria-label={`Add tag to ${name}`}
            onInput={(event) => setTagText(event.currentTarget.value)}
            onKeyDown={onTagKey}
          />
        </div>
        {picking ? (
          <Select defaultOpen value={canvas.groupId || NONE} onValueChange={(value) => onPatch(canvas.id, { groupId: value === NONE ? null : value })} onOpenChange={(open) => { if (!open) setPicking(false) }}>
            <SelectTrigger size="sm" className="w-full" aria-label={`Group for ${name}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Ungrouped</SelectItem>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>{INDENT.repeat(option.depth)}{option.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Button variant="outline" size="sm" className="w-full justify-start font-normal" aria-label={`Group for ${name}`} onClick={() => setPicking(true)}>
            {groupLabel}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete "${name}"?`}
        description={`This removes the diagram and its ${canvas.versions} version${canvas.versions === 1 ? '' : 's'}. This can't be undone.`}
        onConfirm={() => onDelete(canvas.id)}
      />
    </Card>
  )
})
