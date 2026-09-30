import { useState } from 'preact/hooks'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TOP = '__top__'
const INDENT = '  '

const COPY = {
  rename: (node) => ({ title: 'Rename group', description: `Give “${node.name}” a new name.`, action: 'Save' }),
  add: (node) => ({ title: 'New sub-group', description: `Create a group inside “${node.name}”.`, action: 'Create' }),
  move: (node) => ({ title: 'Move group', description: `Choose where “${node.name}” should live.`, action: 'Move' }),
  delete: (node) => ({ title: 'Delete group?', description: `“${node.name}” will be removed. Its diagrams and sub-groups move up one level.`, action: 'Delete' }),
}

function GroupForm ({ mode, node, targets, onSubmit, onCancel }) {
  const [text, setText] = useState(mode === 'rename' ? node.name : '')
  const [parent, setParent] = useState(node.parentId || TOP)
  const copy = COPY[mode](node)

  function submit (event) {
    event.preventDefault()
    if (mode === 'move') return onSubmit(parent === TOP ? null : parent)
    if (mode === 'delete') return onSubmit()
    if (text.trim()) onSubmit(text)
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.description}</DialogDescription>
      </DialogHeader>
      {(mode === 'rename' || mode === 'add') && (
        <Input value={text} maxLength={80} aria-label="Group name" placeholder="Group name" onInput={(event) => setText(event.currentTarget.value)} />
      )}
      {mode === 'move' && (
        <Select value={parent} onValueChange={setParent}>
          <SelectTrigger className="w-full" aria-label={`Move ${node.name} to`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TOP}>Top level</SelectItem>
            {targets.map((target) => (
              <SelectItem key={target.id} value={target.id}>{INDENT.repeat(target.depth)}{target.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant={mode === 'delete' ? 'destructive' : 'default'}>{copy.action}</Button>
      </DialogFooter>
    </form>
  )
}

export function GroupDialog ({ state, targets, onClose, onRename, onCreate, onMove, onDelete }) {
  function submit (value) {
    if (state.mode === 'rename') onRename(state.node.id, value)
    if (state.mode === 'add') onCreate(value, state.node.id)
    if (state.mode === 'move') onMove(state.node.id, value)
    if (state.mode === 'delete') onDelete(state.node.id)
    onClose()
  }

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        {state && (
          <GroupForm key={`${state.mode}:${state.node.id}`} mode={state.mode} node={state.node} targets={targets} onSubmit={submit} onCancel={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}
