/**
 * Update SC64 Menu screen: pick a menu firmware from menu_versions/ and flash
 * it, backing up the current one first, mirroring the CLI's "Update SC64
 * Menu" command.
 */
import { useEffect, useState } from 'react'
import { Disc3, ShieldCheck, ShieldAlert } from 'lucide-react'
import type { DeviceStatus, MenuFile } from '../../../shared/types'
import { Button, Checkbox, Panel, Spinner } from '../components/ui'
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

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    return window.api.onEvent((ev) => {
      if (ev.type === 'log' && ev.level === 'error') setResult((prev) => prev ?? { ok: false, message: ev.message })
    })
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
        <p className="text-sm text-sc64-muted">Menu files (.z64/.n64/.v64) live in the menu_versions/ folder next to summerbreeze.py.</p>
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
