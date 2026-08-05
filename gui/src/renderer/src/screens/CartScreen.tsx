/**
 * Cart Contents screen: shows the SD card's root directory and the full
 * recursive ROM listing, mirroring the CLI's "List Cart Contents" command.
 */
import { useEffect, useState } from 'react'
import { Folder, ListTree, RefreshCw, File as FileIcon } from 'lucide-react'
import type { DeviceStatus, SdEntry } from '../../../shared/types'
import { Badge, Button, Panel, Spinner } from '../components/ui'

const ROM_EXTS = ['.z64', '.n64', '.v64']

function isRom(name: string): boolean {
  const lower = name.toLowerCase()
  return ROM_EXTS.some((e) => lower.endsWith(e))
}

export function CartScreen(): React.JSX.Element {
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [root, setRoot] = useState<SdEntry[] | null>(null)
  const [roms, setRoms] = useState<SdEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const st = await window.api.status()
      setStatus(st)
      if (st.sdAccessible) {
        const [r, all] = await Promise.all([window.api.listCart('/'), window.api.allSdRoms()])
        setRoot(r)
        setRoms(all)
      } else {
        setRoot([])
        setRoms([])
      }
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

  const dirs = (root ?? []).filter((f) => f.type === 'dir')
  const files = (root ?? []).filter((f) => f.type === 'file')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTree className="h-5 w-5 text-sc64-accent" />
          <h2 className="text-lg font-bold text-sc64-text">Cart SD Card Contents</h2>
          {roms ? <Badge tone="accent">{roms.length} ROM(s)</Badge> : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {error ? <Panel className="border-sc64-bad/40 text-sm text-sc64-bad">{error}</Panel> : null}

      {status && !status.sdAccessible ? (
        <Panel className="border-sc64-warn/40">
          <p className="text-sm text-sc64-muted">
            SD card is not accessible. <span className="text-sc64-text">Power ON your N64</span> to access the SD card.
          </p>
        </Panel>
      ) : (
        <>
          <Panel className="p-0">
            <div className="border-b border-sc64-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-sc64-muted">SD Card Root</div>
            {root === null ? (
              <div className="flex items-center gap-2 p-4 text-sc64-muted">
                <Spinner /> Listing…
              </div>
            ) : dirs.length === 0 && files.length === 0 ? (
              <div className="p-4 text-sm text-sc64-muted">(empty or not accessible)</div>
            ) : (
              <ul className="divide-y divide-sc64-border">
                {dirs.map((d) => (
                  <li key={d.path} className="flex items-center gap-3 px-4 py-2.5">
                    <Folder className="h-4 w-4 shrink-0 text-sc64-accent2" />
                    <span className="font-mono text-sm text-sc64-text">{d.name}/</span>
                    <Badge>dir</Badge>
                  </li>
                ))}
                {files.map((f) => (
                  <li key={f.path} className="flex items-center gap-3 px-4 py-2.5">
                    <FileIcon className={isRom(f.name) ? 'h-4 w-4 shrink-0 text-sc64-accent' : 'h-4 w-4 shrink-0 text-sc64-muted'} />
                    <span className="truncate font-mono text-sm text-sc64-text">{f.name}</span>
                    {f.size && f.size !== '----' ? <span className="ml-auto shrink-0 font-mono text-xs text-sc64-muted">{f.size}</span> : null}
                    {isRom(f.name) ? <Badge tone="accent">ROM</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="p-0">
            <div className="border-b border-sc64-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-sc64-muted">All ROMs on cart</div>
            {roms === null ? (
              <div className="flex items-center gap-2 p-4 text-sc64-muted">
                <Spinner /> Scanning…
              </div>
            ) : roms.length === 0 ? (
              <div className="p-4 text-sm text-sc64-muted">No ROM files found on the SD card.</div>
            ) : (
              <ul className="divide-y divide-sc64-border">
                {roms.map((rom) => (
                  <li key={rom.path} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="truncate font-mono text-sm text-sc64-text">{rom.path}</span>
                    {rom.size && rom.size !== '----' ? <span className="shrink-0 font-mono text-xs text-sc64-muted">{rom.size}</span> : null}
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
