// SC64 menu downloads: resolves the latest sc64menu.n64 firmware from the
// official N64FlashcartMenu repo or TheLeggett's custom fork and downloads it
// into the persistent menu_versions/ folder. Both repos publish a ready-to-run
// sc64menu.n64 asset per release; the custom fork adds background-music support.
//
// The GitHub API is unauthenticated and rate-limited, so resolved releases are
// cached in memory for a few minutes (checks are user-triggered and infrequent).

import * as https from 'node:https'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { DownloadProgress, MenuReleaseInfo, MenuSource } from '../shared/types'
import { downloadFile } from './download'
import { inspectN64File } from './n64validate'

const USER_AGENT = 'summer-breeze-gui'
const API_ROOT = 'https://api.github.com/repos'
const CACHE_TTL_MS = 5 * 60 * 1000

/** The two menu sources and their GitHub repos. */
export const MENU_SOURCES: Array<{ repo: MenuSource; ownerRepo: string }> = [
  { repo: 'official', ownerRepo: 'Polprzewodnikowy/N64FlashcartMenu' },
  { repo: 'custom', ownerRepo: 'TheLeggett/N64FlashcartMenu' }
]

const LABELS: Record<MenuSource, { label: string; repoUrl: string }> = {
  official: {
    label: 'N64FlashcartMenu (official)',
    repoUrl: 'https://github.com/Polprzewodnikowy/N64FlashcartMenu'
  },
  custom: {
    label: 'TheLeggett custom build',
    repoUrl: 'https://github.com/TheLeggett/N64FlashcartMenu'
  }
}

interface GithubRelease {
  tag_name: string
  published_at: string
  assets: Array<{ name: string; size: number; browser_download_url: string }>
}

const cache = new Map<string, { expiresAt: number; release: GithubRelease }>()

/** Fetches the latest release of a repo via the GitHub API, with a short cache. */
export function fetchLatestRelease(ownerRepo: string): Promise<GithubRelease> {
  const hit = cache.get(ownerRepo)
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.release)
  return new Promise((resolve, reject) => {
    const req = https.get(`${API_ROOT}/${ownerRepo}/releases/latest`, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }, (res) => {
      let body = ''
      res.on('data', (c: Buffer) => (body += c.toString()))
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`GitHub API ${res.statusCode} for ${ownerRepo}`))
          return
        }
        try {
          const release = JSON.parse(body) as GithubRelease
          cache.set(ownerRepo, { expiresAt: Date.now() + CACHE_TTL_MS, release })
          resolve(release)
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => req.destroy(new Error('Request timed out')))
  })
}

/** Local filename for a downloaded menu, unique per source and version so
 * official and custom builds can sit side by side. */
export function menuFileName(repo: MenuSource, tag: string): string {
  const safeTag = tag.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '-')
  return `sc64menu_${repo}_${safeTag}.n64`
}

/** Resolution info for one source; never throws, failures surface in `error`. */
export async function menuReleaseInfo(repo: MenuSource, menuVersionsDir: string): Promise<MenuReleaseInfo> {
  const { label, repoUrl } = LABELS[repo]
  try {
    const rel = await fetchLatestRelease(MENU_SOURCES.find((s) => s.repo === repo)!.ownerRepo)
    const asset = rel.assets.find((a) => a.name.toLowerCase() === 'sc64menu.n64')
    if (!asset) {
      return { repo, label, repoUrl, tag: rel.tag_name, publishedAt: rel.published_at, size: null, present: false, error: 'No sc64menu.n64 asset in the latest release' }
    }
    return {
      repo,
      label,
      repoUrl,
      tag: rel.tag_name,
      publishedAt: rel.published_at,
      size: asset.size,
      present: existsSync(join(menuVersionsDir, menuFileName(repo, rel.tag_name))),
      error: null
    }
  } catch (e) {
    return { repo, label, repoUrl, tag: null, publishedAt: null, size: null, present: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Downloads the latest sc64menu.n64 for a source into menuVersionsDir. Skips
 * (successfully) when the file is already present. Resolves with the local
 * file name and release tag.
 */
export async function downloadMenu(
  repo: MenuSource,
  menuVersionsDir: string,
  onProgress: (p: DownloadProgress) => void
): Promise<{ fileName: string; tag: string }> {
  const { ownerRepo } = MENU_SOURCES.find((s) => s.repo === repo)!
  const rel = await fetchLatestRelease(ownerRepo)
  const asset = rel.assets.find((a) => a.name.toLowerCase() === 'sc64menu.n64')
  if (!asset) throw new Error('No sc64menu.n64 asset in the latest release')

  const fileName = menuFileName(repo, rel.tag_name)
  const dest = join(menuVersionsDir, fileName)
  if (existsSync(dest)) return { fileName, tag: rel.tag_name }

  await downloadFile(asset.browser_download_url, dest, { onProgress })

  // Sanity-check the downloaded file really is an N64 menu.
  const v = await inspectN64File(dest)
  if (!v.header) throw new Error('Downloaded file is not a valid N64 menu')

  return { fileName, tag: rel.tag_name }
}
