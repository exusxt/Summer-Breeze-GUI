// Python environment handling for the main process. The bridge spawns Python,
// so a missing interpreter stops the whole app; detection therefore lives here
// (the renderer cannot ask the bridge about it). When Python is missing or too
// old, the app offers to install it: silent winget/official-installer on
// Windows, the python.org .pkg wizard on macOS, and package-manager guidance on
// Linux.

import { spawn, spawnSync } from 'node:child_process'
import { app } from 'electron'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import { downloadFile } from './download'
import type { PythonStatus } from '../shared/types'

// Prints the version as "major.minor.micro"; used to test each candidate.
const VERSION_SCRIPT = "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"

// Version of the python.org installer used by the Windows/macOS fallback.
const PYTHON_VERSION = '3.12.8'
const MIN_PYTHON = [3, 10]

/** Install flow outcome: relaunch is set when the app must restart to pick up
 * a freshly installed interpreter (its PATH entry only applies to new processes). */
export interface InstallResult {
  ok: boolean
  message: string
  relaunch: boolean
}

let cached: PythonStatus | null = null

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Locates a usable Python 3.10+ interpreter. On Windows the Microsoft Store
 * alias for `python` writes a "Python was not found" banner and exits non-zero,
 * which is treated as "not installed", so a real interpreter is picked up next.
 */
export async function detectPython(force = false): Promise<PythonStatus> {
  if (cached && !force) return cached
  const candidates = pythonCandidates()
  let fallback: PythonStatus | null = null
  for (const cmd of candidates) {
    let status: number | null = null
    let stdout = ''
    try {
      const r = spawnSync(cmd, ['-c', VERSION_SCRIPT], { encoding: 'utf8', timeout: 10000, windowsHide: true })
      status = r.status
      stdout = String(r.stdout ?? '')
    } catch {
      continue
    }
    if (status !== 0) continue
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(stdout.trim())
    if (!m) continue
    const version = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (version[0] > MIN_PYTHON[0] || (version[0] === MIN_PYTHON[0] && version[1] >= MIN_PYTHON[1])) {
      cached = { installed: true, version: `${version[0]}.${version[1]}.${version[2]}`, executable: cmd, reason: null }
      return cached
    }
    if (!fallback) {
      fallback = { installed: false, version: `${version[0]}.${version[1]}.${version[2]}`, executable: cmd, reason: 'too-old' }
    }
  }
  cached = fallback ?? { installed: false, version: null, executable: null, reason: 'missing' }
  return cached
}

/** Interpreters to probe, best first. An explicit env override always wins. */
function pythonCandidates(): string[] {
  const env = process.env['SUMMER_BREEZE_PYTHON']
  if (env) return [env]
  if (process.platform === 'win32') return ['python', 'py', 'python3']
  return ['python3', 'python']
}

/** Runs a command, resolving with true when it exits cleanly (winget case). */
function runAndWait(cmd: string, args: string[], timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const child = spawn(cmd, args, { windowsHide: true, stdio: 'ignore' })
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        child.kill()
        resolve(false)
      }
    }, timeoutMs)
    child.on('error', () => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        resolve(false)
      }
    })
    child.on('exit', (code) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        resolve(code === 0)
      }
    })
  })
}

/** Polls detection until Python appears, up to timeoutMs. */
async function waitForPython(timeoutMs: number): Promise<PythonStatus | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await sleep(2000)
    const st = await detectPython(true)
    if (st.installed) return st
  }
  return null
}

async function installWindows(): Promise<InstallResult> {
  // Prefer winget (installs the right architecture silently and puts Python on
  // PATH for the current user); fall back to the official python.org installer.
  const hasWinget = spawnSync('where', ['winget'], { encoding: 'utf8', windowsHide: true }).status === 0
  if (hasWinget) {
    const ok = await runAndWait(
      'winget',
      ['install', '--id', 'Python.Python.3.12', '--exact', '--silent', '--accept-package-agreements', '--accept-source-agreements'],
      5 * 60 * 1000
    )
    if (ok && (await waitForPython(60 * 1000))) {
      return { ok: true, message: 'Python installed. Restarting Summer Breeze…', relaunch: true }
    }
  }

  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
  const url = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-${arch}.exe`
  const dest = join(app.getPath('temp'), `python-${PYTHON_VERSION}-${arch}.exe`)
  try {
    await downloadFile(url, dest)
  } catch (e) {
    return { ok: false, message: `Could not download the Python installer: ${e instanceof Error ? e.message : String(e)}`, relaunch: false }
  }
  // Per-user install that adds Python to PATH; runs detached because the
  // installer spawns child processes that must not keep the pipe open.
  spawn(dest, ['/quiet', 'InstallAllUsers=0', 'PrependPath=1', 'Include_test=0', 'Include_launcher=1'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  }).unref()
  if (await waitForPython(5 * 60 * 1000)) {
    try {
      await rm(dest, { force: true })
    } catch {
      // ignore
    }
    return { ok: true, message: 'Python installed. Restarting Summer Breeze…', relaunch: true }
  }
  return { ok: false, message: 'The Python installer did not complete. Run it manually, then relaunch Summer Breeze.', relaunch: false }
}

async function installMac(): Promise<InstallResult> {
  const url = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-macos11.pkg`
  const dest = join(app.getPath('temp'), `python-${PYTHON_VERSION}-macos11.pkg`)
  try {
    await downloadFile(url, dest)
  } catch (e) {
    return { ok: false, message: `Could not download the Python installer: ${e instanceof Error ? e.message : String(e)}`, relaunch: false }
  }
  // `open` hands the package to the Installer GUI, which the user completes.
  spawn('open', [dest], { detached: true, stdio: 'ignore' }).unref()
  return {
    ok: true,
    message: 'Opened the Python installer. Complete the wizard, then click “Check again”.',
    relaunch: false
  }
}

async function installLinux(): Promise<InstallResult> {
  return {
    ok: true,
    message:
      'Install Python 3.10+ with your package manager (e.g. `sudo apt install python3`), then click “Check again”.',
    relaunch: false
  }
}

/**
 * Installs a compatible Python for the current platform. Windows attempts a
 * silent install and only signals relaunch once detection succeeds; macOS and
 * Linux hand off to the user and report the expected next step.
 */
export async function installPython(): Promise<InstallResult> {
  if (process.platform === 'win32') return installWindows()
  if (process.platform === 'darwin') return installMac()
  return installLinux()
}
