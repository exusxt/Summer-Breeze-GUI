// GitHub Releases lookup for the main process, used by the portable auto-updater.
// Resolves the app's own latest release through the github.com web endpoints,
// which (unlike the API) are not subject to an unauthenticated rate limit. The
// installed-build updater (NSIS/mac/linux) reads the latest.yml metadata files
// published by electron-builder instead and needs no API access at all.

import * as https from 'node:https'

// GitHub rejects unauthenticated requests without a User-Agent header.
const USER_AGENT = 'summer-breeze-gui'
const GITHUB_WEB = 'https://github.com'

const APP_REPO = 'exusxt/Summer-Breeze-GUI'

/** One asset of the app's own latest release, used by the portable updater. */
export interface ReleaseAsset {
  name: string
  size: number
  browser_download_url: string
}

/** App-version plus the release assets available for download. */
export interface AppUpdateInfo {
  version: string
  assets: ReleaseAsset[]
}

// Follows redirects and returns the final URL of a successful HEAD request, or
// null when the target is not reachable.
function webHeadRedirect(url: string, redirectsLeft = 5): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: 'HEAD', headers: { 'User-Agent': USER_AGENT } },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          redirectsLeft > 0
        ) {
          res.resume()
          const next = new URL(res.headers.location, url).toString()
          webHeadRedirect(next, redirectsLeft - 1).then(resolve, reject)
          return
        }
        res.resume()
        resolve(res.statusCode === 200 ? url : null)
      }
    )
    req.on('error', reject)
    req.setTimeout(30000, () => req.destroy(new Error('Request timed out')))
    req.end()
  })
}

// Resolves the version tag behind a github.com /releases/latest redirect (e.g.
// .../tag/v1.2.3).
async function webLatestTag(ownerRepo: string): Promise<string | null> {
  const [owner, repo] = ownerRepo.split('/')
  const finalUrl = await webHeadRedirect(`${GITHUB_WEB}/${owner}/${repo}/releases/latest`)
  if (!finalUrl) return null
  const match = finalUrl.match(/\/releases\/tag\/([^/?#]+)$/)
  return match ? match[1] : null
}

/**
 * Resolves the app's own latest release through the github.com web endpoints
 * (no API rate limit): the latest tag comes from the /releases/latest redirect,
 * and the portable download URL is built from the known asset name. electron-
 * builder publishes the portable exe as Summer-Breeze-GUI-<version>.exe for
 * this app (see the portable.artifactName in electron-builder.yml).
 */
export async function getAppLatestRelease(): Promise<AppUpdateInfo> {
  const tag = await webLatestTag(APP_REPO)
  if (!tag) throw new Error('Unable to check for updates')
  const version = tag.replace(/^v/i, '')
  const name = `Summer-Breeze-GUI-${version}.exe`
  const [owner, repo] = APP_REPO.split('/')
  const downloadUrl = `${GITHUB_WEB}/${owner}/${repo}/releases/latest/download/${name}`
  return {
    version,
    assets: [{ name, size: 0, browser_download_url: downloadUrl }]
  }
}
