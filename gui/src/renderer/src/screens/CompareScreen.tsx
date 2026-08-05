/**
 * Compare screen: shows which local ROMs are already on the cart and which are
 * missing, mirroring the CLI's "Compare" command.
 */
import { useEffect, useState } from 'react'
import { CheckCircle2, RefreshCcw, Upload } from 'lucide-react'
import type { CompareResult } from '../../../shared/types'
import { Badge, Button, Panel, Spinner } from '../components/ui'
import { formatBytes } from '../lib'

export function CompareScreen({ onGoUpload }: { onGoUpload: () => void }): React.JSX.Element {
  const [result, setResult] = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      setResult(await window.api.compare())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const missingCount = result?.missing.length ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCcw className="h-5 w-5 text-sc64-accent" />
          <h2 className="text-lg font-bold text-sc64-text">Compare Local vs Cart</h2>
          {result ? <Badge tone={missingCount > 0 ? 'warn' : 'good'}>{missingCount} missing</Badge> : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCcw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {error ? <Panel className="border-sc64-bad/40 text-sm text-sc64-bad">{error}</Panel> : null}

      {result && !result.sdAccessible ? (
        <Panel className="border-sc64-warn/40">
          <p className="text-sm text-sc64-muted">
            SD card is not accessible — all local ROMs are shown as <span className="text-sc64-text">missing</span>. Power on your N64 for an accurate comparison.
          </p>
        </Panel>
      ) : null}

      {result === null ? (
        <Panel>
          <div className="flex items-center gap-2 text-sc64-muted">
            <Spinner /> Comparing…
          </div>
        </Panel>
      ) : (
        <>
          <Panel className="p-0">
            <div className="border-b border-sc64-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-sc64-muted">
              Not on cart ({result.missing.length})
            </div>
            {result.missing.length === 0 ? (
              <div className="p-4 text-sm text-sc64-good">All local ROMs are already on the cart!</div>
            ) : (
              <ul className="divide-y divide-sc64-border">
                {result.missing.map((rom) => (
                  <li key={rom.path} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="truncate font-mono text-sm text-sc64-text">{rom.name}</span>
                    <span className="shrink-0 font-mono text-xs text-sc64-muted">{formatBytes(rom.size)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="p-0">
            <div className="border-b border-sc64-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-sc64-muted">
              Already on cart ({result.onCart.length})
            </div>
            {result.onCart.length === 0 ? (
              <div className="p-4 text-sm text-sc64-muted">No local ROMs are on the cart yet.</div>
            ) : (
              <ul className="divide-y divide-sc64-border">
                {result.onCart.map((rom) => (
                  <li key={rom.path} className="flex items-center gap-3 px-4 py-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-sc64-good" />
                    <span className="truncate font-mono text-sm text-sc64-text">{rom.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {result.missing.length > 0 ? (
            <div className="flex justify-end">
              <Button variant="primary" onClick={onGoUpload}>
                <Upload className="h-4 w-4" /> Upload missing ROMs
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
