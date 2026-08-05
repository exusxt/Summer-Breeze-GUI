/**
 * Background Music screen: check whether music is set on the cart, pick an MP3
 * from menu_music/ to upload, or remove the current one. Mirrors the CLI's
 * "Set Menu Background Music" command.
 */
import { useEffect, useState } from 'react'
import { Music, VolumeX } from 'lucide-react'
import type { DeviceStatus, MusicFile, UploadProgress } from '../../../shared/types'
import { Badge, Button, Panel, ProgressBar, Spinner } from '../components/ui'
import { ConsolePanel } from '../components/ConsolePanel'
import { useOperationLog } from '../hooks'
import { cn } from '../lib'
import { formatBytes } from '../lib'

export function MusicScreen(): React.JSX.Element {
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [hasMusic, setHasMusic] = useState<boolean | null>(null)
  const [files, setFiles] = useState<MusicFile[] | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { lines, clear } = useOperationLog()

  const refresh = async (): Promise<void> => {
    setError(null)
    try {
      const st = await window.api.status()
      setStatus(st)
      if (st.device === 'connected') {
        const [music, list] = await Promise.all([window.api.musicStatus(), window.api.musicList()])
        setHasMusic(music.hasMusic)
        setFiles(list)
      } else {
        setHasMusic(null)
        setFiles(null)
      }
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

  const setMusic = async (path: string): Promise<void> => {
    setBusyAction(path)
    setResult(null)
    setProgress(null)
    clear()
    try {
      const res = await window.api.musicUpload(path)
      setResult(res)
      setHasMusic(res.ok)
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusyAction(null)
    }
  }

  const removeMusic = async (): Promise<void> => {
    setBusyAction('remove')
    setResult(null)
    clear()
    try {
      const res = await window.api.musicRemove()
      setResult(res)
      setHasMusic(!res.ok)
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusyAction(null)
    }
  }

  const list = files ?? []
  const connected = status?.device === 'connected' && status.sdAccessible

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="h-5 w-5 text-sc64-accent" />
          <h2 className="text-lg font-bold text-sc64-text">Menu Background Music</h2>
          {hasMusic === null ? null : hasMusic ? <Badge tone="good">Music set</Badge> : <Badge tone="default">No music</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busyAction !== null}>
          Refresh
        </Button>
      </div>

      <Panel className="border-sc64-warn/40">
        <p className="text-sm text-sc64-muted">
          NOTE: This feature only works with the customized SC64 menu by TheLeggett. MP3 files live in the menu_music/ folder.
        </p>
      </Panel>

      {error ? <Panel className="border-sc64-bad/40 text-sm text-sc64-bad">{error}</Panel> : null}

      {status && !connected ? (
        <Panel className="border-sc64-warn/40">
          <p className="text-sm text-sc64-muted">Connect the SC64 and power on your N64 to manage background music.</p>
        </Panel>
      ) : null}

      {files === null && connected ? (
        <Panel>
          <div className="flex items-center gap-2 text-sc64-muted">
            <Spinner /> Reading menu_music/…
          </div>
        </Panel>
      ) : null}

      {connected ? (
        <Panel className="p-0">
          <div className="border-b border-sc64-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-sc64-muted">Available MP3s ({list.length})</div>
          {list.length === 0 ? (
            <div className="p-4 text-sm text-sc64-muted">No MP3 files found. Add them to menu_music/.</div>
          ) : (
            <ul className="divide-y divide-sc64-border">
              {list.map((f) => (
                <li key={f.path} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-mono text-sm text-sc64-text">{f.name}</span>
                    <span className="text-xs text-sc64-muted">{formatBytes(f.size)}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void setMusic(f.path)} disabled={busyAction !== null}>
                    {busyAction === f.path ? <Spinner className="h-3.5 w-3.5" /> : <Music className="h-3.5 w-3.5" />}
                    {busyAction === f.path ? 'Uploading…' : 'Set as music'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {hasMusic ? (
            <div className="border-t border-sc64-border px-4 py-3">
              <Button variant="danger" size="sm" onClick={() => void removeMusic()} disabled={busyAction !== null}>
                {busyAction === 'remove' ? <Spinner className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                {busyAction === 'remove' ? 'Removing…' : 'Remove background music'}
              </Button>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {progress ? (
        <Panel>
          <ProgressBar value={progress.value} max={progress.max} label={progress.label} indeterminate={progress.max <= 0} />
        </Panel>
      ) : null}

      <ConsolePanel lines={lines} />

      {result ? (
        <Panel className={cn(result.ok ? 'border-sc64-good/40' : 'border-sc64-bad/40')}>
          <p className={cn('text-sm', result.ok ? 'text-sc64-good' : 'text-sc64-bad')}>{result.message}</p>
        </Panel>
      ) : null}
    </div>
  )
}
