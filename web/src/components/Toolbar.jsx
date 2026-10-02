import { Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { CircleHelpIcon, LinkIcon, MaximizeIcon, PlayIcon, ScanIcon, SparklesIcon, SunMoonIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

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

export function Toolbar ({ theme, onToggleTheme, onFit, getShareUrl, canPlay = false, playing = false, onPlay, ask = null }) {
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

  const playLabel = playing ? 'Leave walkthrough' : 'Play walkthrough'

  return (
    <>
      <div role="toolbar" aria-label="Canvas tools" className="absolute top-3 right-3 z-10 flex gap-1 rounded-lg border bg-card p-1 shadow-sm">
        {canPlay && (
          <Button variant="ghost" size="icon-sm" title={playLabel} aria-label={playLabel} onClick={onPlay}><PlayIcon /></Button>
        )}
        <Button variant="ghost" size="icon-sm" title="Fit everything (0)" aria-label="Fit everything" onClick={onFit}><ScanIcon /></Button>
        <Button variant="ghost" size="icon-sm" title="Fullscreen" aria-label="Fullscreen" onClick={toggleFullscreen}><MaximizeIcon /></Button>
        <Button variant="ghost" size="icon-sm" title="Copy link" aria-label="Copy link" onClick={copyLink}><LinkIcon /></Button>
        <Button variant="ghost" size="icon-sm" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} aria-label="Toggle theme" onClick={onToggleTheme}><SunMoonIcon /></Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" title="Help" aria-label="Help"><CircleHelpIcon /></Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <h2 className="mb-2 text-sm font-semibold">Navigate</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {KEYS.map(([key, what]) => (
                <Fragment key={key}>
                  <dt className="flex items-center"><Kbd>{key}</Kbd></dt>
                  <dd className="text-muted-foreground">{what}</dd>
                </Fragment>
              ))}
            </dl>
          </PopoverContent>
        </Popover>
        {ask || <Button variant="ghost" size="icon-sm" title="Ask anything is not enabled on this server" aria-label="Ask anything (unavailable)" disabled><SparklesIcon /></Button>}
      </div>
      {note && <div role="status" className="absolute top-14 right-3 z-20 rounded-md border bg-card px-3 py-1.5 text-xs shadow-sm">{note}</div>}
    </>
  )
}
