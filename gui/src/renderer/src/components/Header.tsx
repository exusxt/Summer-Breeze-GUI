/**
 * In-window header/banner below the frameless title bar. Shows the app
 * identity, live device/SD-card badges and a warning when the sc64deployer
 * binary is missing.
 */
import { AlertTriangle, RefreshCw, Usb } from 'lucide-react'
import type { AppConfig, DeviceStatus } from '../../../shared/types'
import { Badge, Button, Spinner } from './ui'
import appIcon from '../assets/app-icon.png'

export function Header({
  status,
  config,
  refreshing,
  onRefresh
}: {
  status: DeviceStatus | null
  config: AppConfig | null
  refreshing: boolean
  onRefresh: () => void
}): React.JSX.Element {
  const missingDeployer = config && !config.deployerPresent

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-sc64-accent/40 shadow-glow">
          <img src={appIcon} alt="Summer Breeze GUI" className="h-full w-full object-cover" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight text-sc64-text">Summer Breeze GUI</h1>
          <p className="text-xs text-sc64-muted">Manage ROMs on your SummerCart64 flash cart</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {missingDeployer ? (
          <Badge tone="bad">
            <AlertTriangle className="h-3 w-3" />
            sc64deployer.exe missing
          </Badge>
        ) : null}
        {status ? (
          status.device === 'connected' ? (
            <Badge tone="good">
              <Usb className="h-3 w-3" />
              Device connected
            </Badge>
          ) : (
            <Badge tone="bad">
              <Usb className="h-3 w-3" />
              Device not connected
            </Badge>
          )
        ) : null}
        {status ? (
          status.sdAccessible ? (
            <Badge tone="good">SD card accessible</Badge>
          ) : status.device === 'connected' ? (
            <Badge tone="warn">SD card not accessible (power on N64)</Badge>
          ) : null
        ) : null}
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>
    </header>
  )
}
