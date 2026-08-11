#!/usr/bin/env python3
"""
Summer Breeze GUI bridge.

A thin JSON-RPC-over-stdio server that lets the Electron GUI drive the
unmodified summerbreeze.py CLI as a library. The fork is never edited: this
module imports it, calls its non-interactive functions directly and streams
sc64deployer output (for live progress) itself.

Protocol (newline-delimited JSON):
  request:  {"id": <int>, "method": "<name>", "params": {...}}
  response: {"id": <int>, "result": ...} | {"id": <int>, "error": "..."}
  event:    {"event": "progress"|"log", "data": {...}}   (async, stdout)

All informational prints from summerbreeze are redirected to stderr during a
call so stdout stays reserved for protocol frames.
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

GUI_VERSION = "0.1.0"

# --- Locate and import the untouched fork --------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
try:
    import summerbreeze  # noqa: E402
except ImportError:
    REPO_ROOT = Path(__file__).resolve().parent
    sys.path.insert(0, str(REPO_ROOT))
    import summerbreeze  # noqa: E402

# The Electron host may keep a persistent deployer copy (e.g. in the app's
# userData dir for portable builds, whose resources folder is re-extracted to a
# temp dir on every launch). Prefer that copy when the script-adjacent one is
# absent, so a downloaded deployer survives app restarts.
_DEPLOYER_OVERRIDE = os.environ.get("SUMMER_BREEZE_DEPLOYER")
if _DEPLOYER_OVERRIDE:
    _candidate = Path(_DEPLOYER_OVERRIDE)
    if _candidate.exists() and not Path(summerbreeze.SC64_DEPLOYER).exists():
        summerbreeze.SC64_DEPLOYER = _candidate

# Same idea for ROMs: packaged builds keep them in a persistent userData folder
# because resources may be read-only (Program Files) or re-extracted on every
# launch (portable). The untouched CLI default is SCRIPT_DIR/roms.
_ROM_DIR_OVERRIDE = os.environ.get("SUMMER_BREEZE_ROMS_DIR")
if _ROM_DIR_OVERRIDE:
    summerbreeze.LOCAL_ROMS_DIR = Path(_ROM_DIR_OVERRIDE)

# And for the menu firmware / background-music folders: the CLI defaults to
# SCRIPT_DIR/menu_versions and SCRIPT_DIR/menu_music, which are read-only (or
# re-extracted) in packaged builds. Point both at persistent userData folders so
# listing, backing up from the cart and uploading all work under Program Files.
_MENU_VERSIONS_OVERRIDE = os.environ.get("SUMMER_BREEZE_MENU_VERSIONS_DIR")
if _MENU_VERSIONS_OVERRIDE:
    summerbreeze.MENU_VERSIONS_DIR = Path(_MENU_VERSIONS_OVERRIDE)

_MENU_MUSIC_OVERRIDE = os.environ.get("SUMMER_BREEZE_MENU_MUSIC_DIR")
if _MENU_MUSIC_OVERRIDE:
    summerbreeze.MENU_MUSIC_DIR = Path(_MENU_MUSIC_OVERRIDE)

REAL_STDOUT = sys.stdout


# --- Protocol helpers ------------------------------------------------------
def send(obj):
    REAL_STDOUT.write(json.dumps(obj) + "\n")
    REAL_STDOUT.flush()


def send_event(event_type, data):
    send({"event": event_type, "data": data})


def handle_request(req):
    """Run a single RPC call, swallowing summerbreeze's prints to stderr."""
    method = req.get("method")
    params = req.get("params") or {}
    req_id = req.get("id")
    old = sys.stdout
    sys.stdout = sys.stderr
    try:
        result = dispatcher(method, params)
    except Exception as exc:  # noqa: BLE001 - report any failure to the GUI
        sys.stdout = old
        send({"id": req_id, "error": f"{type(exc).__name__}: {exc}"})
        return
    finally:
        sys.stdout = old
    send({"id": req_id, "result": result})


def stream_deployer(args, label):
    """Run sc64deployer, streaming lines to the GUI as log/progress events.

    Progress bars that overwrite via \\r and multi-line output are both handled
    by splitting the byte stream on \\r and \\n. Returns the exit code.
    """
    cmd = [str(summerbreeze.SC64_DEPLOYER)] + args
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=str(summerbreeze.SCRIPT_DIR),
        )
    except FileNotFoundError:
        send_event(
            "log",
            {"level": "error", "message": f"sc64deployer not found at {summerbreeze.SC64_DEPLOYER}"},
        )
        return -1

    buf = b""
    while True:
        chunk = proc.stdout.read(4096)
        if not chunk:
            break
        buf += chunk
        while True:
            cr = buf.find(b"\r")
            lf = buf.find(b"\n")
            if cr == -1 and lf == -1:
                break
            if cr == -1:
                idx = lf
            elif lf == -1:
                idx = cr
            else:
                idx = min(cr, lf)
            line = buf[:idx]
            buf = buf[idx + 1 :]
            try:
                text = line.decode("utf-8", "replace").strip()
            except Exception:  # noqa: BLE001
                text = ""
            if not text:
                continue
            send_event("log", {"level": "info", "message": text})
            match = re.search(r"(\d{1,3})\s*%", text)
            if match:
                pct = min(100, max(0, int(match.group(1))))
                send_event("progress", {"label": label, "value": pct, "max": 100})
    code = proc.wait()
    return code


