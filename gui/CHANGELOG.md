# Changelog

All notable changes to Summer Breeze GUI.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
