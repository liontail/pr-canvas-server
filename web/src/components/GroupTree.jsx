import { useState } from 'preact/hooks'
import { ChevronDownIcon, ChevronRightIcon, EllipsisIcon, FolderIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { buildTree, flatten, subtreeIds } from '../lib/tree.js'
import { GroupDialog } from './GroupDialog.jsx'

function Row ({ active, children }) {
  return <div className={cn('flex items-center rounded-md', active && 'bg-accent text-accent-foreground')}>{children}</div>
}

function GroupNode ({ node, depth, selected, onSelect, onAction }) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children.length > 0

  return (
    <li>
      <div className={cn('group flex items-center rounded-md hover:bg-accent/60', selected === node.id && 'bg-accent text-accent-foreground')} style={{ paddingLeft: `${depth * 12}px` }}>
        <Button variant="ghost" size="icon-xs" aria-label={open ? 'Collapse' : 'Expand'} disabled={!hasChildren} onClick={() => setOpen(!open)}>
          {hasChildren ? (open ? <ChevronDownIcon /> : <ChevronRightIcon />) : null}
        </Button>
        <Button variant="ghost" size="sm" className="min-w-0 flex-1 justify-start gap-1.5 px-2 font-normal hover:bg-transparent" onClick={() => onSelect(node.id)}>
          <FolderIcon className="text-muted-foreground" />
          <span className="truncate">{node.name}</span>
        </Button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${node.name}`} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100">
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onAction('rename', node)}>Rename</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction('add', node)}>Add sub-group</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction('move', node)}>Move</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onAction('delete', node)}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open && hasChildren && (
        <ul>
          {node.children.map((child) => (
            <GroupNode key={child.id} node={child} depth={depth + 1} selected={selected} onSelect={onSelect} onAction={onAction} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function GroupTree ({ groups, selected, onSelect, onCreate, onRename, onMove, onDelete }) {
  const [adding, setAdding] = useState('')
  const [dialog, setDialog] = useState(null)
  const tree = buildTree(groups)

  const targets = dialog && dialog.mode === 'move'
    ? flatten(groups).filter((group) => !subtreeIds(groups, dialog.node.id).has(group.id))
    : []

  return (
    <nav aria-label="Groups" className="grid gap-3">
      <ul className="grid gap-0.5">
        <li>
          <Row active={selected === 'all'}>
            <Button variant="ghost" size="sm" className="flex-1 justify-start px-3 font-normal hover:bg-transparent" onClick={() => onSelect('all')}>All diagrams</Button>
          </Row>
        </li>
        <li>
          <Row active={selected === 'none'}>
            <Button variant="ghost" size="sm" className="flex-1 justify-start px-3 font-normal hover:bg-transparent" onClick={() => onSelect('none')}>Ungrouped</Button>
          </Row>
        </li>
        {tree.map((node) => (
          <GroupNode key={node.id} node={node} depth={0} selected={selected} onSelect={onSelect} onAction={(mode, target) => setDialog({ mode, node: target })} />
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (adding.trim()) onCreate(adding, null)
          setAdding('')
        }}
      >
        <Input className="h-8 text-xs" value={adding} maxLength={80} aria-label="New group name" placeholder="New top-level group" onInput={(event) => setAdding(event.currentTarget.value)} />
        <Button type="submit" variant="outline" size="sm">Add</Button>
      </form>
      <GroupDialog
        state={dialog}
        targets={targets}
        onClose={() => setDialog(null)}
        onRename={onRename}
        onCreate={onCreate}
        onMove={onMove}
        onDelete={onDelete}
      />
    </nav>
  )
}
