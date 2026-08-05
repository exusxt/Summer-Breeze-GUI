/**
 * Update SC64 Menu screen: pick a menu firmware from menu_versions/ and flash
 * it, backing up the current one first, mirroring the CLI's "Update SC64
 * Menu" command.
 */
import { useEffect, useState } from 'react'
import { Disc3, Download, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react'
import type { DeviceStatus, DownloadProgress, MenuFile, MenuReleaseInfo, MenuSource } from '../../../shared/types'
import { Button, Checkbox, Panel, ProgressBar, Spinner } from '../components/ui'
import { ConsolePanel } from '../components/ConsolePanel'
import { useOperationLog } from '../hooks'
import { cn } from '../lib'
import { formatBytes } from '../lib'

export function MenuUpdateScreen(): React.JSX.Element {
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [menus, setMenus] = useState<MenuFile[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [releases, setReleases] = useState<MenuReleaseInfo[] | null>(null)
  const [releaseError, setReleaseError] = useState<string | null>(null)
  const [selectedRepo, setSelectedRepo] = useState<MenuSource | null>('official')
  const [downloading, setDownloading] = useState(false)
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null)
  const [dlProgress, setDlProgress] = useState<DownloadProgress | null>(null)
  const { lines, clear } = useOperationLog()

  const refresh = async (): Promise<void> => {
    setError(null)
    try {
      const [st, m] = await Promise.all([window.api.status(), window.api.menuList()])
      setStatus(st)
      setMenus(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const refreshReleases = async (): Promise<void> => {
    setReleaseError(null)
    try {
      setReleases(await window.api.menuReleases())
    } catch (e) {
      setReleaseError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void refresh()
    void refreshReleases()
  }, [])

  useEffect(() => {
    return window.api.onEvent((ev) => {
      if (ev.type === 'log' && ev.level === 'error') setResult((prev) => prev ?? { ok: false, message: ev.message })
    })
  }, [])

  useEffect(() => {
    const offProgress = window.api.onMenuDownloadProgress((p) => setDlProgress(p))
    const offStatus = window.api.onMenuDownloadStatus((msg) => setDownloadMsg(msg))
    return () => {
      offProgress()
      offStatus()
    }
  }, [])

  const list = menus ?? []
  const ready = selected !== null && !running && status?.device === 'connected' && status.sdAccessible

  const run = async (): Promise<void> => {
    if (!selected) return
    setRunning(true)
    setResult(null)
    clear()
    try {
      const backup = await window.api.menuBackup()
      if (!backup.ok) {
        setResult({ ok: false, message: 'Backup failed. Aborting update to be safe.' })
        return
      }
      const up = await window.api.menuUpload(selected)
      setResult(up)
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setRunning(false)
    }
  }

  const downloadMenu = async (): Promise<void> => {
    if (!selectedRepo || downloading) return
    setDownloading(true)
    setDownloadMsg(null)
    setDlProgress(null)
    try {
      const res = await window.api.menuDownload(selectedRepo)
      setDownloadMsg(res.message)
      if (res.ok) {
        await Promise.all([refresh(), refreshReleases()])
      }
    } catch (e) {
      setDownloadMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Disc3 className="h-5 w-5 text-sc64-accent" />
          <h2 className="text-lg font-bold text-sc64-text">Update SC64 Menu</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={running}>
          Refresh
        </Button>
      </div>

      {error ? <Panel className="border-sc64-bad/40 text-sm text-sc64-bad">{error}</Panel> : null}

      {status && status.device !== 'connected' ? (
        <Panel className="border-sc64-warn/40">
          <p className="text-sm text-sc64-muted">SC64 device not connected.</p>
        </Panel>
      ) : status && !status.sdAccessible ? (
        <Panel className="border-sc64-warn/40">
          <p className="text-sm text-sc64-muted">SD card is not accessible. Power ON your N64 to update the menu.</p>
        </Panel>
      ) : null}

      <Panel>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sc64-muted">
          <ShieldAlert className="h-3.5 w-3.5" /> This will backup the current menu, then upload the selected one
        </div>
        <p className="text-sm text-sc64-muted">Menu files (.z64/.n64/.v64) live in the app's menu_versions/ folder.</p>
      </Panel>

      <Panel>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sc64-muted">
            <Download className="h-3.5 w-3.5" /> Download a menu build
          </div>
          <Button variant="ghost" size="sm" onClick={() => void refreshReleases()} disabled={downloading}>
            <RefreshCw className="h-3.5 w-3.5" /> Check
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {releases?.map((r) => (
            <Checkbox
              key={r.repo}
              label={<span className="flex items-center gap-2">{r.label}</span>}
              hint={
                r.error
                  ? r.error
                  : `${r.tag ?? 'unknown'} · ${r.size ? formatBytes(r.size) : 'unknown size'}${r.present ? ' · already downloaded' : ''}`
              }
              checked={selectedRepo === r.repo}
              onChange={(v) => setSelectedRepo(v ? r.repo : null)}
              disabled={downloading}
            />
          ))}
        </div>
        {releaseError ? <p className="mt-2 text-xs text-sc64-bad">{releaseError}</p> : null}
        {releases === null ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-sc64-muted">
            <Spinner className="h-3 w-3" /> Checking GitHub…
          </p>
        ) : null}
        <div className="mt-3 flex items-center gap-3">
          <Button variant="primary" size="sm" onClick={() => void downloadMenu()} disabled={downloading || !selectedRepo}>
            {downloading ? <Spinner className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
            {downloading ? 'Downloading…' : 'Download'}
          </Button>
          {downloading && dlProgress && dlProgress.total > 0 ? (
            <div className="flex-1">
              <ProgressBar value={dlProgress.received} max={dlProgress.total} label="Downloading" />
            </div>
          ) : downloading ? (
            <div className="flex-1">
              <ProgressBar value={0} max={0} indeterminate label="Downloading" />
            </div>
          ) : null}
          {downloadMsg ? <span className="text-xs text-sc64-muted">{downloadMsg}</span> : null}
        </div>
        {selectedRepo === 'custom' && !downloading ? (
          <p className="mt-2 text-xs text-sc64-muted">
            The custom build is TheLeggett's fork of N64FlashcartMenu and adds background-music support.
          </p>
        ) : null}
      </Panel>

      {menus === null ? (
        <Panel>
          <div className="flex items-center gap-2 text-sc64-muted">
            <Spinner /> Reading menu_versions/…
          </div>
        </Panel>
      ) : list.length === 0 ? (
        <Panel>
          <p className="text-sm text-sc64-muted">No menu files found. Add .z64, .n64, or .v64 menu files to menu_versions/.</p>
        </Panel>
      ) : (
        <Panel className="p-0">
          <div className="border-b border-sc64-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-sc64-muted">Available menu versions ({list.length})</div>
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {list.map((m) => (
              <Checkbox
                key={m.path}
                label={<span className="font-mono">{m.name}</span>}
                hint={formatBytes(m.size)}
                checked={selected === m.path}
                onChange={(v) => setSelected(v ? m.path : null)}
                disabled={running}
              />
            ))}
          </div>
        </Panel>
      )}

      <ConsolePanel lines={lines} />

      {result ? (
        <Panel className={cn(result.ok ? 'border-sc64-good/40' : 'border-sc64-bad/40')}>
          <p className={cn('flex items-center gap-2 text-sm', result.ok ? 'text-sc64-good' : 'text-sc64-bad')}>
            {result.ok ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            {result.message}
          </p>
        </Panel>
      ) : null}

      {list.length > 0 ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-sc64-muted">
            {selected ? `Selected: ${list.find((m) => m.path === selected)?.name}` : 'Select a menu version to continue.'}
          </p>
          <Button variant="primary" onClick={() => void run()} disabled={!ready}>
            {running ? <Spinner className="h-4 w-4" /> : <Disc3 className="h-4 w-4" />}
            {running ? 'Updating…' : 'Backup & Update'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
