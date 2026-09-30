import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { versionLabel } from '../lib/versions.js'

export function VersionPicker ({ versions, latestRev, current, onChoose }) {
  return (
    <Select value={String(current)} onValueChange={(value) => onChoose(Number(value))}>
      <SelectTrigger size="sm" className="mt-1.5 w-full text-xs" aria-label="Diagram version"><SelectValue /></SelectTrigger>
      <SelectContent>
        {versions.map((version) => (
          <SelectItem key={version.rev} value={String(version.rev)}>{versionLabel(version, latestRev)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
