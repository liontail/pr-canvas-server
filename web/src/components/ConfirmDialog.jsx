import { useState } from 'preact/hooks'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function ConfirmDialog ({ open, onOpenChange, title, description, confirmLabel = 'Delete', onConfirm }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function confirm () {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) setError(null); onOpenChange(next) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={busy} onClick={confirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
