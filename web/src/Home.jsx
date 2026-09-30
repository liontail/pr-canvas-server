import { useEffect, useMemo, useState } from 'preact/hooks'
import { CanvasCard } from './components/CanvasCard.jsx'
import { GroupTree } from './components/GroupTree.jsx'
import { allTags, filterCanvases, sortCanvases } from './lib/filter.js'
import { createGroup, deleteGroup, getLibrary, patchCanvas, updateGroup } from './lib/library.js'
import { readTheme, saveTheme } from './lib/theme.js'
import { flatten } from './lib/tree.js'

export function Home () {
  const [library, setLibrary] = useState(null)
  const [error, setError] = useState(null)
  const [theme, setTheme] = useState(readTheme)
  const [group, setGroup] = useState('all')
  const [tag, setTag] = useState(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('updated')

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  async function refresh () {
    try {
      setLibrary(await getLibrary())
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { refresh() }, [])

  async function run (action) {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err.message)
    }
    await refresh()
  }

  const visible = useMemo(
    () => (library ? sortCanvases(filterCanvases({ canvases: library.canvases, groups: library.groups, group, tag, query }), sort) : []),
    [library, group, tag, query, sort],
  )
  const tags = useMemo(() => (library ? allTags(library.canvases) : []), [library])
  const options = useMemo(() => (library ? flatten(library.groups) : []), [library])

  function toggleTheme () {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    saveTheme(next)
  }

  if (!library) {
    return <div class="home-status">{error || 'Loading…'}</div>
  }

  const isOn = (name) => tag && tag.toLowerCase() === name.toLowerCase()

  return (
    <div class="home">
      <aside class="side">
        <h1>Diagrams</h1>
        <GroupTree
          groups={library.groups}
          selected={group}
          onSelect={setGroup}
          onCreate={(name, parentId) => run(() => createGroup(name, parentId))}
          onRename={(id, name) => run(() => updateGroup(id, { name }))}
          onMove={(id, parentId) => run(() => updateGroup(id, { parentId }))}
          onDelete={(id) => {
            if (group === id) setGroup('all')
            return run(() => deleteGroup(id))
          }}
        />
      </aside>
      <main class="content">
        <div class="bar">
          <input type="search" placeholder="Search name, repo or tag" value={query} aria-label="Search diagrams" onInput={(event) => setQuery(event.currentTarget.value)} />
          <select value={sort} aria-label="Sort" onChange={(event) => setSort(event.currentTarget.value)}>
            <option value="updated">Recently updated</option>
            <option value="name">Name</option>
          </select>
          <button type="button" class="ghost" aria-label="Toggle theme" onClick={toggleTheme}>{theme === 'dark' ? 'Light' : 'Dark'}</button>
        </div>
        {tags.length > 0 && (
          <div class="tagbar" role="group" aria-label="Filter by tag">
            {tags.map(({ tag: name, count }) => (
              <button type="button" key={name} class={`chip-btn${isOn(name) ? ' on' : ''}`} aria-pressed={Boolean(isOn(name))} onClick={() => setTag(isOn(name) ? null : name)}>
                {name} <small>{count}</small>
              </button>
            ))}
          </div>
        )}
        {error && <p class="err" role="alert">{error}</p>}
        {visible.length ? (
          <div class="grid">
            {visible.map((canvas) => (
              <CanvasCard
                key={canvas.id}
                canvas={canvas}
                options={options}
                theme={theme}
                onRename={(name) => run(() => patchCanvas(canvas.id, { name }))}
                onTags={(next) => run(() => patchCanvas(canvas.id, { tags: next }))}
                onMove={(groupId) => run(() => patchCanvas(canvas.id, { groupId }))}
              />
            ))}
          </div>
        ) : (
          <p class="empty">
            {library.canvases.length ? 'No diagrams match.' : 'Nothing pushed yet. Push a diagram with the pr-lens CLI and it will show up here.'}
          </p>
        )}
      </main>
    </div>
  )
}
