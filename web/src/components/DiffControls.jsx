import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { previousRev, versionLabel } from '../lib/versions.js'

const LEGEND = [
  ['NEW', 'text-green-600 dark:text-green-400'],
  ['CHANGED', 'text-amber-600 dark:text-amber-400'],
  ['REMOVED', 'text-red-600 dark:text-red-400'],
]

export function DiffControls ({ versions, rev, base, onToggle, onBase }) {
  const previous = previousRev(versions, rev)
  const on = base !== null
  if (!on && previous === null) return null
  const latestRev = versions[0].rev
  return (
    <div className="mt-1.5 space-y-1.5">
      <Button size="xs" variant={on ? 'default' : 'outline'} aria-pressed={on} onClick={() => onToggle(on ? null : previous)}>Diff</Button>
      {on && (
        <>
          <Select value={String(base)} onValueChange={(value) => onBase(Number(value))}>
            <SelectTrigger size="sm" className="w-full text-xs" aria-label="Compare with"><SelectValue /></SelectTrigger>
            <SelectContent>
              {versions.filter((version) => version.rev !== rev).map((version) => (
                <SelectItem key={version.rev} value={String(version.rev)}>{versionLabel(version, latestRev)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">Compared with rev {base}</p>
          <p className="flex gap-2 text-[10px] font-semibold">
            {LEGEND.map(([label, color]) => <span key={label} className={color}>{label}</span>)}
          </p>
        </>
      )}
    </div>
  )
}
