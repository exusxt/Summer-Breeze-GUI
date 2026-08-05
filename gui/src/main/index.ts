// Electron main-process entry point: app lifecycle, the frameless window and
// the IPC surface that forwards renderer calls to the Python bridge.

import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { existsSync } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { PythonBridge } from './bridge'
import { downloadDeployer } from './download'
import { DEPLOYER_EXE } from '../shared/types'
import { initUpdater, checkForUpdates, installUpdate } from './updater'

let mainWindow: BrowserWindow | null = null
let bridge: PythonBridge | null = null

/**
 * Root of the Summer Breeze repo (holds summerbreeze.py). In dev this is the
 * parent of the gui/ folder; in packaged builds the fork's files are copied to
 * resources/summer-breeze-root by electron-builder.
 */
function repoRoot(): string {
  if (process.env['SUMMER_BREEZE_ROOT']) return process.env['SUMMER_BREEZE_ROOT']
  if (app.isPackaged) return join(process.resourcesPath, 'summer-breeze-root')
  return resolve(app.getAppPath(), '..')
}

/**
 * Persistent location for the downloaded deployer. The resources folder of a
 * portable build is re-extracted to a temp dir on every launch, so a binary
 * placed there is lost on exit. userData (%APPDATA%\\Summer Breeze) survives.
 */
function deployerStoreDir(): string {
  return join(app.getPath('userData'), 'deployer')
}

function deployerStorePath(): string {
  return join(deployerStoreDir(), DEPLOYER_EXE)
}

/** Copies the persistent deployer next to summerbreeze.py if one exists. */
async function seedDeployer(): Promise<void> {
  const stored = deployerStorePath()
  if (!existsSync(stored)) return
  // Never overwrite a deployer that is already next to summerbreeze.py (the
  // user may have placed a different version there themselves).
  if (existsSync(join(repoRoot(), DEPLOYER_EXE))) return
  try {
    await copyFile(stored, join(repoRoot(), DEPLOYER_EXE))
  } catch {
    // Resources may be read-only (e.g. installed under Program Files); the
    // bridge falls back to the persistent copy via SUMMER_BREEZE_DEPLOYER.
  }
}

function startBridge(): void {
  const root = repoRoot()
  const python = process.env['SUMMER_BREEZE_PYTHON'] || 'python'
  const bridgePath = join(root, 'gui', 'bridge.py')
  const env = { ...process.env } as NodeJS.ProcessEnv
  if (existsSync(deployerStorePath())) env['SUMMER_BREEZE_DEPLOYER'] = deployerStorePath()
  bridge = new PythonBridge(python, [bridgePath, `--gui-version=${app.getVersion()}`], root, env)
  bridge.start()
  bridge.on('event', (ev) => {
    mainWindow?.webContents.send('sb:event', ev)
  })
  bridge.on('exit', () => {
    console.error('[bridge] Python bridge exited')
  })
}

function registerIpc(): void {
  // Renderer -> bridge passthrough methods.
  const rpc = {
    'sb:config': 'config',
    'sb:status': 'status',
    'sb:listLocalRoms': 'list_local_roms',
    'sb:listCart': 'list_cart',
    'sb:allSdRoms': 'all_sd_roms',
    'sb:compare': 'compare',
    'sb:upload': 'upload',
    'sb:menuList': 'menu_list',
    'sb:menuBackup': 'menu_backup',
    'sb:menuUpload': 'menu_upload',
    'sb:musicStatus': 'music_status',
    'sb:musicList': 'music_list',
    'sb:musicUpload': 'music_upload',
    'sb:musicRemove': 'music_remove',
    'sb:syncRtc': 'sync_rtc',
    'sb:browse': 'browse'
  } as const
  for (const [channel, method] of Object.entries(rpc)) {
    ipcMain.handle(channel, (_e, params) => {
      if (!bridge) throw new Error('Python bridge is not running')
      return bridge.request(method, params ?? {})
    })
  }

  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:reveal', (_e, path: string) => {
    if (path) void shell.showItemInFolder(path)
  })

  // Manual triggers for the auto-updater.
  ipcMain.handle('updates:check', () => {
    checkForUpdates()
  })
  ipcMain.handle('updates:install', () => {
    installUpdate()
  })

  // Downloads sc64deployer.exe from the official release into the persistent
  // userData folder (survives portable re-extraction), then mirrors it next to
  // summerbreeze.py when possible. Progress/status are streamed to the renderer
  // over the sb:downloadProgress / sb:downloadStatus channels.
  ipcMain.handle('sb:downloadDeployer', async () => {
    const root = repoRoot()
    const send = (channel: string, payload: unknown): void => {
      mainWindow?.webContents.send(channel, payload)
    }
    try {
      const exePath = await downloadDeployer(
        deployerStoreDir(),
        (p) => send('sb:downloadProgress', p),
        (s) => send('sb:downloadStatus', s)
      )
      try {
        await copyFile(exePath, join(root, DEPLOYER_EXE))
      } catch {
        // Best-effort mirror; the bridge already uses the persistent copy.
      }
      return { ok: true, message: `Installed ${exePath}` }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  })

  // Frameless-window controls.
  ipcMain.handle('win:minimize', () => mainWindow?.minimize())
  ipcMain.handle('win:toggleMaximize', () => {
    if (!mainWindow) return false
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
    return mainWindow.isMaximized()
  })
  ipcMain.handle('win:isMaximized', () => mainWindow?.isMaximized() ?? false)
  ipcMain.handle('win:close', () => mainWindow?.close())
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 940,
    minHeight: 620,
    title: 'Summer Breeze',
    backgroundColor: '#0b1020',
    frame: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('maximize', () => mainWindow?.webContents.send('win:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('win:maximized', false))
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  registerIpc()
  await seedDeployer()
  startBridge()
  createWindow()
  if (mainWindow) {
    initUpdater(mainWindow)
    // Only auto-check for updates in packaged builds; the delay lets the
    // window settle before the network request goes out.
    setTimeout(() => {
      if (app.isPackaged) checkForUpdates()
    }, 5000)
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  bridge?.dispose()
})
