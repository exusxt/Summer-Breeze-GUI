/**
 * Shared type definitions for Summer Breeze GUI. These describe the JSON-RPC
 * contract between the renderer, the Electron main process and the Python
 * bridge (gui/bridge.py) that drives the untouched summerbreeze.py module.
 */

/** One entry in an SD card directory listing. */
export interface SdEntry {
  name: string
  type: 'dir' | 'file'
  size: string
  path: string
}

/** A local ROM file under the repo's roms/ directory. */
export interface LocalRom {
  name: string
  path: string
  size: number
}

/** Combined device + SD card status, plus firmware info when available. */
export interface DeviceStatus {
  device: 'connected' | 'not-connected'
  firmwareVersion: string | null
  bootMode: string | null
  sdAccessible: boolean
}

/** Result of comparing local ROMs against the cart. */
export interface CompareResult {
  sdAccessible: boolean
  sdRomCount: number
  onCart: LocalRom[]
  missing: LocalRom[]
}

/** Download progress for the sc64deployer.exe installer, pushed from main. */
export interface DownloadProgress {
  received: number
  total: number
}

/** The official SummerCart64 release the app downloads sc64deployer from. */
export const DEPLOYER_VERSION = 'v2.20.2'
export const DEPLOYER_EXE = 'sc64deployer.exe'
export const DEPLOYER_DOWNLOAD_URL = `https://github.com/Polprzewodnikowy/SummerCart64/releases/download/${DEPLOYER_VERSION}/sc64-deployer-windows-${DEPLOYER_VERSION}.zip`

/** Per-file upload progress, emitted by the bridge as a streamed event. */
export interface UploadProgress {
  label: string
  value: number
  max: number
}

/** Outcome of a multi-file upload operation. */
export interface UploadResult {
  ok: boolean
  message: string
  uploaded: number
  total: number
}

/** A menu firmware file in menu_versions/. */
export interface MenuFile {
  name: string
  path: string
  size: number
}

/** An MP3 in menu_music/. */
export interface MusicFile {
  name: string
  path: string
  size: number
}

/** Result of an RTC sync. */
export interface RtcResult {
  ok: boolean
  message: string
}

/** Static app info from the Python side: paths and tooling presence. */
export interface AppConfig {
  repoRoot: string
  romsDir: string
  menuVersionsDir: string
  menuMusicDir: string
  deployerPath: string
  deployerPresent: boolean
  pythonVersion: string
  guiVersion: string
}

/** Streamed events pushed from the bridge to the renderer. */
export type BridgeEvent =
  | { type: 'progress'; data: UploadProgress }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
