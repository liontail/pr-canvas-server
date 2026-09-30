import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { Canvas } from './components/Canvas.jsx'
import { Inspect } from './components/Inspect.jsx'
import { Overlay } from './components/Overlay.jsx'
import { Switcher } from './components/Switcher.jsx'
import { Toolbar } from './components/Toolbar.jsx'
import { DetailPanel } from './components/DetailPanel.jsx'
import { Tooltip } from './components/Tooltip.jsx'
import { Walkthrough } from './components/Walkthrough.jsx'
import { useCamera } from './lib/useCamera.js'
import { useViewport } from './lib/useViewport.js'
import { layoutTiles } from './lib/layout.js'
import { buildSteps, toWorld } from './lib/steps.js'
import { expand, fit, zoomAt } from './lib/camera.js'
import { parseHash, serializeHash } from './lib/hash.js'
import { hitTest, tileAt } from './lib/hit.js'
import { tooltipText } from './lib/describe.js'
import { detailModel } from './lib/detail.js'
import { applyTheme, readTheme, saveTheme } from './lib/theme.js'
import { VersionPicker } from './components/VersionPicker.jsx'
import { DiffControls } from './components/DiffControls.jsx'
import { ConfirmDialog } from './components/ConfirmDialog.jsx'
import { Button } from '@/components/ui/button'
import { deleteVersion } from './lib/library.js'
import { parseBase, parseRev, withVersion } from './lib/versions.js'

const PANEL = 380

