/**
 * Save Manager: dump the cart's current save to disk with per-game history,
 * copy backups to/from the SD card's save-filer folder (/saves), and hand a
 * backup off to the Deploy screen to be flashed back with a ROM.
 */
import { useEffect, useState } from 'react'
import { Download, FolderOpen, HardDriveDownload, HardDriveUpload, Save, Upload } from 'lucide-react'
import type { SaveBackup, SaveOpResult, SdEntry } from '../../../shared/types'
import { Badge, Button, Field, Input, Panel, Spinner } from '../components/ui'
import { cn } from '../lib'

const SD_SAVES_PATH = '/saves'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function SaveManagerScreen({ onRestore }: { onRestore: (path: string) => void }): React.JSX.Element {
  const [backups, setBackups] = useState<SaveBackup[]>([])
  const [gameName, setGameName] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SaveOpResult | null>(null)
  const [sdFiles, setSdFiles] = useState<SdEntry[] | null>(null)
  const [sdBusy, setSdBusy] = useState(false)

  const refresh = async (): Promise<void> => {
    setBackups(await window.api.saveList())
  }

  useEffect(() => {
    void refresh()
  }, [])

  const backup = async (): Promise<void> => {
    setBusy(true)
    setResult(null)
    try {
      const res = await window.api.saveBackup(gameName)
      setResult(res)
      if (res.ok) {
        setGameName('')
        await refresh()
      }
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const listSd = async (): Promise<void> => {
    setSdBusy(true)
    setResult(null)
    try {
      setSdFiles(await window.api.browse(SD_SAVES_PATH))
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setSdBusy(false)
    }
  }

  const toSd = async (path: string): Promise<void> => {
    setBusy(true)
    setResult(null)
    try {
      const res = await window.api.saveToSd(path)
      setResult(res)
      if (res.ok) await listSd()
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const fromSd = async (sdPath: string): Promise<void> => {
    setBusy(true)
    setResult(null)
    try {
      const res = await window.api.saveFromSd(sdPath)
      setResult(res)
      if (res.ok) {
        await refresh()
        await listSd()
      }
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Save className="h-5 w-5 text-sc64-accent" />
          <h2 className="text-lg font-bold text-sc64-text">Save Manager</h2>
          <Badge tone="accent">{backups.length} backups</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      {result ? (
        <Panel className={cn(result.ok ? 'border-sc64-good/40' : 'border-sc64-bad/40')}>
          <p className={cn('text-sm', result.ok ? 'text-sc64-good' : 'text-sc64-bad')}>{result.message}</p>
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sc64-muted">
            <HardDriveUpload className="h-3.5 w-3.5" /> Back up the cart's save
          </div>
          <p className="mb-3 text-sm text-sc64-muted">
            Reads the save currently held in the cart's save memory (EEPROM / SRAM / FlashRAM) to disk, keeping a
            timestamped history per game.
          </p>
          <Field label="Game name" hint="Just for organizing — shown in the history list.">
            <Input value={gameName} onChange={(e) => setGameName(e.target.value)} placeholder="e.g. Zelda Ocarina of Time" />
          </Field>
          <div className="mt-3">
            <Button variant="primary" onClick={() => void backup()} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {busy ? 'Backing up…' : 'Backup current save'}
            </Button>
          </div>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sc64-muted">
              <HardDriveDownload className="h-3.5 w-3.5" /> SD card save filer
            </span>
            <Button variant="ghost" size="sm" onClick={() => void listSd()} disabled={sdBusy}>
              {sdBusy ? <Spinner className="h-3.5 w-3.5" /> : <FolderOpen className="h-3.5 w-3.5" />}
              {sdFiles ? 'Refresh' : 'List /saves'}
            </Button>
          </div>
          <p className="mb-3 text-sm text-sc64-muted">
            The menu's save filer stores <span className="font-mono">.eep</span>, <span className="font-mono">.sra</span>{' '}
            and <span className="font-mono">.fla</span> files in <span className="font-mono">/saves</span> on the SD
            card. Requires the N64 to be powered ON.
          </p>
          {sdFiles === null ? (
            <p className="text-sm text-sc64-muted">Nothing listed yet — hit “List /saves”.</p>
          ) : sdFiles.length === 0 ? (
            <p className="text-sm text-sc64-muted">No save files found on the SD card.</p>
          ) : (
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {sdFiles.map((f) => (
                <div key={f.path} className="flex items-center justify-between gap-3 rounded-lg border border-sc64-border bg-sc64-panel/60 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-sm text-sc64-text">{f.name}</div>
                    <div className="text-xs text-sc64-muted">{f.size}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void fromSd(f.path)} disabled={busy}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel className="p-0">
        <div className="flex items-center justify-between border-b border-sc64-border px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-sc64-muted">History</span>
          <span className="text-xs text-sc64-muted">Restore flashes a backup back to the cart via a deploy.</span>
        </div>
        {backups.length === 0 ? (
          <p className="px-4 py-6 text-sm text-sc64-muted">
            No backups yet. Connect the cart and click “Backup current save”.
          </p>
        ) : (
          <div className="divide-y divide-sc64-border">
            {backups.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-sc64-text">{b.game || 'unknown'}</span>
                    <Badge tone={b.source === 'auto' ? 'warn' : b.source === 'sd' ? 'accent' : 'good'}>
                      {b.source === 'auto' ? 'auto' : b.source === 'sd' ? 'SD' : 'manual'}
                    </Badge>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-xs text-sc64-muted">
                    {b.fileName} · {formatSize(b.size)}
                    {b.saveType ? ` · ${b.saveType}` : ''} · {formatDate(b.date)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void toSd(b.path)} disabled={busy}>
                    <Upload className="h-3.5 w-3.5" /> To SD
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void window.api.reveal(b.path)}>
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => onRestore(b.path)}>
                    Restore
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
