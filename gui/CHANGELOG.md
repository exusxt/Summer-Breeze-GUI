# Changelog

All notable changes to Summer Breeze GUI.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
