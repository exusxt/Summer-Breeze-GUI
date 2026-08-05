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
            buf = buf[idx + 1:]
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
    firmware = None
    boot = None
    sd = False
    if connected:
        code, out, _err = summerbreeze.run_sc64_command(["info"])
        if code == 0:
            for line in out.split("\n"):
                if "Firmware version" in line:
                    firmware = line.strip()
                if "Boot mode" in line:
                    boot = line.strip()
        sd = summerbreeze.is_sd_card_accessible()
    return {
        "device": "connected" if connected else "not-connected",
        "firmwareVersion": firmware,
        "bootMode": boot,
        "sdAccessible": sd,
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
    return [
        {"name": f.name, "path": str(f), "size": f.stat().st_size}
        for f in summerbreeze.list_local_menu_versions()
    ]


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
    return [
        {"name": f.name, "path": str(f), "size": f.stat().st_size}
        for f in summerbreeze.list_local_music()
    ]


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
