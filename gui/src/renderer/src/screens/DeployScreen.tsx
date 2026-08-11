/**
 * Deploy to Cart: flash a local ROM into the cart's RAM, optionally carrying a
 * save file with it. When "Back up first" is on, the cart's current save is
 * dumped to disk before the upload so nothing is ever lost; a restore is just
 * a deploy that carries the backup as its save.
 */
import { useEffect, useState } from 'react'
import { Rocket, Save } from 'lucide-react'
import type { DeployResult, LocalRom, SaveBackup, UploadProgress } from '../../../shared/types'
import { Badge, Button, Checkbox, Field, Panel, ProgressBar, Select, Spinner } from '../components/ui'
import { ConsolePanel } from '../components/ConsolePanel'
import { useOperationLog } from '../hooks'

const SAVE_TYPES = ['', 'none', 'eeprom4k', 'eeprom16k', 'sram', 'sram-banked', 'sram1m', 'flashram']

export function DeployScreen({ initialSavePath }: { initialSavePath?: string | null }): React.JSX.Element {
  const [roms, setRoms] = useState<LocalRom[]>([])
  const [romPath, setRomPath] = useState('')
  const [backups, setBackups] = useState<SaveBackup[]>([])
  const [savePath, setSavePath] = useState<string | null>(initialSavePath ?? null)
  const [saveType, setSaveType] = useState('')
  const [backupFirst, setBackupFirst] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [result, setResult] = useState<DeployResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { lines, clear } = useOperationLog()

  useEffect(() => {
    void window.api.listLocalRoms().then(setRoms).catch(() => undefined)
    void window.api.saveList().then(setBackups).catch(() => undefined)
  }, [])

  // When App routes a "Restore" over, pre-select the backup as the save to
  // flash; the ROM picker stays available for the user to choose.
  useEffect(() => {
    if (initialSavePath) setSavePath(initialSavePath)
  }, [initialSavePath])

  useEffect(() => {
    return window.api.onEvent((ev) => {
      if (ev.type === 'progress') setProgress(ev.data)
    })
  }, [])

  const run = async (): Promise<void> => {
    if (!romPath) return
    setRunning(true)
    setResult(null)
    setError(null)
    setProgress(null)
    clear()
    try {
      const res = await window.api.deploy({ romPath, savePath, saveType: saveType || null, backupFirst })
      setResult(res)
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
          <Rocket className="h-5 w-5 text-sc64-accent" />
          <h2 className="text-lg font-bold text-sc64-text">Deploy to Cart</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => void window.api.listLocalRoms().then(setRoms).catch(() => undefined)} disabled={running}>
          Refresh ROMs
        </Button>
      </div>

      {error ? <Panel className="border-sc64-bad/40 text-sm text-sc64-bad">{error}</Panel> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <Field label="ROM to deploy">
            <Select value={romPath} onChange={(e) => setRomPath(e.target.value)} disabled={running}>
              <option value="">Select a local ROM…</option>
              {roms.map((r) => (
                <option key={r.path} value={r.path}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Save file" hint="Optional — flashes the save together with the ROM." className="mt-3">
            <Select value={savePath ?? ''} onChange={(e) => setSavePath(e.target.value || null)} disabled={running}>
              <option value="">No save</option>
              {backups.map((b) => (
                <option key={b.id} value={b.path}>
                  {b.game || 'unknown'} — {b.fileName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Save type" hint="Leave on Auto-detect unless the game needs an override." className="mt-3">
            <Select value={saveType} onChange={(e) => setSaveType(e.target.value)} disabled={running}>
              {SAVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === '' ? 'Auto-detect' : t}
                </option>
              ))}
            </Select>
          </Field>
        </Panel>

        <Panel className="flex flex-col justify-between gap-4">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-sc64-muted">Safety</div>
            <Checkbox
              label="Back up the cart's current save first"
              hint="Dumps the save currently in the cart to saves/auto/ before flashing, so the previous game's progress is never lost."
              checked={backupFirst}
              onChange={setBackupFirst}
              disabled={running}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-sc64-muted">
              {romPath ? <span className="font-mono text-sc64-accent">{roms.find((r) => r.path === romPath)?.name ?? romPath}</span> : 'No ROM selected'}
            </div>
            <Button variant="primary" onClick={() => void run()} disabled={!romPath || running}>
              {running ? <Spinner className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
              {running ? 'Deploying…' : 'Deploy'}
            </Button>
          </div>
        </Panel>
      </div>

      {result ? (
        <Panel className={result.ok ? 'border-sc64-good/40' : 'border-sc64-bad/40'}>
          <p className={result.ok ? 'text-sm text-sc64-good' : 'text-sm text-sc64-bad'}>{result.message}</p>
          {result.backupPath ? (
            <div className="mt-2 flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void window.api.reveal(result.backupPath ?? '')}>
                <Save className="h-3.5 w-3.5" /> Reveal backup
              </Button>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {running || progress ? (
        <Panel>
          <ProgressBar value={progress?.value ?? 0} max={progress?.max ?? 0} label={progress?.label ?? 'Deploying…'} indeterminate={!progress || progress.max <= 0} />
        </Panel>
      ) : null}

      <ConsolePanel lines={lines} />

      {backups.length === 0 && !romPath ? (
        <Panel>
          <div className="flex items-center gap-2 text-sc64-muted">
            <Badge tone="warn">Tip</Badge>
            <span className="text-sm">Use Save Manager to create backups, then restore them here.</span>
          </div>
        </Panel>
      ) : null}
    </div>
  )
}
