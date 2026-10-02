import { useEffect, useRef, useState } from 'preact/hooks'
import { SparklesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { askQuestion } from '../lib/ask.js'
import { parseCitations, selectionHint } from '../lib/cite.js'

export function AskPopover ({ canvasId, rev, document, selected, onCite }) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef(null)

  async function submit () {
    const text = question.trim()
    if (!text || busy) return
    controller.current = new AbortController()
    setBusy(true)
    setError('')
    setAnswer('')
    try {
      await askQuestion({ canvasId, question: text, rev, selected: selectionHint(selected), signal: controller.current.signal, onText: setAnswer })
    } catch (err) {
      if (err.name !== 'AbortError') setError(err instanceof TypeError ? 'Network error, try again' : err.message)
    } finally {
      setBusy(false)
    }
  }

  function stop () {
    if (controller.current) controller.current.abort()
  }

  useEffect(() => () => stop(), [])

  function onKeyDown (event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) stop() }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Ask anything" aria-label="Ask anything"><SparklesIcon /></Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <h2 className="mb-2 text-sm font-semibold">Ask about this canvas</h2>
        <textarea
          value={question}
          maxLength={500}
          rows={2}
          placeholder="What does this change?"
          aria-label="Question"
          onInput={(event) => setQuestion(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" disabled={busy || !question.trim()} onClick={submit}>Ask</Button>
          {busy && <Button variant="ghost" size="sm" onClick={stop}>Stop</Button>}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        {answer && (
          <p aria-live="polite" className="mt-3 max-h-64 overflow-auto text-sm whitespace-pre-wrap">
            {parseCitations(answer, document, busy).map((part, i) => (
              part.ref
                ? <button key={i} type="button" className="text-highlight underline underline-offset-2" onClick={() => { onCite(part.ref); setOpen(false) }}>{part.text}</button>
                : <span key={i}>{part.text}</span>
            ))}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
