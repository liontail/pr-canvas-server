import { useState } from 'preact/hooks'
import { buildTree, flatten, subtreeIds } from '../lib/tree.js'

const focusOnMount = (el) => { if (el) el.focus() }

function GroupNode ({ node, depth, groups, selected, onSelect, onCreate, onRename, onMove, onDelete }) {
  const [mode, setMode] = useState(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(true)

  function begin (next, value = '') {
    setMode(next)
    setText(value)
  }

  function finish () {
    setMode(null)
    setText('')
  }

  function submit (event) {
    event.preventDefault()
    if (mode === 'rename' && text.trim()) onRename(node.id, text)
    if (mode === 'add' && text.trim()) onCreate(text, node.id)
    finish()
  }

  const blocked = subtreeIds(groups, node.id)
  const targets = flatten(groups).filter((group) => !blocked.has(group.id))

  return (
    <li>
      <div class={`row${selected === node.id ? ' on' : ''}`} style={{ paddingLeft: `${depth * 14 + 4}px` }}>
        <button type="button" class="twisty" aria-label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen(!open)}>
          {node.children.length ? (open ? '▾' : '▸') : ''}
        </button>
        <button type="button" class="label" onClick={() => onSelect(node.id)}>{node.name}</button>
        <button type="button" class="dots" aria-label={`Actions for ${node.name}`} aria-expanded={mode !== null} onClick={() => (mode === null ? begin('menu') : finish())}>⋯</button>
      </div>
      {mode === 'menu' && (
        <div class="actions" style={{ paddingLeft: `${depth * 14 + 24}px` }}>
          <button type="button" onClick={() => begin('rename', node.name)}>Rename</button>
          <button type="button" onClick={() => begin('add')}>Add sub-group</button>
          <button type="button" onClick={() => begin('move')}>Move</button>
          <button type="button" onClick={() => begin('delete')}>Delete</button>
        </div>
      )}
      {(mode === 'rename' || mode === 'add') && (
        <form class="inline" style={{ paddingLeft: `${depth * 14 + 24}px` }} onSubmit={submit}>
          <input
            ref={focusOnMount}
            value={text}
            maxLength={80}
            aria-label={mode === 'rename' ? 'Group name' : 'Sub-group name'}
            placeholder={mode === 'rename' ? 'Group name' : 'Sub-group name'}
            onInput={(event) => setText(event.currentTarget.value)}
            onKeyDown={(event) => { if (event.key === 'Escape') finish() }}
          />
          <button type="submit">Save</button>
          <button type="button" onClick={finish}>Cancel</button>
        </form>
      )}
      {mode === 'move' && (
        <div class="inline" style={{ paddingLeft: `${depth * 14 + 24}px` }}>
          <select
            aria-label={`Move ${node.name} to`}
            value={node.parentId || ''}
            onChange={(event) => { onMove(node.id, event.currentTarget.value || null); finish() }}
          >
            <option value="">Top level</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>{'  '.repeat(target.depth)}{target.name}</option>
            ))}
          </select>
          <button type="button" onClick={finish}>Cancel</button>
        </div>
      )}
      {mode === 'delete' && (
        <div class="inline confirm" style={{ paddingLeft: `${depth * 14 + 24}px` }}>
          <span>Delete this group? Its contents move up one level.</span>
          <button type="button" onClick={() => { onDelete(node.id); finish() }}>Confirm delete</button>
          <button type="button" onClick={finish}>Cancel</button>
        </div>
      )}
      {open && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <GroupNode
              key={child.id}
              node={child}
              depth={depth + 1}
              groups={groups}
              selected={selected}
              onSelect={onSelect}
              onCreate={onCreate}
              onRename={onRename}
              onMove={onMove}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function GroupTree ({ groups, selected, onSelect, onCreate, onRename, onMove, onDelete }) {
  const [adding, setAdding] = useState('')
  const tree = buildTree(groups)

  return (
    <nav aria-label="Groups">
      <ul class="groups">
        <li>
          <div class={`row${selected === 'all' ? ' on' : ''}`}>
            <button type="button" class="label" onClick={() => onSelect('all')}>All diagrams</button>
          </div>
        </li>
        <li>
          <div class={`row${selected === 'none' ? ' on' : ''}`}>
            <button type="button" class="label" onClick={() => onSelect('none')}>Ungrouped</button>
          </div>
        </li>
        {tree.map((node) => (
          <GroupNode
            key={node.id}
            node={node}
            depth={0}
            groups={groups}
            selected={selected}
            onSelect={onSelect}
            onCreate={onCreate}
            onRename={onRename}
            onMove={onMove}
            onDelete={onDelete}
          />
        ))}
      </ul>
      <form
        class="add"
        onSubmit={(event) => {
          event.preventDefault()
          if (adding.trim()) onCreate(adding, null)
          setAdding('')
        }}
      >
        <input value={adding} maxLength={80} aria-label="New group name" placeholder="New top-level group" onInput={(event) => setAdding(event.currentTarget.value)} />
        <button type="submit">Add</button>
      </form>
    </nav>
  )
}
