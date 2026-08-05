// Electron main-process entry point: app lifecycle, the frameless window and
// the IPC surface that forwards renderer calls to the Python bridge.

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { PythonBridge } from './bridge'
import { downloadDeployer } from './download'
import { DEPLOYER_EXE, type LocalRom, type RomHeaderInfo, type RomIssue, type RomsAddResult } from '../shared/types'
import { inspectN64File, isN64Ext, romIdentity } from './n64validate'
import { initUpdater, checkForUpdates, installUpdate } from './updater'
import { detectPython, installPython } from './python'

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

/** Where local ROMs live. Packaged builds keep them in userData so they survive
 * portable re-extraction and stay writable under Program Files; development
 * uses the repo's roms/ folder directly (the CLI's default). */
function romsDir(): string {
  if (app.isPackaged) return join(app.getPath('userData'), 'roms')
  return join(repoRoot(), 'roms')
}

/** On the first packaged launch, copy any ROMs shipped in resources into the
 * persistent roms folder so the bridge (pointed at it via the env override)
 * still sees them across restarts. */
async function seedRoms(): Promise<void> {
  if (!app.isPackaged) return
  const dest = romsDir()
  const src = join(repoRoot(), 'roms')
  if (!existsSync(src)) return
  try {
    await mkdir(dest, { recursive: true })
    for (const entry of await readdir(src)) {
      const s = join(src, entry)
      const d = join(dest, entry)
      if ((await stat(s)).isFile() && !existsSync(d)) {
        try {
          await copyFile(s, d)
        } catch {
          // best-effort seed
        }
      }
    }
  } catch {
    // best-effort seed
  }
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

async function startBridge(): Promise<void> {
  const py = await detectPython()
  if (!py.installed) {
    console.warn(
      `[bridge] Python ${py.reason === 'too-old' ? `v${py.version} (need 3.10+)` : 'not found'} — bridge not started`
    )
    return
  }
  const root = repoRoot()
  const python = py.executable ?? process.env['SUMMER_BREEZE_PYTHON'] ?? 'python'
  const bridgePath = join(root, 'gui', 'bridge.py')
  const env = { ...process.env } as NodeJS.ProcessEnv
  if (existsSync(deployerStorePath())) env['SUMMER_BREEZE_DEPLOYER'] = deployerStorePath()
  if (app.isPackaged) env['SUMMER_BREEZE_ROMS_DIR'] = romsDir()
  bridge?.dispose()
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

  // Local-roms listing is enriched with N64 header info by reading the first
  // 0x100 bytes of each file in the main process.
  ipcMain.handle('sb:listLocalRoms', async (): Promise<LocalRom[]> => {
    if (!bridge) throw new Error('Python bridge is not running')
    const raw = (await bridge.request('list_local_roms', {})) as LocalRom[]
    const out: LocalRom[] = []
    for (const r of raw) {
      const v = await inspectN64File(r.path)
      out.push({ ...r, header: v.header, issues: v.issues })
    }
    return out
  })

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

  // Python environment: probe, install, and (re)start the bridge once a
  // compatible interpreter is available.
  ipcMain.handle('app:pythonStatus', () => detectPython())
  ipcMain.handle('app:installPython', async () => {
    const res = await installPython()
    if (res.ok) {
      // Registry-based detection finds a freshly installed interpreter inside
      // the running process, so (re)start the bridge right away — no restart.
      await startBridge()
    }
    return res
  })
  ipcMain.handle('app:retryBridge', async () => {
    // Re-probe from scratch: detection is cached, and a stale "missing" result
    // would otherwise stick around after the user installed Python manually.
    const st = await detectPython(true)
    if (st.installed) await startBridge()
    return st
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
      // The bridge was started without a deployer, so restart it to pick up the
      // freshly downloaded binary via SUMMER_BREEZE_DEPLOYER — no app restart.
      await startBridge()
      return { ok: true, message: `Installed ${exePath}` }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  })

  // Opens a native file picker and copies the selected N64 ROMs into the local
  // roms/ folder (persistent userData in packaged builds). Each file is
  // validated against its N64 header first: non-N64 files are rejected, byte
  // order/size mismatches produce warnings but still copy, and files that
  // duplicate an existing (or just-selected) ROM are skipped. Returns null when
  // the user cancels the dialog.
  const ROM_EXTENSIONS = ['.z64', '.n64', '.v64']
  ipcMain.handle('roms:add', async (): Promise<RomsAddResult | null> => {
    const options: Electron.OpenDialogOptions = {
      title: 'Add ROMs',
      buttonLabel: 'Add',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'N64 ROMs', extensions: ['z64', 'n64', 'v64'] }]
    }
    const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null

    const dest = romsDir()
    try {
      await mkdir(dest, { recursive: true })
    } catch {
      return { added: [], skipped: [], warnings: [], errors: [`Could not create ${dest}`] }
    }

    // Identity (game code + header CRCs) of every ROM already in the folder, so
    // renamed/re-encoded copies are caught as duplicates.
    const existingIdentity = new Map<string, string>()
    for (const entry of await readdir(dest)) {
      const p = join(dest, entry)
      if (!isN64Ext(p)) continue
      try {
        const v = await inspectN64File(p)
        if (v.header) existingIdentity.set(romIdentity(v.header), entry)
      } catch {
        // skip unreadable files
      }
    }

    const added: string[] = []
    const skipped: string[] = []
    const warnings: string[] = []
    const errors: string[] = []
    const batchIdentity = new Map<string, string>()
    for (const src of result.filePaths) {
      const name = basename(src)
      if (!ROM_EXTENSIONS.includes(extname(src).toLowerCase())) {
        skipped.push(`${name} (not an N64 ROM)`)
        continue
      }
      let v: { header: RomHeaderInfo | null; issues: RomIssue[] }
      try {
        v = await inspectN64File(src)
      } catch (e) {
        errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`)
        continue
      }
      if (!v.header) {
        errors.push(`${name}: not an N64 ROM`)
        continue
      }
      for (const issue of v.issues) {
        if (issue.code === 'ext-mismatch') warnings.push(`${name}: byte order doesn't match its extension`)
        if (issue.code === 'bad-size') warnings.push(`${name}: non-standard size`)
      }
      const identity = romIdentity(v.header)
      const existing = existingIdentity.get(identity) ?? batchIdentity.get(identity)
      if (existing) {
        skipped.push(`${name} (already present: ${existing})`)
        continue
      }
      const target = join(dest, name)
      if (existsSync(target)) {
        skipped.push(`${name} (already present)`)
        continue
      }
      try {
        await copyFile(src, target)
        added.push(name)
        batchIdentity.set(identity, name)
      } catch (e) {
        errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return { added, skipped, warnings, errors }
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
  await seedRoms()
  await startBridge()
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