# --- RPC methods -----------------------------------------------------------
# Field names from `sc64deployer info`, mapped to the CamelCase keys the GUI
# displays. Lines whose label is not listed here are ignored, so newer deployer
# versions that add fields stay compatible.
_STATUS_FIELDS = {
    "Firmware version": "firmwareVersion",
    "RTC datetime": "rtcDateTime",
    "Boot mode": "bootMode",
    "Save type": "saveType",
    "CIC seed": "cicSeed",
    "TV type": "tvType",
    "Bootloader switch": "bootloaderSwitch",
    "ROM write": "romWrite",
    "ROM shadow": "romShadow",
    "ROM extended": "romExtended",
    "64DD mode": "ddMode",
    "64DD SD card mode": "ddSdMode",
    "64DD drive type": "ddDriveType",
    "64DD disk state": "ddDiskState",
    "Button mode": "buttonMode",
    "SD card": "sdCardStatus",
}


def _parse_info(out: str) -> dict:
    """Parse `sc64deployer info` lines into a dict of known, stripped fields."""
    info = {}
    for line in out.split("\n"):
        stripped = line.strip()
        if not stripped or ":" not in stripped:
            continue
        label, _, value = stripped.partition(":")
        key = _STATUS_FIELDS.get(label.strip())
        if key:
            info[key] = value.strip()
    return info


def cmd_config(_params):
    deployer = Path(summerbreeze.SC64_DEPLOYER)
    return {
        "repoRoot": str(summerbreeze.SCRIPT_DIR),
        "romsDir": str(summerbreeze.LOCAL_ROMS_DIR),
        "menuVersionsDir": str(summerbreeze.MENU_VERSIONS_DIR),
        "menuMusicDir": str(summerbreeze.MENU_MUSIC_DIR),
        "deployerPath": str(deployer),
        "deployerPresent": deployer.exists(),
        "pythonVersion": sys.version.split()[0],
        "guiVersion": GUI_VERSION,
    }


def cmd_status(_params):
    connected = summerbreeze.check_device_connected()
    info = {}
    sd = False
    if connected:
        code, out, _err = summerbreeze.run_sc64_command(["info"])
        if code == 0:
            info = _parse_info(out)
        sd = summerbreeze.is_sd_card_accessible()
    return {
        "device": "connected" if connected else "not-connected",
        "firmwareVersion": info.get("firmwareVersion") or None,
        "bootMode": info.get("bootMode") or None,
        "sdAccessible": sd,
        "info": info or None,
    }


def _local_rom_dict(path: Path):
    return {"name": path.name, "path": str(path), "size": path.stat().st_size}


def cmd_list_local_roms(_params):
    return [_local_rom_dict(r) for r in summerbreeze.list_local_roms()]


def cmd_list_cart(params):
    path = params.get("path") or None
    if path in ("/", ""):
        path = None
    return summerbreeze.list_sd_card_files(path)


def cmd_all_sd_roms(params):
    path = params.get("path") or None
    if path in ("/", ""):
        path = None
    return summerbreeze.get_all_sd_roms(path)


def cmd_compare(_params):
    local = summerbreeze.list_local_roms()
    sd = summerbreeze.is_sd_card_accessible()
    sd_roms = summerbreeze.get_all_sd_roms() if sd else []
    names = {summerbreeze.normalize_rom_name(r["name"]) for r in sd_roms}
    missing = []
    on_cart = []
    for rom in local:
        target = on_cart if summerbreeze.normalize_rom_name(rom.name) in names else missing
        target.append(_local_rom_dict(rom))
    return {
        "sdAccessible": sd,
        "sdRomCount": len(sd_roms),
        "onCart": on_cart,
        "missing": missing,
    }


def cmd_upload(params):
    paths = params.get("paths") or []
    sd_path = params.get("sd_path") or "/"
    uploaded = 0
    for p in paths:
        local = Path(p)
        dest = f"{sd_path.rstrip('/')}/{local.name}"
        if stream_deployer(["sd", "upload", str(local), dest], local.name) == 0:
            uploaded += 1
    total = len(paths)
    return {
        "ok": total > 0 and uploaded == total,
        "message": f"Uploaded {uploaded}/{total} ROM(s).",
        "uploaded": uploaded,
        "total": total,
    }


def cmd_menu_list(_params):
    return [{"name": f.name, "path": str(f), "size": f.stat().st_size} for f in summerbreeze.list_local_menu_versions()]


def cmd_menu_backup(_params):
    ok = summerbreeze.backup_menu_from_cart()
    return {"ok": ok, "message": "Backup complete!" if ok else "Backup failed."}


