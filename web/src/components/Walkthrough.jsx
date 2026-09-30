import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const pad = (n) => String(n).padStart(2, '0')

export function Walkthrough ({ steps, index, onIndex, onLeave }) {
  return (
    <aside aria-live="polite" className="pointer-events-none absolute inset-y-0 left-0 z-[4] flex w-[360px] flex-col justify-center px-7">
      <div className="pointer-events-auto mb-2.5 font-mono text-[11px] text-highlight">{pad(index + 1)} / {pad(steps.length)}</div>
      <ol className="pointer-events-auto grid gap-5">
        {steps.map((step, i) => (
          <li key={step.id}>
            <button
              type="button"
              aria-current={i === index ? 'step' : undefined}
              onClick={() => onIndex(i)}
              className={cn('text-left leading-snug outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', i === index ? 'text-2xl font-medium text-foreground' : 'text-lg text-muted-foreground/60')}
            >
              {step.heading}
            </button>
            {i === index && <p className="mt-2 text-[15px] text-muted-foreground">{step.body}</p>}
          </li>
        ))}
      </ol>
      <div className="pointer-events-auto mt-7 flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={index === 0} onClick={() => onIndex(index - 1)}>Back</Button>
        <Button variant="outline" size="sm" disabled={index === steps.length - 1} onClick={() => onIndex(index + 1)}>Next</Button>
        <Button variant="ghost" size="sm" className="font-mono text-[11px]" onClick={onLeave}>ESC TO LEAVE</Button>
      </div>
    </aside>
  )
}
