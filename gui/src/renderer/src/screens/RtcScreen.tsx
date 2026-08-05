/**
 * Sync RTC screen: one click to set the cart's real-time clock to the system
 * time, mirroring the CLI's "Sync RTC Clock" command.
 */
import { useState } from 'react'
import { Clock } from 'lucide-react'
import { Button, Panel, Spinner } from '../components/ui'
import { cn } from '../lib'

export function RtcScreen(): React.JSX.Element {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const sync = async (): Promise<void> => {
    setRunning(true)
    setResult(null)
    try {
      const res = await window.api.syncRtc()
      setResult(res)
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-sc64-accent" />
        <h2 className="text-lg font-bold text-sc64-text">Sync RTC Clock</h2>
      </div>

      <Panel>
        <p className="text-sm text-sc64-muted">
          Sets the SummerCart64's real-time clock to your PC's current time. This keeps the menu clock and in-game clocks accurate.
        </p>
      </Panel>

      <div className="flex justify-start">
        <Button variant="primary" onClick={() => void sync()} disabled={running}>
          {running ? <Spinner className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          {running ? 'Syncing…' : 'Sync Now'}
        </Button>
      </div>

      {result ? (
        <Panel className={cn(result.ok ? 'border-sc64-good/40' : 'border-sc64-bad/40')}>
          <p className={cn('text-sm', result.ok ? 'text-sc64-good' : 'text-sc64-bad')}>{result.message}</p>
        </Panel>
      ) : null}
    </div>
  )
}
