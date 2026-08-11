# Changelog

All notable changes to Summer Breeze GUI.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.5.3] - 2026-08-11

### Changed

- Windows portable builds are now published as separate executables per architecture — `Summer-Breeze-GUI-<version>-x64.exe` and `Summer-Breeze-GUI-<version>-arm64.exe` (each about half the size of the previous merged portable); the NSIS installer stays a single universal x64 + arm64 file
- The portable auto-updater now downloads the build matching the running architecture

[Compare v0.5.2...v0.5.3](https://github.com/exusxt/Summer-Breeze-GUI/compare/v0.5.2...v0.5.3)

## [v0.5.2] - 2026-08-11

### Added

- Deploy to Cart screen: flash any local ROM into the cart with an optional save file and save-type override; with "Back up first" (on by default) the cart's current save is dumped to `saves/auto/` before flashing, so the previous game's progress is never lost
- Save Manager screen: dump the cart's save (EEPROM/SRAM/FlashRAM) to disk with per-game history, copy any backup to the SD card's `/saves` save-filer folder or pull a save back from it, and restore a backup by sending it to the Deploy screen
- Console screen: live bridge log with a persisted history across restarts, plus copy, export and "open logs folder" actions
- The Status screen now shows the full `sc64deployer info` dump: firmware, RTC, save type, CIC seed, TV type, ROM write/shadow/extended, 64DD and SD card status
- Windows installer and portable builds are now universal x64 + arm64 (single artifact, no install arch selection needed)

### Fixed

- Streamed bridge events (deploy/upload progress and log lines) now reach the UI: the event `type` was being dropped when forwarded, so progress bars and operation consoles were silent
- The Console screen's live output now works for all operations, not just uploads

### Changed

- The Deploy to Cart screen replaces the previous two-step Upload flow for the common "flash a ROM now" case; Upload/Compare still handle explicit save transfer

[Compare v0.5.1...v0.5.2](https://github.com/exusxt/Summer-Breeze-GUI/compare/v0.5.1...v0.5.2)

## [v0.5.1] - 2026-08-06

### Changed

- The app is now branded "Summer Breeze GUI": the title bar, header and window title use the new name, and the packaged executables are renamed (`SummerBreezeGUI.exe`, `Summer-Breeze-GUI-Setup-<version>.exe` installer and `Summer-Breeze-GUI-<version>.exe` portable); the portable auto-updater now looks for the new asset name
- Existing user data is preserved: the app keeps using the same `%APPDATA%\Summer Breeze` folder, so local ROMs, downloaded menu builds, music and the deployer stay in place after the rename

[Compare v0.5.0...v0.5.1](https://github.com/exusxt/Summer-Breeze-GUI/compare/v0.5.0...v0.5.1)

## [v0.5.0] - 2026-08-06

### Added

- Download the SC64 menu from the Update SC64 Menu screen: pick the official N64FlashcartMenu release or TheLeggett's custom build (which adds background-music support), and the latest `sc64menu.n64` is fetched from GitHub into the app's persistent menu_versions/ folder
- The downloaded menu is validated as a real N64 ROM and then shows up in the regular version list, ready for the existing backup-and-upload flow; a per-source "already downloaded" marker avoids re-downloading the same build

[Compare v0.4.1...v0.5.0](https://github.com/exusxt/Summer-Breeze-GUI/compare/v0.4.1...v0.5.0)

## [v0.4.1] - 2026-08-06

### Fixed

- The Update SC64 Menu screen no longer crashes on installed builds: the menu_versions folder (and the menu_music folder for background music) now lives in the app's writable userData folder instead of the read-only Program Files resources, so listing menu files, backing up from the cart and uploading all work without an "Access denied" error

[Compare v0.4.0...v0.4.1](https://github.com/exusxt/Summer-Breeze-GUI/compare/v0.4.0...v0.4.1)

## [v0.4.0] - 2026-08-06

### Added

- "Add ROMs" on the Local ROMs screen: pick any number of `.z64`, `.n64` or `.v64` files and they are copied into the app's persistent roms/ folder
- N64 ROM verification when adding: files are checked against their header (magic word, byte order, title, game code and region); non-N64 files are rejected and byte-order/extension or size mismatches are reported as warnings while the copy still happens
- Duplicate detection by game identity (game code + header CRCs), so a renamed or byte-ordered copy of a ROM you already have is skipped instead of imported again
- The Local ROMs list now shows each ROM's title, game code, byte order and region, with a "not an N64 ROM" or "check" badge when validation finds a problem

### Infra

- CI actions upgraded to Node 24 (`actions/checkout@v5`, `actions/upload-artifact@v6`, `actions/setup-python@v6`) and the release workflow's artifact upload paths fixed

[Compare v0.3.1...v0.4.0](https://github.com/exusxt/Summer-Breeze-GUI/compare/v0.3.1...v0.4.0)

## [v0.3.1] - 2026-08-05

### Fixed

- After the one-click Python install completes, the app detects the interpreter and starts working immediately instead of requiring a restart
- After sc64deployer is downloaded, the app picks it up immediately instead of requiring a restart
- The Python prompt's "Check again" re-probes the system instead of returning a stale "missing" result

[Compare v0.3.0...v0.3.1](https://github.com/exusxt/Summer-Breeze-GUI/compare/v0.3.0...v0.3.1)

## [v0.3.0] - 2026-08-05

### Added

- The app now checks for a compatible Python installation (3.10+) on startup and blocks with a clear prompt if it is missing
- One-click Python install from the prompt: silent winget/installer on Windows, the python.org wizard on macOS, and package-manager guidance on Linux
- The bridge restarts automatically once Python is available (via the prompt's "Check again")

### Infra

- README rewritten to describe the GUI, supported platforms and auto-update behavior, and credits the original Summer Breeze developer

## [v0.2.0] - 2026-08-05

### Added

- macOS builds (dmg + zip, x64 and arm64) and Linux builds (AppImage, deb, rpm, pacman, x64 and arm64) published from the release workflow
- Automatic update notifications: the app checks for new versions on startup and through a title-bar button, downloads updates in the background and lets you install on demand
- Windows portable builds self-update by downloading the newer portable exe and swapping it in on restart
- Installed builds update through electron-updater against the same GitHub release

### Infra

- Release workflow now builds on Ubuntu, macOS and Windows in parallel and publishes each platform's artifacts to the same GitHub release

## [v0.1.6] - 2026-08-05

### Added

- Electron GUI for the Summer Breeze CLI, with screens for Status, Local ROMs, Cart Contents, Compare, Upload, Quick Upload, SC64 Menu, Background Music, RTC Clock and SD Card browsing
- One-click download of the official `sc64deployer.exe`, installed persistently so portable builds keep it across restarts
- Gallery glass theme family with 9 photo backgrounds and 14 selectable themes
- Connectivity guards that warn and disable actions while the device or SD card is unreachable

### Changed

- New app icon and logo across the title bar, header and Windows executables
- Fresh gallery background image set

### Infra

- GitHub Actions workflow that builds and publishes the Windows app on release tags
- Python bridge now reads stdin line-by-line so requests are handled while the GUI keeps the pipe open
