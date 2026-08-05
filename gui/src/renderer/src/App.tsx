/**
 * Renderer entry component: the top-level app shell. Applies the active theme,
 * shows the gallery background for glass themes, and routes between the ten
 * feature screens behind the frameless title bar and sidebar.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download, RefreshCw, Shuffle } from 'lucide-react'
import type { AppConfig, DeviceStatus, DownloadProgress, PythonStatus, UpdateState } from '../../shared/types'
import { DEPLOYER_VERSION, MIN_PYTHON } from '../../shared/types'
import { applyTheme, isGalleryTheme, THEMES, type ThemeId } from './lib'
import { BACKGROUNDS } from './backgrounds'
import { TitleBar } from './components/TitleBar'
import { Header } from './components/Header'
import { Sidebar, type ScreenId } from './components/Sidebar'
import { Button, Panel, ProgressBar, Spinner } from './components/ui'
import { UpdateToast } from './components/UpdateToast'
import { StatusScreen } from './screens/StatusScreen'
import { LocalRomsScreen } from './screens/LocalRomsScreen'
import { CartScreen } from './screens/CartScreen'
import { CompareScreen } from './screens/CompareScreen'
import { UploadScreen } from './screens/UploadScreen'
import { QuickUploadScreen } from './screens/QuickUploadScreen'
import { MenuUpdateScreen } from './screens/MenuUpdateScreen'
import { MusicScreen } from './screens/MusicScreen'
import { RtcScreen } from './screens/RtcScreen'
import { SdBrowserScreen } from './screens/SdBrowserScreen'

const THEME_KEY = 'summer-breeze-theme'

function loadTheme(): ThemeId {
  const saved = window.localStorage.getItem(THEME_KEY)
  return saved && saved in THEMES ? (saved as ThemeId) : 'gallery'
}

export default function App(): React.JSX.Element {
  const [theme, setTheme] = useState<ThemeId>(loadTheme)
  const [version, setVersion] = useState('')
  const [maximized, setMaximized] = useState(false)
  const [screen, setScreen] = useState<ScreenId>('status')
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [galleryBg, setGalleryBg] = useState<string | null>(null)
  const [deployerDenied, setDeployerDenied] = useState(false)
  const [python, setPython] = useState<PythonStatus | null>(null)
  const [pythonDenied, setPythonDenied] = useState(false)
  const [installingPython, setInstallingPython] = useState(false)
  const [pythonMsg, setPythonMsg] = useState<string | null>(null)
  const [download, setDownload] = useState<{ running: boolean; progress: DownloadProgress | null; status: string; error: string | null }>({
    running: false,
    progress: null,
    status: '',
    error: null
  })
  const [update, setUpdate] = useState<UpdateState | null>(null)
  const [updateDismissed, setUpdateDismissed] = useState(false)

  const refreshStatus = useCallback(async (): Promise<void> => {
    setRefreshing(true)
    try {
      const st = await window.api.status()
      setStatus(st)
      setConfig((await window.api.config()) as AppConfig)
    } catch {
      setStatus(null)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
    window.api.getVersion().then(setVersion).catch(() => undefined)
    window.api.windowIsMaximized().then(setMaximized).catch(() => undefined)
    window.api.pythonStatus().then(setPython).catch(() => undefined)
    const offMax = window.api.onWindowMaximized(setMaximized)
    return offMax
  }, [refreshStatus])

  useEffect(() => {
    const offProgress = window.api.onDownloadProgress((p) => setDownload((d) => ({ ...d, progress: p })))
    const offStatus = window.api.onDownloadStatus((s) => setDownload((d) => ({ ...d, status: s })))
    return () => {
      offProgress()
      offStatus()
    }
  }, [])

  useEffect(() => {
    const offUpdate = window.api.onUpdate((s) => {
      setUpdate(s)
      // A fresh state (available/downloading/etc.) should surface the toast
      // again even if it was dismissed before.
      setUpdateDismissed(false)
    })
    return offUpdate
  }, [])

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!isGalleryTheme(theme)) {
      setGalleryBg(null)
      return
    }
    setGalleryBg(BACKGROUNDS.length > 0 ? BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)] : null)
  }, [theme])

  const shuffleBg = (): void => {
    setGalleryBg((prev) => {
      if (BACKGROUNDS.length === 0) return prev
      if (BACKGROUNDS.length === 1) return BACKGROUNDS[0]
      let next = prev
      while (next === prev) {
        next = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]
      }
      return next
    })
  }

  const deployerMissing = config ? !config.deployerPresent : false
  const deployerBlocked = deployerMissing && deployerDenied
  const pythonMissing = python ? !python.installed && !pythonDenied : false

  const installPythonNow = async (): Promise<void> => {
    setInstallingPython(true)
    setPythonMsg(null)
    try {
      const res = await window.api.installPython()
      setPythonMsg(res.message)
      if (res.relaunch) return
      const st = await window.api.pythonStatus()
      setPython(st)
      if (st.installed) await refreshStatus()
    } catch (e) {
      setPythonMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setInstallingPython(false)
    }
  }

  const checkPythonAgain = async (): Promise<void> => {
    const st = await window.api.retryBridge()
    setPython(st)
    if (st.installed) await refreshStatus()
  }

  const startDownload = async (): Promise<void> => {
    setDownload({ running: true, progress: null, status: 'Starting download…', error: null })
    try {
      const res = await window.api.downloadDeployer()
      if (!res.ok) throw new Error(res.message)
      setDownload((d) => ({ ...d, running: false, status: 'Installed', error: null }))
    } catch (e) {
      setDownload((d) => ({ ...d, running: false, error: e instanceof Error ? e.message : String(e) }))
    } finally {
      await refreshStatus()
    }
  }

  const screenEl = useMemo(() => {
    switch (screen) {
      case 'status':
        return <StatusScreen />
      case 'local':
        return <LocalRomsScreen />
      case 'cart':
        return <CartScreen />
      case 'compare':
        return <CompareScreen onGoUpload={() => setScreen('upload')} />
      case 'upload':
        return <UploadScreen />
      case 'quick':
        return <QuickUploadScreen />
      case 'menu':
        return <MenuUpdateScreen />
      case 'music':
        return <MusicScreen />
      case 'rtc':
        return <RtcScreen />
      case 'browse':
        return <SdBrowserScreen />
    }
  }, [screen])

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      {isGalleryTheme(theme) && galleryBg ? (
        <>
          <img src={galleryBg} alt="" className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 z-0" style={{ background: THEMES[theme].vars['--sc64-gallery-overlay'] }} />
        </>
      ) : null}

      <div className="relative z-40 shrink-0">
        <TitleBar
          version={version}
          theme={theme}
          maximized={maximized}
          update={update}
          onCheckForUpdates={() => void window.api.checkForUpdates()}
          onThemeChange={setTheme}
          onMinimize={() => void window.api.windowMinimize()}
          onToggleMaximize={() => void window.api.windowToggleMaximize().then(setMaximized)}
          onClose={() => void window.api.windowClose()}
        />
      </div>

      {pythonMissing ? (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-xl border border-sc64-border bg-sc64-panel p-6 shadow-2xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-sc64-warn" />
              <h2 className="text-base font-bold text-sc64-text">Python is required</h2>
            </div>
            <p className="mt-2 text-sm text-sc64-muted">
              Summer Breeze runs the official Summer Breeze CLI through Python {MIN_PYTHON} or newer.
              {python?.version
                ? ` A Python ${python.version} installation was found, which is too old.`
                : ' No Python installation was found on this system.'}
            </p>
            {pythonMsg ? <Panel className="mt-3 border-sc64-accent/40 text-xs text-sc64-text">{pythonMsg}</Panel> : null}
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="primary" disabled={installingPython} onClick={() => void installPythonNow()}>
                {installingPython ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {installingPython ? 'Installing Python…' : 'Install Python'}
              </Button>
              <Button variant="outline" disabled={installingPython} onClick={() => void checkPythonAgain()}>
                Check again
              </Button>
              <Button variant="ghost" onClick={() => setPythonDenied(true)}>
                No thanks — I'll install it myself
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {deployerMissing && !deployerDenied && !download.running ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-xl border border-sc64-border bg-sc64-panel p-6 shadow-2xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-sc64-warn" />
              <h2 className="text-base font-bold text-sc64-text">sc64deployer.exe not found</h2>
            </div>
            <p className="mt-2 text-sm text-sc64-muted">
              Summer Breeze needs the official <span className="font-mono text-sc64-text">sc64deployer.exe</span> tool from
              the SummerCart64 project to communicate with your cart. It is missing from the app folder.
            </p>
            {download.error ? <Panel className="mt-3 border-sc64-bad/40 text-xs text-sc64-bad">{download.error}</Panel> : null}
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="primary" onClick={() => void startDownload()}>
                <Download className="h-4 w-4" /> Download sc64deployer {DEPLOYER_VERSION}
              </Button>
              <Button variant="ghost" onClick={() => setDeployerDenied(true)}>
                No thanks — I'll place it myself
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {download.running ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-xl border border-sc64-border bg-sc64-panel p-6 shadow-2xl">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-sc64-accent" />
              <h2 className="text-base font-bold text-sc64-text">Downloading sc64deployer…</h2>
            </div>
            <p className="mt-1 text-xs text-sc64-muted">{download.status}</p>
            <div className="mt-4">
              <ProgressBar
                value={download.progress?.received ?? 0}
                max={download.progress?.total ?? 0}
                label={download.progress && download.progress.total > 0 ? DEPLOYER_VERSION : 'Downloading…'}
                indeterminate={!download.progress || download.progress.total <= 0}
              />
            </div>
            {download.error ? <p className="mt-3 text-sm text-sc64-bad">{download.error}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="relative z-10 flex min-h-0 flex-1">
        <Sidebar active={screen} onNavigate={setScreen} disabled={deployerBlocked} />

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-5">
          <Header status={status} config={config} refreshing={refreshing} onRefresh={() => void refreshStatus()} />
          <main className="flex-1">
            {deployerBlocked ? (
              <div className="flex h-full items-center justify-center">
                <Panel className="w-full max-w-md">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-sc64-bad" />
                    <h2 className="text-base font-bold text-sc64-text">sc64deployer.exe is required</h2>
                  </div>
                  <p className="mt-2 text-sm text-sc64-muted">
                    Navigation is disabled until <span className="font-mono text-sc64-text">sc64deployer.exe</span> is
                    present next to summerbreeze.py. Add it yourself and check again, or download it automatically.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="primary" onClick={() => void refreshStatus()}>
                      <RefreshCw className="h-4 w-4" /> Check again if sc64deployer is present
                    </Button>
                    <Button variant="outline" onClick={() => void startDownload()}>
                      <Download className="h-4 w-4" /> Download it for me
                    </Button>
                  </div>
                </Panel>
              </div>
            ) : (
              screenEl
            )}
          </main>
          <footer className="mt-6 flex items-center justify-between border-t border-sc64-border pt-4">
            <div className="truncate text-[11px] text-sc64-muted">
              roms/ · menu_versions/ · menu_music/ ·{' '}
              {config ? (
                <>
                  deployer <span className={config.deployerPresent ? 'text-sc64-good' : 'text-sc64-bad'}>{config.deployerPresent ? 'found' : 'missing'}</span>
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {isGalleryTheme(theme) ? (
                <Button variant="outline" size="sm" onClick={shuffleBg} title="Shuffle background">
                  <Shuffle className="h-3.5 w-3.5" /> Shuffle
                </Button>
              ) : null}
            </div>
          </footer>
        </div>
      </div>

      {update && !updateDismissed ? (
        <UpdateToast
          update={update}
          onDismiss={() => setUpdateDismissed(true)}
          onInstall={() => void window.api.installUpdate()}
        />
      ) : null}
    </div>
  )
}
