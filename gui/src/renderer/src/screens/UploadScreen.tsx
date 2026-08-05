/**
 * Upload screen: select which missing ROMs to upload and where, then run the
 * upload with live per-file progress, mirroring the CLI's "Upload ROMs to
 * Cart" command.
 */
import { useEffect, useState } from 'react'
import { Upload, FolderOpen } from 'lucide-react'
import type { CompareResult, UploadProgress, UploadResult } from '../../../shared/types'
import { Badge, Button, Checkbox, Field, Input, Panel, ProgressBar, Select, Spinner } from '../components/ui'
import { ConsolePanel } from '../components/ConsolePanel'
import { useOperationLog } from '../hooks'
import { cn } from '../lib'

export function UploadScreen(): React.JSX.Element {
  const [result, setResult] = useState<CompareResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [destMode, setDestMode] = useState<'root' | 'custom'>('root')
  const [customPath, setCustomPath] = useState('/games')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { lines, clear } = useOperationLog()

  const refresh = async (): Promise<void> => {
    setError(null)
    try {
      setResult(await window.api.compare())
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

  const missing = result?.missing ?? []
  const dest = destMode === 'root' ? '/' : customPath

  const toggle = (path: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const toggleAll = (): void => {
    setSelected((prev) => (prev.size === missing.length ? new Set() : new Set(missing.map((r) => r.path))))
  }

  const run = async (): Promise<void> => {
    if (selected.size === 0) return
    setRunning(true)
    setUploadResult(null)
    setProgress(null)
    clear()
    try {
      const res = await window.api.upload(Array.from(selected), dest)
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
          <Upload className="h-5 w-5 text-sc64-accent" />
          <h2 className="text-lg font-bold text-sc64-text">Upload ROMs to Cart</h2>
          <Badge tone="accent">{selected.size} selected</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={running}>
          Refresh
        </Button>
      </div>

      {error ? <Panel className="border-sc64-bad/40 text-sm text-sc64-bad">{error}</Panel> : null}

      {result && !result.sdAccessible ? (
        <Panel className="border-sc64-warn/40">
          <p className="text-sm text-sc64-muted">
            SD card is not accessible. <span className="text-sc64-text">Power ON your N64</span> to enable SD card access before uploading.
          </p>
        </Panel>
      ) : null}

      {result === null ? (
        <Panel>
          <div className="flex items-center gap-2 text-sc64-muted">
            <Spinner /> Checking which ROMs are missing…
          </div>
        </Panel>
      ) : (
        <>
          {missing.length === 0 ? (
            <Panel>
              <p className="text-sm text-sc64-good">All local ROMs are already on the cart — nothing to upload.</p>
            </Panel>
          ) : (
            <Panel className="p-0">
              <div className="flex items-center justify-between border-b border-sc64-border px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-sc64-muted">Missing ROMs ({missing.length})</span>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selected.size === missing.length ? 'Deselect all' : 'Select all'}
                </Button>
              </div>
              <div className="grid gap-2 p-3 sm:grid-cols-2">
                {missing.map((rom) => (
                  <Checkbox
                    key={rom.path}
                    label={<span className="font-mono">{rom.name}</span>}
                    hint={rom.path}
                    checked={selected.has(rom.path)}
                    onChange={() => toggle(rom.path)}
                    disabled={running}
                  />
                ))}
              </div>
            </Panel>
          )}

          {missing.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Panel>
                <Field label="Upload destination on SD card">
                  <Select value={destMode} onChange={(e) => setDestMode(e.target.value as 'root' | 'custom')} disabled={running}>
                    <option value="root">Root directory (/)</option>
                    <option value="custom">Custom path</option>
                  </Select>
                </Field>
                {destMode === 'custom' ? (
                  <Field label="SD card path" hint="e.g. /games — creates the folder on the card" className="mt-3">
                    <Input value={customPath} onChange={(e) => setCustomPath(e.target.value)} placeholder="/games" disabled={running} />
                  </Field>
                ) : null}
              </Panel>

              <Panel className="flex flex-col justify-center">
                <div className="flex items-center gap-2 text-sm text-sc64-muted">
                  <FolderOpen className="h-4 w-4 text-sc64-accent" />
                  Uploading to <span className="font-mono text-sc64-accent">{dest}</span>
                </div>
              </Panel>
            </div>
          ) : null}

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

          {missing.length > 0 ? (
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => void run()} disabled={selected.size === 0 || running || !result.sdAccessible}>
                {running ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                {running ? 'Uploading…' : `Upload ${selected.size} ROM(s)`}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
