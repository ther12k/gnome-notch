#!/usr/bin/env python3
"""
Google Home Controller & Collector Engine
Integrates with Google Home Web, local state cache, and smart home APIs.
"""

import os
import sys
import json
import time
import subprocess
from pathlib import Path

CONFIG_DIR = Path.home() / ".config" / "google-home-panel"
CONFIG_FILE = CONFIG_DIR / "config.json"
STATE_FILE = CONFIG_DIR / "state.json"

DEFAULT_HOME_URL = "https://home.google.com"
DEFAULT_HOME_ID = ""

DEFAULT_CONFIG = {
    "home_id": "",
    "home_url": "https://home.google.com",
    "chrome_profile": "Default",
    "poll_interval_sec": 20,
    "panel_display_mode": "active_device",  # "active_device", "summary_count", "compact"
    "devices": [
        {
            "id": "device_1",
            "name": "Smart Plug",
            "room": "Kitchen",
            "type": "socket",  # "socket", "light", "switch", "thermostat"
            "state": "on",     # "on", "off", "offline"
            "last_updated": int(time.time()),
            "api_endpoint": ""
        },
        {
            "id": "device_2",
            "name": "Main Light",
            "room": "Living Room",
            "type": "light",
            "state": "off",
            "last_updated": int(time.time()),
            "api_endpoint": ""
        },
        {
            "id": "device_3",
            "name": "Desk Lamp",
            "room": "Bedroom",
            "type": "light",
            "state": "off",
            "last_updated": int(time.time()),
            "api_endpoint": ""
        }
    ],
    "external_bridges": {
        "home_assistant": {
            "enabled": False,
            "url": "http://homeassistant.local:8123",
            "token": ""
        }
    }
}


def load_config():
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if not CONFIG_FILE.exists():
        with open(CONFIG_FILE, "w") as f:
            json.dump(DEFAULT_CONFIG, f, indent=2)
        return DEFAULT_CONFIG
    try:
        with open(CONFIG_FILE, "r") as f:
            cfg = json.load(f)
            for k, v in DEFAULT_CONFIG.items():
                if k not in cfg:
                    cfg[k] = v
            return cfg
    except Exception:
        return DEFAULT_CONFIG


def save_config(cfg):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(cfg, f, indent=2)


def get_device_icon(dev_type, state):
    if state == "offline":
        return "⚫"
    if dev_type == "light":
        return "💡" if state == "on" else "⚪"
    elif dev_type == "socket":
        return "🔌" if state == "on" else "⚪"
    elif dev_type == "switch":
        return "⚡" if state == "on" else "⚪"
    return "📱"


def launch_google_home():
    cfg = load_config()
    url = cfg.get("home_url", DEFAULT_HOME_URL)
    profile = cfg.get("chrome_profile", "Default")

    try:
        res = subprocess.run(["xdotool", "search", "--name", "Google Home"], capture_output=True, text=True)
        wids = res.stdout.strip().split()
        if wids:
            subprocess.run(["xdotool", "windowactivate", wids[0]])
            return {"status": "activated", "window_id": wids[0]}
    except Exception:
        pass

    cmd = [
        "google-chrome",
        f"--profile-directory={profile}",
        f"--app={url}"
    ]
    try:
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"status": "launched", "url": url}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def set_device_state(dev_name_or_id, new_state):
    cfg = load_config()

    if dev_name_or_id.lower() in ["all", "semua"]:
        for dev in cfg.get("devices", []):
            if dev.get("state") != "offline":
                dev["state"] = new_state
                dev["last_updated"] = int(time.time())
        save_config(cfg)
        return {"status": "ok", "device": {"name": "All Devices", "state": new_state}}

    found = False
    target_dev = None

    for dev in cfg.get("devices", []):
        if dev["name"].lower() == dev_name_or_id.lower() or dev["id"].lower() == dev_name_or_id.lower():
            dev["state"] = new_state
            dev["last_updated"] = int(time.time())
            target_dev = dev
            found = True
            break

    if found:
        save_config(cfg)
        return {"status": "ok", "device": target_dev}
    return {"status": "not_found", "error": f"Device '{dev_name_or_id}' not found"}


def toggle_device(dev_name_or_id):
    cfg = load_config()
    for dev in cfg.get("devices", []):
        if dev["name"].lower() == dev_name_or_id.lower() or dev["id"].lower() == dev_name_or_id.lower():
            curr = dev.get("state", "off")
            new_state = "off" if curr == "on" else "on"
            return set_device_state(dev["name"], new_state)
    return {"status": "not_found", "error": f"Device '{dev_name_or_id}' not found"}


def collect_status():
    cfg = load_config()
    devices = cfg.get("devices", [])

    total = len(devices)
    active_devices = [d for d in devices if d.get("state") == "on"]
    offline_devices = [d for d in devices if d.get("state") == "offline"]

    rooms = {}
    for d in devices:
        r = d.get("room", "General")
        if r not in rooms:
            rooms[r] = []
        rooms[r].append({
            "id": d.get("id"),
            "name": d.get("name"),
            "type": d.get("type"),
            "state": d.get("state"),
            "icon": get_device_icon(d.get("type"), d.get("state")),
            "last_updated": d.get("last_updated")
        })

    active_count = len(active_devices)
    disp_mode = cfg.get("panel_display_mode", "active_device")

    if active_count > 0:
        if disp_mode == "active_device":
            top_text = f"🏠 {active_devices[0]['name']}: ON"
            if active_count > 1:
                top_text += f" (+{active_count - 1})"
        else:
            top_text = f"🏠 {active_count} On"
        icon_name = "weather-clear-symbolic"
        has_active = True
    else:
        top_text = "🏠 Home: Off"
        icon_name = "weather-clear-night-symbolic"
        has_active = False

    return {
        "home_id": cfg.get("home_id", ""),
        "home_url": cfg.get("home_url", DEFAULT_HOME_URL),
        "timestamp": int(time.time()),
        "summary": {
            "text": top_text,
            "icon": icon_name,
            "active_count": active_count,
            "total_count": total,
            "offline_count": len(offline_devices),
            "has_active": has_active
        },
        "rooms": rooms,
        "devices": devices
    }


def main():
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "--summary":
            d = collect_status()
            print(d["summary"]["text"])
            return
        elif cmd == "--launch":
            res = launch_google_home()
            print(json.dumps(res))
            return
        elif cmd == "--toggle" and len(sys.argv) > 2:
            toggle_device(sys.argv[2])
            print(json.dumps(collect_status()))
            return
        elif cmd == "--on" and len(sys.argv) > 2:
            set_device_state(sys.argv[2], "on")
            print(json.dumps(collect_status()))
            return
        elif cmd == "--off" and len(sys.argv) > 2:
            set_device_state(sys.argv[2], "off")
            print(json.dumps(collect_status()))
            return
        elif cmd == "--config":
            print(json.dumps(load_config(), indent=2))
            return

    print(json.dumps(collect_status(), indent=2))


if __name__ == "__main__":
    main()
