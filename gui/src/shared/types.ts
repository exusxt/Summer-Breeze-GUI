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
  /** Parsed N64 header; null when the file is not a recognized N64 ROM. Only
   * set by the main-process local-roms listing, not by the Python bridge. */
  header?: RomHeaderInfo | null
  /** Validation issues attached to the file by the local-roms listing. */
  issues?: RomIssue[]
}

/** N64 ROM byte order: .z64 is big-endian, .v64 is 16-bit byte-swapped and .n64 is little-endian (word-reversed). */
export type RomByteOrder = 'z64' | 'v64' | 'n64'

/** Logical region derived from the N64 header's destination-code byte (0x3E). */
export type RomRegion = 'usa' | 'japan' | 'pal' | 'korea' | 'china' | 'brazil' | 'other' | 'unknown'

/** Display labels for the N64 region codes. */
export const ROM_REGION_LABELS: Record<RomRegion, string> = {
  usa: 'USA',
  japan: 'Japan',
  pal: 'PAL',
  korea: 'Korea',
  china: 'China',
  brazil: 'Brazil',
  other: 'Other',
  unknown: 'Unknown'
}

/** Parsed fields of a valid N64 ROM header. */
export interface RomHeaderInfo {
  byteOrder: RomByteOrder
  title: string
  gameCode: string
  region: RomRegion
  version: string
  crc1: string
  crc2: string
}

/** A validation finding on a ROM file. */
export interface RomIssue {
  code: 'not-n64' | 'ext-mismatch' | 'bad-size'
  severity: 'warn' | 'error'
}

/** Outcome of copying selected ROM files into the local roms/ folder. */
export interface RomsAddResult {
  added: string[]
  skipped: string[]
  warnings: string[]
  errors: string[]
}

/** Extra fields parsed from `sc64deployer info` (absent when no cart is
 * connected). Keys map 1:1 to the CLI's output lines. */
export interface CartInfo {
  rtcDateTime: string | null
  saveType: string | null
  cicSeed: string | null
  tvType: string | null
  bootloaderSwitch: string | null
  romWrite: string | null
  romShadow: string | null
  romExtended: string | null
  ddMode: string | null
  ddSdMode: string | null
  ddDriveType: string | null
  ddDiskState: string | null
  buttonMode: string | null
  sdCardStatus: string | null
}

/** Combined device + SD card status, plus firmware info when available. */
export interface DeviceStatus {
  device: 'connected' | 'not-connected'
  firmwareVersion: string | null
  bootMode: string | null
  sdAccessible: boolean
  info: CartInfo | null
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

/** Which menu download source the user picked: the official N64FlashcartMenu
 * release or TheLeggett's custom fork (adds background-music support). */
export type MenuSource = 'official' | 'custom'

/** A downloadable SC64 menu build for one source, as resolved by main. */
export interface MenuReleaseInfo {
  repo: MenuSource
  label: string
  repoUrl: string
  /** Release tag (null when the lookup failed). */
  tag: string | null
  publishedAt: string | null
  /** Size in bytes of the sc64menu.n64 asset. */
  size: number | null
  /** Whether the matching file already exists in menu_versions/. */
  present: boolean
  /** Lookup error, when the GitHub API call failed for this source. */
  error: string | null
}

/** Result of a menu download request. */
export interface MenuDownloadResult {
  ok: boolean
  message: string
  fileName?: string
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

/** One cart-save backup stored under the app's saves/ folder. */
export interface SaveBackup {
  id: string
  game: string
  fileName: string
  path: string
  size: number
  date: string
  saveType: string | null
  source: 'manual' | 'auto' | 'sd'
}

/** Outcome of a save dump/copy operation. */
export interface SaveOpResult {
  ok: boolean
  message: string
  path?: string
}

/** Outcome of a deploy-to-cart operation. */
export interface DeployResult {
  ok: boolean
  message: string
  backupPath?: string
}

/** One persisted bridge-log line (used by the Console screen history). */
export interface LogEntry {
  time: string | null
  level: 'info' | 'warn' | 'error'
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

/** Minimum Python version the bridge requires (checked against sys.version_info). */
export const MIN_PYTHON = '3.10'

/** Result of the main-process Python environment probe. A missing interpreter
 * keeps the bridge itself from starting, so this is checked from main. */
export interface PythonStatus {
  installed: boolean
  version: string | null
  executable: string | null
  reason: 'missing' | 'too-old' | null
}

/** Streamed events pushed from the bridge to the renderer. */
export type BridgeEvent =
  | { type: 'progress'; data: UploadProgress }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }

/** Live state of the auto-update flow, pushed from main over the sb:update channel. */
export interface UpdateState {
  state: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
}
