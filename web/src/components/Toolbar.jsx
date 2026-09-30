import { Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { Icon } from './Icon.jsx'

const KEYS = [
  ['Drag', 'pan the canvas'],
  ['Scroll', 'pan'],
  ['Ctrl/Cmd + scroll', 'zoom at the cursor'],
  ['+  /  -', 'zoom in / out'],
  ['0', 'fit everything'],
  ['Right / Space', 'next step'],
  ['Left', 'previous step'],
  ['Esc', 'leave the walkthrough'],
]

export function Toolbar ({ theme, onToggleTheme, onFit, getShareUrl, canPlay = false, playing = false, onPlay }) {
  const [helpOpen, setHelpOpen] = useState(false)
  const [note, setNote] = useState('')

  function say (text) {
    setNote(text)
    setTimeout(() => setNote(''), 2000)
  }

  async function copyLink () {
    try {
      await navigator.clipboard.writeText(getShareUrl())
      say('Link copied')
    } catch {
      say('Copy failed')
    }
  }

  function toggleFullscreen () {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.()
  }

  return (
    <>
      <div class="toolbar" role="toolbar" aria-label="Canvas tools">
        {canPlay && (
          <button type="button" title={playing ? 'Leave walkthrough' : 'Play walkthrough'} aria-label={playing ? 'Leave walkthrough' : 'Play walkthrough'} onClick={onPlay}>
            <Icon name="play" />
          </button>
        )}
        <button type="button" title="Fit everything (0)" aria-label="Fit everything" onClick={onFit}><Icon name="fit" /></button>
        <button type="button" title="Fullscreen" aria-label="Fullscreen" onClick={toggleFullscreen}><Icon name="fullscreen" /></button>
        <button type="button" title="Copy link" aria-label="Copy link" onClick={copyLink}><Icon name="link" /></button>
        <button type="button" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} aria-label="Toggle theme" onClick={onToggleTheme}><Icon name="theme" /></button>
        <button type="button" title="Help" aria-label="Help" aria-expanded={helpOpen} onClick={() => setHelpOpen(!helpOpen)}><Icon name="help" /></button>
        <button type="button" title="Live mode is not enabled" aria-label="Ask anything (unavailable)" disabled><Icon name="ask" /></button>
      </div>
      {note && <div class="note" role="status">{note}</div>}
      {helpOpen && (
        <div class="help" role="dialog" aria-label="Keyboard and mouse help">
          <h2>Navigate</h2>
          <dl>
            {KEYS.map(([key, what]) => (
              <Fragment key={key}>
                <dt>{key}</dt>
                <dd>{what}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      )}
    </>
  )
}
