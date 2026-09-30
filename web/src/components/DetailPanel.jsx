import { Fragment } from 'preact'
import { XIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function DetailPanel ({ model, onClose }) {
  return (
    <aside role="complementary" aria-label="Details" className="absolute top-16 right-3 bottom-24 z-10 w-[380px] max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border bg-card p-4 text-card-foreground shadow-lg">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-mono text-[11px] text-highlight uppercase">{model.kind}</span>
          <h2 className="mt-0.5 text-[15px] font-semibold break-words">{model.title}</h2>
        </div>
        <Button variant="ghost" size="icon-xs" aria-label="Close details" onClick={onClose}><XIcon /></Button>
      </header>
      {model.note && <p className="mt-2 text-muted-foreground">{model.note}</p>}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {model.meta.map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono break-words">{value}</dd>
          </Fragment>
        ))}
      </dl>
      {model.badges.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1">{model.badges.map((badge) => <li key={badge}><Badge variant="outline">{badge}</Badge></li>)}</ul>
      )}
      {model.sides.map((side) => (
        <section key={side.name} className="mt-3.5">
          <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">{side.name} · <code className="font-mono">{side.type}</code></h3>
          {side.changedPaths.length > 0 && <p className="mb-1.5 font-mono text-[11px] break-words text-highlight">Changed: {side.changedPaths.join(', ')}</p>}
          {side.shape && <pre className="max-w-full overflow-x-auto rounded-md border bg-muted p-2 font-mono text-[11.5px] leading-snug">{side.shape}</pre>}
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2">
            {side.before && (
              <div>
                <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Before</h3>
                <pre className="max-w-full overflow-x-auto rounded-md border bg-muted p-2 font-mono text-[11.5px] leading-snug">{side.before}</pre>
              </div>
            )}
            {side.sample && (
              <div>
                <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">{side.before ? 'After' : 'Sample'}</h3>
                <pre className="max-w-full overflow-x-auto rounded-md border bg-muted p-2 font-mono text-[11.5px] leading-snug">{side.sample}</pre>
              </div>
            )}
          </div>
        </section>
      ))}
      {model.files.length > 0 && (
        <section className="mt-3.5">
          <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Files</h3>
          <ul className="grid gap-0.5">{model.files.map((file) => <li key={file}><code className="font-mono text-xs break-words">{file}</code></li>)}</ul>
        </section>
      )}
    </aside>
  )
}