def cmd_menu_upload(params):
    local = Path(params["path"])
    ok = summerbreeze.upload_menu_to_cart(local)
    return {"ok": ok, "message": "Menu update complete!" if ok else "Menu upload failed."}


def cmd_music_status(_params):
    return {"hasMusic": summerbreeze.check_menu_music_exists()}


def cmd_music_list(_params):
    return [{"name": f.name, "path": str(f), "size": f.stat().st_size} for f in summerbreeze.list_local_music()]


def cmd_music_upload(params):
    local = Path(params["path"])
    code = stream_deployer(["sd", "upload", str(local), summerbreeze.SD_MENU_MUSIC_PATH], local.name)
    return {"ok": code == 0, "message": "Background music set!" if code == 0 else "Failed to set background music."}


def cmd_music_remove(_params):
    ok = summerbreeze.delete_menu_music()
    return {"ok": ok, "message": "Background music removed!" if ok else "Failed to remove background music."}


def cmd_sync_rtc(_params):
    code, _out, err = summerbreeze.run_sc64_command(["set", "rtc"])
    if code == 0:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return {"ok": True, "message": f"RTC synchronized to: {now}"}
    return {"ok": False, "message": (err or "").strip() or "Failed to sync RTC clock."}


def cmd_browse(params):
    path = params.get("path") or None
    if path in ("/", ""):
        path = None
    return summerbreeze.list_sd_card_files(path)


def cmd_save_read(params):
    """Dump the cart's current save data to a local file (`download save`)."""
    path = Path(params["path"])
    path.parent.mkdir(parents=True, exist_ok=True)
    code, out, err = summerbreeze.run_sc64_command(["download", "save", str(path)])
    if code == 0:
        return {"ok": True, "message": f"Save dumped to {path.name}"}
    return {"ok": False, "message": (err or out or "").strip() or "Failed to dump save."}


def cmd_save_to_sd(params):
    """Upload a local save file into the SD card's save-filer folder."""
    local = Path(params["local_path"])
    target = params.get("target") or f"/saves/{local.name}"
    code = stream_deployer(["sd", "upload", str(local), target], local.name)
    return {"ok": code == 0, "message": "Save copied to SD card." if code == 0 else "Failed to copy save to SD."}


def cmd_save_from_sd(params):
    """Download a save file from the SD card to a local path."""
    sd_path = params["sd_path"]
    local = Path(params["local_path"])
    local.parent.mkdir(parents=True, exist_ok=True)
    code = stream_deployer(["sd", "download", sd_path, str(local)], local.name)
    return {
        "ok": code == 0,
        "message": f"Save downloaded to {local.name}." if code == 0 else "Failed to download save.",
    }


def cmd_deploy(params):
    """Deploy a ROM to the cart, optionally writing a save file with it."""
    args = ["upload", str(Path(params["rom_path"]))]
    if params.get("save_path"):
        args += ["-s", str(params["save_path"])]
    if params.get("save_type"):
        args += ["-t", params["save_type"]]
    code = stream_deployer(args, Path(params["rom_path"]).name)
    return {"ok": code == 0, "message": "Deploy complete!" if code == 0 else "Deploy failed."}


DISPATCH = {
    "config": cmd_config,
    "status": cmd_status,
    "list_local_roms": cmd_list_local_roms,
    "list_cart": cmd_list_cart,
    "all_sd_roms": cmd_all_sd_roms,
    "compare": cmd_compare,
    "upload": cmd_upload,
    "menu_list": cmd_menu_list,
    "menu_backup": cmd_menu_backup,
    "menu_upload": cmd_menu_upload,
    "music_status": cmd_music_status,
    "music_list": cmd_music_list,
    "music_upload": cmd_music_upload,
    "music_remove": cmd_music_remove,
    "sync_rtc": cmd_sync_rtc,
    "browse": cmd_browse,
    "save_read": cmd_save_read,
    "save_to_sd": cmd_save_to_sd,
    "save_from_sd": cmd_save_from_sd,
    "deploy": cmd_deploy,
}


def dispatcher(method, params):
    handler = DISPATCH.get(method)
    if handler is None:
        raise ValueError(f"unknown method: {method}")
    return handler(params)


# --- Main loop --------------------------------------------------------------
def main():
    if len(sys.argv) > 1 and sys.argv[1].startswith("--gui-version="):
        global GUI_VERSION  # noqa: PLW0603
        GUI_VERSION = sys.argv[1].split("=", 1)[1]

    # Read request frames line-by-line. On Windows a chunked sys.stdin.read(n)
    # blocks until EOF even when a full line is already available, which would
    # starve the protocol while Electron keeps stdin open. readline() returns
    # as soon as a complete newline-delimited frame has arrived.
    stdin_buf = sys.stdin.buffer
    while True:
        line = stdin_buf.readline()
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue
        handle_request(req)
    sys.stderr.write("bridge: stdin closed, exiting\n")


if __name__ == "__main__":
    main()