export function App ({ canvasId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [versions, setVersions] = useState(null)
  const wanted = useRef(parseRev(location.search))
  const wantedBase = useRef(parseBase(location.search))
  const [deleting, setDeleting] = useState(false)
  const [theme, setTheme] = useState(readTheme)
  const [activeTile, setActiveTile] = useState(null)
  const [stepIndex, setStepIndex] = useState(null)
  const [hover, setHover] = useState(null)
  const [selected, setSelected] = useState(null)
  const playing = stepIndex !== null
  const initialHash = useRef(parseHash(location.hash))
  const containerRef = useRef(null)
  const stepRef = useRef(null)
  const { camera, cameraRef, setCamera, flyTo } = useCamera()
  const viewport = useViewport(containerRef)

  useEffect(() => { applyTheme(theme) }, [theme])

  useEffect(() => {
    const params = new URLSearchParams()
    if (wanted.current) params.set('rev', String(wanted.current))
    if (wantedBase.current) params.set('base', String(wantedBase.current))
    const query = params.toString() ? `?${params}` : ''
    fetch(`/api/canvas/${canvasId}${query}`, { headers: { accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : res.json().catch(() => ({})).then((body) => Promise.reject(new Error(res.status === 404 ? 'Canvas not found' : (body.error && body.error.message) || `Request failed (${res.status})`)))))
      .then(setData, (err) => setError(err.message))
    fetch(`/api/canvas/${canvasId}/versions`, { headers: { accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then(setVersions, () => {})
  }, [canvasId])

  function go (search) {
    const w = initialHash.current.w
    location.assign(location.pathname + search + (w ? `#w=${w}` : ''))
  }

  function chooseVersion (next) {
    const keep = wantedBase.current && wantedBase.current !== next ? wantedBase.current : null
    go(withVersion(location.search, { rev: next, base: keep }, data.latestRev))
  }

  async function removeVersion () {
    await deleteVersion(canvasId, data.rev)
    go('')
  }

  const layout = useMemo(
    () => (data ? layoutTiles(data.tiles.map(({ id, width, height }) => ({ id, width, height }))) : null),
    [data],
  )

  const steps = useMemo(
    () => (data && layout
      ? buildSteps(data.document, data.tiles).map((step) => toWorld(step, layout.positions[step.tileId]))
      : []),
    [data, layout],
  )

  const ready = Boolean(layout && viewport.width && viewport.height)
  const model = useMemo(() => (data && selected ? detailModel(data.document, selected) : null), [data, selected])

  function tileBox (id) {
    const tile = data.tiles.find((item) => item.id === id)
    const { x, y } = layout.positions[id]
    return { x, y, width: tile.width, height: tile.height }
  }

  function stepCamera (step) {
    return fit(expand(step.bounds, 120), viewport, { padding: 48, insetLeft: PANEL, maxZoom: 1.6 })
  }

  function probe (world) {
    const found = tileAt(layout, data.tiles, world)
    if (!found) return null
    const hit = hitTest(found.tile.hits, { x: world.x - found.origin.x, y: world.y - found.origin.y })
    return hit ? { ...hit, tileId: found.tile.id } : null
  }

  function onHover (info) {
    if (playing || !info) return setHover(null)
    const target = probe(info.world)
    setHover(target ? { target, client: info.client } : null)
  }

  function onClick (info) {
    if (playing) return
    setSelected(probe(info.world))
  }

  useEffect(() => {
    if (!ready || cameraRef.current) return
    const { view, step } = initialHash.current
    if (step && step <= steps.length) {
      stepRef.current = step - 1
      setStepIndex(step - 1)
      setActiveTile(steps[step - 1].tileId)
      setCamera(stepCamera(steps[step - 1]))
    } else {
      setCamera(view || fit(layout.bounds, viewport))
    }
  }, [ready])

  useEffect(() => {
    if (!camera || playing) return
    const timer = setTimeout(() => {
      history.replaceState(null, '', serializeHash({ view: camera, w: initialHash.current.w }))
    }, 250)
    return () => clearTimeout(timer)
  }, [camera, playing])

  function fitAll () {
    flyTo(fit(layout.bounds, viewport))
  }

  function selectTile (id) {
    setActiveTile(id)
    flyTo(fit(expand(tileBox(id), 40), viewport))
  }

  function goToStep (index) {
    const step = steps[index]
    stepRef.current = index
    setStepIndex(index)
    setActiveTile(step.tileId)
    setHover(null)
    setSelected(null)
    flyTo(stepCamera(step))
    history.replaceState(null, '', serializeHash({ step: index + 1, w: initialHash.current.w }))
  }

  function leave () {
    stepRef.current = null
    setStepIndex(null)
  }

  function toggleTheme () {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    saveTheme(next)
  }

  function shareUrl () {
    const state = playing ? { step: stepIndex + 1 } : { view: cameraRef.current }
    return location.origin + location.pathname + location.search + serializeHash(state)
  }

  useEffect(() => {
    if (!ready) return
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const active = stepRef.current
      if (active !== null) {
        if (event.key === 'Escape') leave()
        else if (['ArrowRight', 'ArrowDown', ' '].includes(event.key)) {
          if (active < steps.length - 1) goToStep(active + 1)
        } else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) {
          if (active > 0) goToStep(active - 1)
        } else return
        event.preventDefault()
        return
      }
      if (event.key === 'Escape') {
        setSelected(null)
        return
      }
      const center = { x: viewport.width / 2, y: viewport.height / 2 }
      if (event.key === '0') {
        setHover(null)
        fitAll()
      } else if (event.key === '+' || event.key === '=') {
        setHover(null)
        setCamera(zoomAt(cameraRef.current, center, 1.25))
      } else if (event.key === '-') {
        setHover(null)
        setCamera(zoomAt(cameraRef.current, center, 0.8))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ready, viewport.width, viewport.height, layout, steps, playing, stepIndex])

  const diagrams = data ? data.tiles.length : 0
  const repo = data && data.document.provenance && data.document.provenance.repo
  const current = playing ? steps[stepIndex] : null

  return (
    <div class="app" ref={containerRef}>
      {error && (
        <div class="message">
          <div>
            {error}
            {wantedBase.current && <p><a className="underline" href={location.pathname + withVersion(location.search, { rev: wanted.current, base: null }, null)}>Back to the plain view</a></p>}
          </div>
        </div>
      )}
      {!error && !data && <div class="message">Loading…</div>}
      {data && layout && (
        <>
          <Canvas
            tiles={data.tiles}
            layout={layout}
            camera={camera}
            cameraRef={cameraRef}
            theme={theme}
            interactive={!playing}
            pointing={Boolean(hover)}
            onCamera={setCamera}
            onHover={onHover}
            onClick={onClick}
          >
            {current && camera && (
              <Overlay
                layoutBounds={layout.bounds}
                focus={current.bounds}
                zoom={camera.zoom}
              />
            )}
            {camera && !playing && (
              <Inspect layoutBounds={layout.bounds} positions={layout.positions} zoom={camera.zoom} hover={hover && hover.target} selected={selected} />
            )}
          </Canvas>
          {hover && !playing && (
            <Tooltip text={tooltipText(data.document, hover.target)} client={hover.client} viewport={viewport} />
          )}
          <header className="absolute top-3 left-3 z-10 rounded-lg border bg-card px-3 py-2 shadow-sm">
            <a className="block text-[11px] text-muted-foreground hover:text-foreground" href="/">← Library</a>
            <strong className="block text-[13px]">{data.document.title}</strong>
            <small className="text-muted-foreground">{repo ? `${repo.owner}/${repo.name} · ` : ''}rev {data.rev} · {diagrams} diagram{diagrams === 1 ? '' : 's'}</small>
            {versions && versions.versions.length > 1 && (
              <>
                <VersionPicker versions={versions.versions} latestRev={data.latestRev} current={data.rev} onChoose={chooseVersion} />
                <DiffControls
                  versions={versions.versions}
                  rev={data.rev}
                  base={data.base ?? null}
                  onToggle={(base) => go(withVersion(location.search, { rev: data.rev, base }, data.latestRev))}
                  onBase={(base) => go(withVersion(location.search, { rev: data.rev, base }, data.latestRev))}
                />
                <Button variant="ghost" size="xs" className="mt-1.5 text-destructive hover:text-destructive" onClick={() => setDeleting(true)}>Delete this version</Button>
                <ConfirmDialog
                  open={deleting}
                  onOpenChange={setDeleting}
                  title={`Delete rev ${data.rev}?`}
                  description="This removes only this version. This can't be undone."
                  onConfirm={removeVersion}
                />
              </>
            )}
            {data.rev !== data.latestRev && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Viewing rev {data.rev} of {data.latestRev} ·{' '}
                <a className="underline hover:text-foreground" href={location.pathname + withVersion(location.search, { rev: null, base: null }, data.latestRev)}>Back to latest</a>
              </p>
            )}
          </header>
          {!playing && <Switcher tiles={data.tiles} theme={theme} activeId={activeTile} onSelect={selectTile} />}
          <Toolbar
            theme={theme}
            onToggleTheme={toggleTheme}
            onFit={fitAll}
            getShareUrl={shareUrl}
            canPlay={steps.length > 0}
            playing={playing}
            onPlay={() => (playing ? leave() : goToStep(0))}
          />
          {model && !playing && <DetailPanel model={model} onClose={() => setSelected(null)} />}
          {playing && <Walkthrough steps={steps} index={stepIndex} onIndex={goToStep} onLeave={leave} />}
          {camera && <div className="absolute right-3.5 bottom-3.5 z-10 font-mono text-[11px] text-muted-foreground">{Math.round(camera.zoom * 100)}%</div>}
        </>
      )}
    </div>
  )
}
