/**
 * Auto-update toast pinned to the bottom-right corner. Renders the updater's
 * state machine (checking, available, not-available, downloading, downloaded,
 * error) with matching icons, download progress and an install/later action
 * once a build is ready. State changes arrive through the parent, which feeds
 * it from window.api onUpdate events.
 */
import { CheckCircle2, Download, X, XCircle } from 'lucide-react'
import type { UpdateState } from '../../../shared/types'
import { Button, Spinner } from './ui'

/**
 * Update toast. Presentational: the parent supplies the current UpdateState and
 * the dismiss/install callbacks (wired to window.api.installUpdate and the
 * local dismiss state), keeping main-process calls out of this component.
 */
export function UpdateToast({
  update,
  onDismiss,
  onInstall
}: {
  update: UpdateState
  onDismiss: () => void
  onInstall: () => void
}): React.JSX.Element {
  const { state } = update

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-2xl border border-sc64-border bg-sc64-panel p-4 shadow-2xl shadow-black/50 backdrop-blur">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">
          {state === 'checking' || state === 'downloading' ? (
            <Spinner className="h-4 w-4" />
          ) : state === 'downloaded' || state === 'not-available' ? (
            <CheckCircle2 className="h-4 w-4 text-sc64-good" />
          ) : state === 'error' ? (
            <XCircle className="h-4 w-4 text-sc64-bad" />
          ) : (
            <Download className="h-4 w-4 text-sc64-accent" />
          )}
        </div>
        <div className="min-w-0 flex-1 text-xs leading-relaxed text-sc64-text">
          {state === 'checking' ? 'Checking for updates…' : null}
          {state === 'available' ? `Update v${update.version ?? ''} is available. Downloading…` : null}
          {state === 'not-available' ? 'You are on the latest version.' : null}
          {state === 'downloading' ? `Downloading update… ${update.percent ?? 0}%` : null}
          {state === 'downloaded' ? 'Update ready to install.' : null}
          {state === 'error' ? `Update failed: ${update.message ?? 'unknown error'}` : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-0.5 text-sc64-muted transition-colors hover:bg-sc64-panel2 hover:text-sc64-text"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {state === 'downloading' ? (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-sc64-panel2">
          <div
            className="h-full rounded-full bg-sc64-accent transition-[width] duration-300"
            style={{ width: `${update.percent ?? 0}%` }}
          />
        </div>
      ) : null}

      {state === 'downloaded' ? (
        <div className="mt-3 flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={onInstall}>
            Install now
          </Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Later
          </Button>
        </div>
      ) : null}
    </div>
  )
}
