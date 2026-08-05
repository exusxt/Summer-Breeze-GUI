/**
 * Quick Upload screen: pick any local ROM and upload it straight to the SD
 * card root, mirroring the CLI's "Quick Upload" command.
 */
import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import type { DeviceStatus, LocalRom, UploadProgress, UploadResult } from '../../../shared/types'
import { Badge, Button, Checkbox, Panel, ProgressBar, Spinner } from '../components/ui'
import { ConsolePanel } from '../components/ConsolePanel'
import { useOperationLog } from '../hooks'
import { cn } from '../lib'
import { formatBytes } from '../lib'

export function QuickUploadScreen(): React.JSX.Element {
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [roms, setRoms] = useState<LocalRom[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { lines, clear } = useOperationLog()

  const refresh = async (): Promise<void> => {
    setError(null)
    try {
      const [st, r] = await Promise.all([window.api.status(), window.api.listLocalRoms()])
      setStatus(st)
      setRoms(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    return window.api.onEvent((ev) => {
      if (ev.type === 'progress') setProgress(ev.data)
    })
  }, [])

  const list = roms ?? []
  const canUpload = selected.size > 0 && !running && status?.device === 'connected' && status.sdAccessible

  const toggle = (path: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const toggleAll = (): void => {
    setSelected((prev) => (prev.size === list.length ? new Set() : new Set(list.map((r) => r.path))))
  }

  const run = async (): Promise<void> => {
    if (selected.size === 0) return
    setRunning(true)
    setUploadResult(null)
    setProgress(null)
    clear()
    try {
      const res = await window.api.upload(Array.from(selected), '/')
      setUploadResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-sc64-accent" />
          <h2 className="text-lg font-bold text-sc64-text">Quick Upload</h2>
          <Badge tone="accent">{selected.size} selected</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={running}>
          Refresh
        </Button>
      </div>

      {error ? <Panel className="border-sc64-bad/40 text-sm text-sc64-bad">{error}</Panel> : null}

      {status && status.device !== 'connected' ? (
        <Panel className="border-sc64-warn/40">
          <p className="text-sm text-sc64-muted">SC64 device not connected. Plug it in via USB to upload.</p>
        </Panel>
      ) : status && !status.sdAccessible ? (
        <Panel className="border-sc64-warn/40">
          <p className="text-sm text-sc64-muted">SD card is not accessible. Power ON your N64 to upload.</p>
        </Panel>
      ) : null}

      {roms === null ? (
        <Panel>
          <div className="flex items-center gap-2 text-sc64-muted">
            <Spinner /> Scanning local ROMs…
          </div>
        </Panel>
      ) : list.length === 0 ? (
        <Panel>
          <p className="text-sm text-sc64-muted">No local ROMs found in the roms/ folder.</p>
        </Panel>
      ) : (
        <Panel className="p-0">
          <div className="flex items-center justify-between border-b border-sc64-border px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-sc64-muted">Local ROMs ({list.length})</span>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {selected.size === list.length ? 'Deselect all' : 'Select all'}
            </Button>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {list.map((rom) => (
              <Checkbox
                key={rom.path}
                label={<span className="font-mono">{rom.name}</span>}
                hint={formatBytes(rom.size)}
                checked={selected.has(rom.path)}
                onChange={() => toggle(rom.path)}
                disabled={running}
              />
            ))}
          </div>
        </Panel>
      )}

      {running || progress ? (
        <Panel>
          <ProgressBar value={progress?.value ?? 0} max={progress?.max ?? 0} label={progress?.label ?? 'Uploading…'} indeterminate={!progress || progress.max <= 0} />
        </Panel>
      ) : null}

      <ConsolePanel lines={lines} />

      {uploadResult ? (
        <Panel className={cn(uploadResult.ok ? 'border-sc64-good/40' : 'border-sc64-bad/40')}>
          <p className={cn('text-sm', uploadResult.ok ? 'text-sc64-good' : 'text-sc64-bad')}>{uploadResult.message}</p>
        </Panel>
      ) : null}

      {list.length > 0 ? (
        <div className="flex justify-end">
          <Button variant="primary" onClick={() => void run()} disabled={!canUpload}>
            {running ? <Spinner className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
            {running ? 'Uploading…' : `Upload ${selected.size} ROM(s)`}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
