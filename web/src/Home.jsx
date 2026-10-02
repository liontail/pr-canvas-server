import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { MoonIcon, SunIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { badgeVariants } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { CanvasCard } from './components/CanvasCard.jsx'
import { GroupTree } from './components/GroupTree.jsx'
import { allTags, filterCanvases, sortCanvases } from './lib/filter.js'
import { createGroup, deleteCanvas, deleteGroup, getLibrary, patchCanvas, updateGroup } from './lib/library.js'
import { applyTheme, readTheme, saveTheme } from './lib/theme.js'
import { flatten } from './lib/tree.js'

const PAGE = 48

export function Home () {
  const [library, setLibrary] = useState(null)
  const [error, setError] = useState(null)
  const [theme, setTheme] = useState(readTheme)
  const [group, setGroup] = useState('all')
  const [tag, setTag] = useState(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('updated')
  const [limit, setLimit] = useState(PAGE)
  const more = useRef(null)

  useEffect(() => { applyTheme(theme) }, [theme])

  async function refresh () {
    try {
      setLibrary(await getLibrary())
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { refresh() }, [])

  // Canvas edits patch local state from the server's reply; only failures fall back to a full reload.
  const patch = useCallback(async (id, body) => {
    setError(null)
    try {
      const next = await patchCanvas(id, body)
      setLibrary((current) => current && { ...current, canvases: current.canvases.map((item) => (item.id === id ? next : item)) })
    } catch (err) {
      setError(err.message)
      refresh()
    }
  }, [])

  const remove = useCallback(async (id) => {
    setError(null)
    try {
      await deleteCanvas(id)
      setLibrary((current) => current && { ...current, canvases: current.canvases.filter((item) => item.id !== id) })
    } catch (err) {
      setError(err.message)
      refresh()
    }
  }, [])

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
  useEffect(() => { setLimit(PAGE) }, [group, tag, query, sort])
  useEffect(() => {
    const el = more.current
    if (!el) return undefined
    const watcher = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) setLimit((n) => n + PAGE) }, { rootMargin: '600px' })
    watcher.observe(el)
    return () => watcher.disconnect()
  }, [limit, visible.length])
  const shown = useMemo(() => visible.slice(0, limit), [visible, limit])
  const tags = useMemo(() => (library ? allTags(library.canvases) : []), [library])
  useEffect(() => { if (tag && library && !tags.some((t) => t.tag.toLowerCase() === tag.toLowerCase())) setTag(null) }, [tags, tag, library])
  const options = useMemo(() => (library ? flatten(library.groups) : []), [library])

  function toggleTheme () {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    saveTheme(next)
  }

  if (!library) {
    if (error) return <div className="absolute inset-0 grid place-items-center text-muted-foreground">{error}</div>
    return (
      <div className="flex h-full flex-col md:flex-row" aria-busy="true" aria-label="Loading diagrams">
        <aside className="w-full shrink-0 border-b bg-card p-3 md:w-72 md:border-r md:border-b-0">
          <Skeleton className="mb-3 h-5 w-24" />
          <Skeleton className="h-8 w-full" />
        </aside>
        <main className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] content-start gap-4 p-6">
          {[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-72 rounded-xl" />)}
        </main>
      </div>
    )
  }

  const isOn = (name) => tag && tag.toLowerCase() === name.toLowerCase()

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background text-foreground md:flex-row md:overflow-hidden">
      <aside className="w-full shrink-0 overflow-y-auto border-b bg-card p-3 md:h-full md:w-72 md:border-r md:border-b-0">
        <h1 className="px-2 pb-3 text-base font-semibold">Diagrams</h1>
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
      <main className="min-w-0 flex-1 p-6 md:overflow-y-auto">
        <div className="flex items-center gap-2">
          <Input type="search" className="min-w-0 flex-1" placeholder="Search name, repo or tag" value={query} aria-label="Search diagrams" onInput={(event) => setQuery(event.currentTarget.value)} />
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-44" aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Recently updated</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" aria-label="Toggle theme" title="Toggle theme" onClick={toggleTheme}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
            {tags.map(({ tag: name, count }) => (
              <button
                type="button"
                key={name}
                aria-pressed={Boolean(isOn(name))}
                className={cn(badgeVariants({ variant: isOn(name) ? 'default' : 'outline' }), 'cursor-pointer gap-1')}
                onClick={() => setTag(isOn(name) ? null : name)}
              >
                {name} <small className="opacity-70">{count}</small>
              </button>
            ))}
          </div>
        )}
        {error && <p role="alert" className="mt-3 rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive">{error}</p>}
        {visible.length ? (
          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
            {shown.map((canvas) => (
              <CanvasCard key={canvas.id} canvas={canvas} options={options} theme={theme} onPatch={patch} onDelete={remove} />
            ))}
            {shown.length < visible.length && <button type="button" ref={more} className="col-span-full py-4 text-sm text-muted-foreground" onClick={() => setLimit((n) => n + PAGE)}>Show more</button>}
          </div>
        ) : (
          <Empty className="mt-10">
            <EmptyHeader>
              <EmptyTitle>{library.canvases.length ? 'No diagrams match' : 'Nothing pushed yet'}</EmptyTitle>
              <EmptyDescription>
                {library.canvases.length ? 'Try a different search, tag or group.' : 'Push a diagram with the pr-lens CLI and it will show up here.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </main>
    </div>
  )
}
