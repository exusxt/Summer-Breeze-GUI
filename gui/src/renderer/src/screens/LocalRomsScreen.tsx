/**
 * Local ROMs screen: lists every ROM under the repo's roms/ directory with its
 * size, mirroring the CLI's "List Local ROMs" command.
 */
import { useEffect, useState } from 'react'
import { FolderOpen, HardDrive, RefreshCw } from 'lucide-react'
import type { LocalRom } from '../../../shared/types'
import { Badge, Button, Panel, Spinner } from '../components/ui'
import { formatBytes } from '../lib'

export function LocalRomsScreen(): React.JSX.Element {
  const [roms, setRoms] = useState<LocalRom[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      setRoms(await window.api.listLocalRoms())
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-sc64-accent" />
          <h2 className="text-lg font-bold text-sc64-text">Local ROMs</h2>
          {roms ? <Badge tone="accent">{roms.length} ROM(s)</Badge> : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {error ? <Panel className="border-sc64-bad/40 text-sm text-sc64-bad">{error}</Panel> : null}

      {roms === null ? (
        <Panel>
          <div className="flex items-center gap-2 text-sc64-muted">
            <Spinner /> Scanning roms/…
          </div>
        </Panel>
      ) : roms.length === 0 ? (
        <Panel>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-sc64-text">
            <FolderOpen className="h-4 w-4 text-sc64-accent" /> No ROM files found
          </div>
          <p className="text-sm text-sc64-muted">Add .z64, .n64, or .v64 files to the roms/ folder next to summerbreeze.py.</p>
        </Panel>
      ) : (
        <Panel className="p-0">
          <ul className="divide-y divide-sc64-border">
            {roms.map((rom) => (
              <li key={rom.path} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <span className="truncate font-mono text-sm text-sc64-text">{rom.name}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-xs text-sc64-muted">{formatBytes(rom.size)}</span>
                  <Button variant="ghost" size="sm" onClick={() => void window.api.reveal(rom.path)} title="Show in folder">
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
