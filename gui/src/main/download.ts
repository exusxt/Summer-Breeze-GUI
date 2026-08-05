// Downloads and installs the official sc64deployer.exe tool from the latest
// SummerCart64 GitHub release, so the GUI can talk to the cart even when the
// deployer binary was not shipped next to summerbreeze.py. The zip is streamed
// to a temp file (progress events pushed to the renderer), extracted with
// extract-zip, and sc64deployer.exe is copied into the caller-provided destDir.
// For portable builds the main process passes a persistent userData folder so
// the file survives the per-launch re-extraction of the resources directory.

import { net } from 'electron'
import { createWriteStream } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import extract from 'extract-zip'
import type { DownloadProgress } from '../shared/types'
import { DEPLOYER_DOWNLOAD_URL, DEPLOYER_EXE } from '../shared/types'

/** Recursively finds the first file whose name matches; returns '' if absent. */
async function findFile(dir: string, name: string): Promise<string> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.name.toLowerCase() === name.toLowerCase()) return full
    if (entry.isDirectory()) {
      const found = await findFile(full, name)
      if (found) return found
    }
  }
  return ''
}

/**
 * Downloads the deployer archive and installs sc64deployer.exe into destDir.
 * Resolves with the installed exe path. onProgress reports byte counts while
 * the zip downloads; onStatus reports human-readable phase changes.
 */
export async function downloadDeployer(
  destDir: string,
  onProgress: (p: DownloadProgress) => void,
  onStatus: (message: string) => void
): Promise<string> {
  const tmpBase = await mkdtemp(join(tmpdir(), 'summer-breeze-deployer-'))
  const zipPath = join(tmpBase, 'deployer.zip')
  const extractDir = join(tmpBase, 'extracted')
  try {
    onStatus('Downloading sc64deployer…')

    const zipFile = createWriteStream(zipPath)
    const total = await new Promise<number>((resolve, reject) => {
      const request = net.request({ method: 'GET', url: DEPLOYER_DOWNLOAD_URL, redirect: 'follow' })
      let received = 0
      zipFile.on('error', (err) => reject(err))
      request.on('response', (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with HTTP ${res.statusCode}`))
          return
        }
        const length = Number(res.headers['content-length'] ?? 0) || 0
        res.on('data', (chunk: Buffer) => {
          received += chunk.length
          zipFile.write(chunk)
          onProgress({ received, total: length })
        })
        res.on('end', () => zipFile.end(() => resolve(length)))
        res.on('error', (err) => reject(new Error(`Download failed: ${err.message}`)))
      })
      request.on('error', (err) => reject(new Error(`Download failed: ${err.message}`)))
      request.end()
    })

    if (total > 0) {
      onStatus(`Downloaded ${total} bytes — extracting…`)
    } else {
      onStatus('Extracting sc64deployer.exe…')
    }
    await extract(zipPath, { dir: extractDir })

    const exe = await findFile(extractDir, DEPLOYER_EXE)
    if (!exe) throw new Error('sc64deployer.exe was not found in the downloaded archive')

    await mkdir(destDir, { recursive: true })
    const dest = join(destDir, DEPLOYER_EXE)
    await copyFile(exe, dest)
    onStatus('sc64deployer installed')
    return dest
  } finally {
    await rm(tmpBase, { recursive: true, force: true })
  }
}
