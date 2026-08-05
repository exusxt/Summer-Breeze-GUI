/**
 * Status screen: device connection, firmware info, SD card accessibility and a
 * one-click RTC sync, mirroring the CLI's "Show Status" command.
 */
import { useEffect, useState } from 'react'
import { Activity, Clock, Cpu, RefreshCw, Usb } from 'lucide-react'
import type { DeviceStatus } from '../../../shared/types'
import { Badge, Button, Panel, Spinner } from '../components/ui'
import { cn } from '../lib'

export function StatusScreen(): React.JSX.Element {
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [rtcResult, setRtcResult] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      setStatus(await window.api.status())
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

  const syncRtc = async (): Promise<void> => {
    setSyncing(true)
    setRtcResult(null)
    try {
      const res = await window.api.syncRtc()
      setRtcResult(res.message)
    } catch (e) {
      setRtcResult(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-sc64-accent" />
          <h2 className="text-lg font-bold text-sc64-text">SC64 Status</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {error ? <Panel className="border-sc64-bad/40 text-sm text-sc64-bad">{error}</Panel> : null}

      {status ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Panel>
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sc64-muted">
                  <Usb className="h-3.5 w-3.5" /> Device
                </span>
                {status.device === 'connected' ? <Badge tone="good">Connected</Badge> : <Badge tone="bad">Not connected</Badge>}
              </div>
              {status.device === 'connected' ? (
                <ul className="space-y-1.5 text-sm text-sc64-text">
                  <li className="flex justify-between gap-4">
                    <span className="text-sc64-muted">Firmware</span>
                    <span className="font-mono">{status.firmwareVersion ?? '—'}</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span className="text-sc64-muted">Boot mode</span>
                    <span className="font-mono">{status.bootMode ?? '—'}</span>
                  </li>
                </ul>
              ) : (
                <p className="text-sm text-sc64-muted">Make sure your SummerCart64 is plugged in via USB.</p>
              )}
            </Panel>

            <Panel>
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sc64-muted">
                  <Cpu className="h-3.5 w-3.5" /> SD Card
                </span>
                {status.sdAccessible ? <Badge tone="good">Accessible</Badge> : <Badge tone="warn">Not accessible</Badge>}
              </div>
              {!status.sdAccessible ? (
                <p className="text-sm text-sc64-muted">
                  SD card access requires the N64 to be <span className="text-sc64-text">powered ON</span>. Turn the console on and try again.
                </p>
              ) : (
                <p className="text-sm text-sc64-text">The cart's SD card is ready for reads and writes.</p>
              )}
            </Panel>
          </div>

          <Panel className={cn('flex flex-wrap items-center justify-between gap-3')}>
            <div>
              <div className="text-sm font-semibold text-sc64-text">Sync RTC Clock</div>
              <div className="text-xs text-sc64-muted">Set the cart's real-time clock to your system time.</div>
            </div>
            <Button variant="primary" size="sm" onClick={() => void syncRtc()} disabled={syncing || status.device !== 'connected'}>
              {syncing ? <Spinner className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {syncing ? 'Syncing…' : 'Sync Now'}
            </Button>
          </Panel>
          {rtcResult ? <Panel className="text-sm text-sc64-text">{rtcResult}</Panel> : null}
        </>
      ) : (
        <Panel>
          <div className="flex items-center gap-2 text-sc64-muted">
            <Spinner /> Loading status…
          </div>
        </Panel>
      )}
    </div>
  )
}
