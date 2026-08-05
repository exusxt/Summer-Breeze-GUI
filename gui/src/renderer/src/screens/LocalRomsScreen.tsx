/**
 * Local ROMs screen: lists every ROM under the repo's roms/ directory with its
 * size, mirroring the CLI's "List Local ROMs" command.
 */
import { useEffect, useState } from 'react'
import { AlertTriangle, FolderOpen, HardDrive, Plus, RefreshCw } from 'lucide-react'
import type { LocalRom } from '../../../shared/types'
import { ROM_REGION_LABELS } from '../../../shared/types'
import { Badge, Button, Panel, Spinner } from '../components/ui'
import { formatBytes } from '../lib'

export function LocalRomsScreen(): React.JSX.Element {
  const [roms, setRoms] = useState<LocalRom[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState<string | null>(null)

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

  const addRoms = async (): Promise<void> => {
    setAdding(true)
    setError(null)
    setAddMsg(null)
    try {
      const res = await window.api.addRoms()
      if (!res) return
      const parts: string[] = []
      if (res.added.length > 0) parts.push(`Added ${res.added.length} ROM${res.added.length === 1 ? '' : 's'}`)
      if (res.skipped.length > 0) {
        const reasons = [...new Set(res.skipped.map((s) => s.split(' (')[1]?.replace(')', '') ?? 'skipped'))]
        parts.push(`Skipped ${res.skipped.length}${reasons.length === 1 ? ` (${reasons[0]})` : ''}`)
      }
      if (res.errors.length > 0) parts.push(`${res.errors.length} failed`)
      if (res.warnings.length > 0) parts.push(`${res.warnings.length} warning${res.warnings.length === 1 ? '' : 's'}`)
      setAddMsg(parts.join(' · ') || 'No ROM files were selected')
      if (res.added.length > 0 || res.errors.length > 0) await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-sc64-accent" />
          <h2 className="text-lg font-bold text-sc64-text">Local ROMs</h2>
          {roms ? <Badge tone="accent">{roms.length} ROM(s)</Badge> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => void addRoms()} disabled={adding}>
            {adding ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            Add ROMs
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            {loading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      {error ? <Panel className="border-sc64-bad/40 text-sm text-sc64-bad">{error}</Panel> : null}
      {addMsg ? <Panel className="border-sc64-accent/40 text-sm text-sc64-text">{addMsg}</Panel> : null}

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
          <p className="text-sm text-sc64-muted">
            Use <span className="font-semibold text-sc64-text">Add ROMs</span> to import .z64, .n64, or .v64 files, or drop
            them into the roms/ folder.
          </p>
        </Panel>
      ) : (
        <Panel className="p-0">
          <ul className="divide-y divide-sc64-border">
            {roms.map((rom) => (
              <li key={rom.path} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-sm text-sc64-text">{rom.name}</span>
                    {rom.header ? (
                      <Badge tone="accent" className="shrink-0">{ROM_REGION_LABELS[rom.header.region]}</Badge>
                    ) : (
                      <Badge tone="bad" className="shrink-0">not an N64 ROM</Badge>
                    )}
                    {rom.issues?.some((i) => i.severity === 'warn') ? (
                      <Badge tone="warn" className="shrink-0">
                        <AlertTriangle className="h-3 w-3" /> check
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-sc64-muted">
                    {rom.header ? (
                      <>
                        <span className="truncate">{rom.header.title}</span>
                        <span className="font-mono">{rom.header.gameCode}</span>
                        <span className="font-mono uppercase">{rom.header.byteOrder}</span>
                      </>
                    ) : (
                      <span>Unreadable or not a valid N64 dump</span>
                    )}
                  </div>
                </div>
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
