/**
 * SD Card Browser: a navigable directory tree of the cart's SD card, mirroring
 * the CLI's "Browse SD Card" command.
 */
import { useEffect, useState } from 'react'
import { ArrowLeft, Folder, FolderTree, File as FileIcon, RefreshCw } from 'lucide-react'
import type { DeviceStatus, SdEntry } from '../../../shared/types'
import { Badge, Button, Panel, Spinner } from '../components/ui'
import { cn } from '../lib'

const ROM_EXTS = ['.z64', '.n64', '.v64']

function isRom(name: string): boolean {
  const lower = name.toLowerCase()
  return ROM_EXTS.some((e) => lower.endsWith(e))
}

export function SdBrowserScreen(): React.JSX.Element {
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [path, setPath] = useState('/')
  const [history, setHistory] = useState<string[]>([])
  const [entries, setEntries] = useState<SdEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async (target: string): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const list = await window.api.browse(target)
      setEntries(list)
      setPath(target)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const refresh = async (): Promise<void> => {
    const st = await window.api.status().catch(() => null)
    setStatus(st)
    await load(path)
  }

  useEffect(() => {
    void (async () => {
      const st = await window.api.status().catch(() => null)
      setStatus(st)
      if (st?.sdAccessible) await load('/')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enter = (entry: SdEntry): void => {
    if (entry.type !== 'dir') return
    setHistory((h) => [...h, path])
    void load(entry.path)
  }

  const goUp = (): void => {
    if (history.length === 0) {
      if (path === '/') return
      const parts = path.replace(/\/+$/, '').split('/')
      parts.pop()
      void load(parts.length > 1 ? parts.join('/') : '/')
      return
    }
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    void load(prev)
  }

  const dirs = (entries ?? []).filter((e) => e.type === 'dir').sort((a, b) => a.name.localeCompare(b.name))
  const files = (entries ?? []).filter((e) => e.type === 'file').sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-sc64-accent" />
          <h2 className="text-lg font-bold text-sc64-text">SD Card Browser</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goUp} disabled={loading || path === '/'}>
            <ArrowLeft className="h-3.5 w-3.5" /> Up
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            {loading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      {status && !status.sdAccessible ? (
        <Panel className="border-sc64-warn/40">
          <p className="text-sm text-sc64-muted">
            SD card is not accessible. <span className="text-sc64-text">Power ON your N64</span> to browse the SD card.
          </p>
        </Panel>
      ) : (
        <>
          <Panel className="flex items-center gap-2">
            <Folder className="h-4 w-4 shrink-0 text-sc64-accent" />
            <span className="truncate font-mono text-sm text-sc64-text">{path}</span>
          </Panel>

          {error ? <Panel className="border-sc64-bad/40 text-sm text-sc64-bad">{error}</Panel> : null}

          <Panel className="p-0">
            {entries === null ? (
              <div className="flex items-center gap-2 p-4 text-sc64-muted">
                <Spinner /> Listing…
              </div>
            ) : dirs.length === 0 && files.length === 0 ? (
              <div className="p-4 text-sm text-sc64-muted">(empty directory)</div>
            ) : (
              <ul className="divide-y divide-sc64-border">
                {dirs.map((d) => (
                  <li key={d.path}>
                    <button
                      type="button"
                      onClick={() => enter(d)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-sc64-panel"
                    >
                      <Folder className="h-4 w-4 shrink-0 text-sc64-accent2" />
                      <span className="truncate font-mono text-sm text-sc64-text">{d.name}/</span>
                      <Badge>dir</Badge>
                    </button>
                  </li>
                ))}
                {files.map((f) => (
                  <li key={f.path} className="flex items-center gap-3 px-4 py-2.5">
                    <FileIcon className={cn('h-4 w-4 shrink-0', isRom(f.name) ? 'text-sc64-accent' : 'text-sc64-muted')} />
                    <span className="truncate font-mono text-sm text-sc64-text">{f.name}</span>
                    {f.size && f.size !== '----' ? <span className="ml-auto shrink-0 font-mono text-xs text-sc64-muted">{f.size}</span> : null}
                    {isRom(f.name) ? <Badge tone="accent">ROM</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}
