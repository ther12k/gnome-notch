#!/usr/bin/env python3
"""
AI Account & Usage Collector
Collects real-time usage, limits, and reset countdowns for:
- GLM (Z.ai / BigModel)
- Google Antigravity (Local Language Server / agy)
- OpenAI Codex (wham/usage)
- 9Router (Local SQLite DB + local/remote dashboard API + Provider Connection Monitor)
- OmniRoute (Local/remote gateway + Provider Connection Monitor)
- OpenRouter / Custom APIs

Includes rich theming system (Catppuccin, Nord, Dracula, Cyberpunk, Monochrome, Default),
custom fonts, colors, and per-provider filtering.
"""

import os
import sys
import json
import time
import re
import datetime
import glob
import subprocess
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path

CONFIG_DIR = Path.home() / ".config" / "ai-usage-monitor"
CONFIG_FILE = CONFIG_DIR / "config.json"

THEME_PRESETS = {
    "default": {
        "name": "Default Cyber",
        "topbar_color": "#8ab4f8",
        "topbar_font_weight": "600",
        "topbar_font_size": "12px",
        "topbar_font_family": "",
        "icon_ok": "emblem-default-symbolic",
        "icon_warn": "dialog-warning-symbolic",
        "icon_err": "network-offline-symbolic",
        "menu_header_color": "#8ab4f8",
        "menu_section_color": "#8ab4f8",
        "menu_ok_color": "#81c995",
        "menu_warn_color": "#fdd663",
        "menu_err_color": "#f28b82",
        "menu_muted_color": "#9aa0a6",
        "badge_icons": {
            "glm": "✦",
            "antigravity": "🌌",
            "codex": "🤖",
            "nine_router": "🔀",
            "omniroute": "🔄",
            "custom": "📡",
            "reset": "⏳",
            "group": "🌐"
        }
    },
    "catppuccin": {
        "name": "Catppuccin Mocha",
        "topbar_color": "#cba6f7",       # Mauve
        "topbar_font_weight": "bold",
        "topbar_font_size": "12px",
        "topbar_font_family": "",
        "icon_ok": "weather-clear-symbolic",
        "icon_warn": "weather-few-clouds-symbolic",
        "icon_err": "weather-storm-symbolic",
        "menu_header_color": "#cba6f7",
        "menu_section_color": "#89b4fa",  # Blue
        "menu_ok_color": "#a6e3a1",       # Green
        "menu_warn_color": "#f9e2af",     # Yellow
        "menu_err_color": "#f38ba8",      # Red
        "menu_muted_color": "#9399b2",
        "badge_icons": {
            "glm": "✦",
            "antigravity": "🌸",
            "codex": "🐱",
            "nine_router": "🔀",
            "omniroute": "🔄",
            "custom": "📡",
            "reset": "⏱",
            "group": "🧩"
        }
    },
    "nord": {
        "name": "Nord Frost",
        "topbar_color": "#88c0d0",       # Frost Cyan
        "topbar_font_weight": "600",
        "topbar_font_size": "12px",
        "topbar_font_family": "",
        "icon_ok": "starred-symbolic",
        "icon_warn": "dialog-warning-symbolic",
        "icon_err": "process-stop-symbolic",
        "menu_header_color": "#88c0d0",
        "menu_section_color": "#81a1c1",
        "menu_ok_color": "#a3be8c",       # Aurora Green
        "menu_warn_color": "#ebcb8b",     # Aurora Yellow
        "menu_err_color": "#bf616a",      # Aurora Red
        "menu_muted_color": "#d8dee9",
        "badge_icons": {
            "glm": "❄️",
            "antigravity": "🧊",
            "codex": "🤖",
            "nine_router": "⇄",
            "omniroute": "🔄",
            "custom": "📡",
            "reset": "⏳",
            "group": "🧭"
        }
    },
    "dracula": {
        "name": "Dracula Vampire",
        "topbar_color": "#bd93f9",       # Purple
        "topbar_font_weight": "bold",
        "topbar_font_size": "12px",
        "topbar_font_family": "",
        "icon_ok": "security-high-symbolic",
        "icon_warn": "dialog-warning-symbolic",
        "icon_err": "dialog-error-symbolic",
        "menu_header_color": "#ff79c6",   # Pink
        "menu_section_color": "#bd93f9",  # Purple
        "menu_ok_color": "#50fa7b",       # Green
        "menu_warn_color": "#f1fa8c",     # Yellow
        "menu_err_color": "#ff5555",      # Red
        "menu_muted_color": "#6272a4",    # Comment
        "badge_icons": {
            "glm": "✦",
            "antigravity": "🦇",
            "codex": "💀",
            "nine_router": "🩸",
            "omniroute": "🔄",
            "custom": "📡",
            "reset": "⌛",
            "group": "🕸️"
        }
    },
    "cyberpunk": {
        "name": "Cyberpunk Neon",
        "topbar_color": "#00ffcc",       # Neon Cyan
        "topbar_font_weight": "bold",
        "topbar_font_size": "12px",
        "topbar_font_family": "",
        "icon_ok": "software-update-available-symbolic",
        "icon_warn": "dialog-warning-symbolic",
        "icon_err": "process-stop-symbolic",
        "menu_header_color": "#ff007f",   # Neon Pink
        "menu_section_color": "#00ffcc",  # Neon Cyan
        "menu_ok_color": "#39ff14",       # Neon Green
        "menu_warn_color": "#ffe600",     # Neon Yellow
        "menu_err_color": "#ff073a",      # Neon Red
        "menu_muted_color": "#708090",
        "badge_icons": {
            "glm": "✦",
            "antigravity": "🪐",
            "codex": "👾",
            "nine_router": "🔀",
            "omniroute": "🔄",
            "custom": "📡",
            "reset": "⏳",
            "group": "🛰️"
        }
    },
    "monochrome": {
        "name": "Minimal Monochrome",
        "topbar_color": "#ffffff",
        "topbar_font_weight": "normal",
        "topbar_font_size": "11px",
        "topbar_font_family": "monospace",
        "icon_ok": "radio-checked-symbolic",
        "icon_warn": "dialog-warning-symbolic",
        "icon_err": "dialog-error-symbolic",
        "menu_header_color": "#ffffff",
        "menu_section_color": "#cccccc",
        "menu_ok_color": "#ffffff",
        "menu_warn_color": "#dddddd",
        "menu_err_color": "#888888",
        "menu_muted_color": "#777777",
        "badge_icons": {
            "glm": "[GLM]",
            "antigravity": "[AG]",
            "codex": "[CDX]",
            "nine_router": "[R9]",
            "omniroute": "[OMN]",
            "custom": "[API]",
            "reset": "->",
            "group": "[AVG]"
        }
    }
}

DEFAULT_CONFIG = {
    "theme": "default",
    "poll_interval_sec": 30,
    "panel_position": "center",  # "center", "left", "right"
    "panel_format": "compact",   # "compact", "standard", "full", "minimal"
    "text_badge": False,         # true: bar + countdown drawn as text characters
    "show_reset_in_topbar": True,  # countdown in badge (inline in text mode / full format)
    "show_icon": True,
    "show_alerts": True,
    "alert_exhaust_pct": 95,
    "alert_warn_pct": 85,
    "appearance": {
        "topbar_color": "",
        "topbar_font_size": "",
        "topbar_font_weight": "",
        "topbar_font_family": "",
        "account_colors": [],
        "custom_badge_icons": {}
    },
    "providers": {
        "glm": {
            "enabled": True,
            "api_key": "",
            "base_url": "https://api.z.ai",
            "auto_detect": True
        },
        "antigravity": {
            "enabled": True,
            "port": 0,
            "auto_detect": True
        },
        "codex": {
            "enabled": True,
            "auth_file": "",
            "auto_detect": True
        },
        "nine_router": {
            "enabled": True,
            "base_url": "http://localhost:20128",
            "remote_url": "",
            "auto_detect": True,
            "monitored_providers": ["glm", "kiro", "gemini", "gemini-cli", "openai-compatible"]
        },
        "omniroute": {
            "enabled": True,
            "base_url": "http://localhost:20128",
            "auto_detect": True,
            "monitored_providers": []
        },
        "openrouter": {
            "enabled": False,
            "api_key": ""
        }
    },
    "custom_apis": [
        {
            "name": "Custom Proxy",
            "enabled": False,
            "url": "https://api.example.com/v1/user/usage",
            "method": "GET",
            "headers": {"Authorization": "Bearer YOUR_KEY"},
            "used_pct_path": "data.used_percent",
            "reset_path": "data.reset_at"
        }
    ]
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
            if "providers" not in cfg:
                cfg["providers"] = DEFAULT_CONFIG["providers"]
            else:
                for pk, pv in DEFAULT_CONFIG["providers"].items():
                    if pk not in cfg["providers"]:
                        cfg["providers"][pk] = pv
            return cfg
    except Exception:
        return DEFAULT_CONFIG


def save_config(cfg):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(cfg, f, indent=2)


def get_active_theme(cfg):
    theme_name = cfg.get("theme", "default")
    base_theme = THEME_PRESETS.get(theme_name, THEME_PRESETS["default"]).copy()

    app = cfg.get("appearance", {})
    if app.get("topbar_color"):
        base_theme["topbar_color"] = app["topbar_color"]
    if app.get("topbar_font_size"):
        base_theme["topbar_font_size"] = app["topbar_font_size"]
    if app.get("topbar_font_weight"):
        base_theme["topbar_font_weight"] = app["topbar_font_weight"]
    if app.get("topbar_font_family"):
        base_theme["topbar_font_family"] = app["topbar_font_family"]

    custom_badges = app.get("custom_badge_icons", {})
    if custom_badges:
        merged_badges = base_theme.get("badge_icons", {}).copy()
        merged_badges.update(custom_badges)
        base_theme["badge_icons"] = merged_badges

    base_theme["theme_id"] = theme_name
    return base_theme


def make_ascii_bar(pct, length=10):
    if pct is None:
        return ""
    try:
        val = max(0, min(100, float(pct)))
        filled = int(round((val / 100.0) * length))
        return "█" * filled + "░" * (length - filled)
    except Exception:
        return ""


def format_countdown_ms(target_ms):
    if not target_ms:
        return ""
    diff_sec = max(0, int((target_ms - time.time() * 1000) / 1000))
    if diff_sec <= 0:
        return "Resetting"
    h = diff_sec // 3600
    m = (diff_sec % 3600) // 60
    s = diff_sec % 60
    if h > 0:
        return f"{h}h {m}m"
    elif m > 0:
        return f"{m}m {s}s"
    return f"{s}s"


def format_countdown_iso(iso_str):
    if not iso_str:
        return ""
    try:
        clean_str = iso_str.replace("Z", "+00:00")
        dt = datetime.datetime.fromisoformat(clean_str)
        target_ms = dt.timestamp() * 1000
        return format_countdown_ms(target_ms)
    except Exception:
        return ""


def format_local_time_iso(iso_str):
    if not iso_str:
        return ""
    try:
        clean_str = iso_str.replace("Z", "+00:00")
        dt = datetime.datetime.fromisoformat(clean_str).astimezone()
        return dt.strftime("%H:%M")
    except Exception:
        return ""


def format_local_time_ms(ms):
    if not ms:
        return ""
    try:
        dt = datetime.datetime.fromtimestamp(ms / 1000.0)
        return dt.strftime("%H:%M")
    except Exception:
        return ""


def _autodetect_glm_accounts():
    """
    Discovers all local Z.ai/GLM API keys (one per account) from known tool configs.
    Returns a list of {name, short, api_key} dicts, deduplicated by key.
    """
    found = []

    # 1. Claude Code settings (~/.claude/settings.json, only if pointed at z.ai)
    p = Path.home() / ".claude" / "settings.json"
    if p.exists():
        try:
            with open(p) as f:
                env = json.load(f).get("env", {})
            base = env.get("ANTHROPIC_BASE_URL") or ""
            key = env.get("ANTHROPIC_AUTH_TOKEN") or env.get("ANTHROPIC_API_KEY")
            if key and ("z.ai" in base or "bigmodel" in base or not base):
                found.append({"name": "claude", "short": "c", "api_key": key})
        except Exception:
            pass

    # 2. OpenCode auth (~/.local/share/opencode/auth.json -> zai.key)
    p = Path.home() / ".local" / "share" / "opencode" / "auth.json"
    if p.exists():
        try:
            with open(p) as f:
                key = (json.load(f).get("zai") or {}).get("key")
            if key:
                found.append({"name": "opencode", "short": "o", "api_key": key})
        except Exception:
            pass

    # 3. Environment variables
    key = os.environ.get("ZAI_API_KEY") or os.environ.get("ZHIPU_API_KEY")
    if key:
        found.append({"name": "env", "short": "e", "api_key": key})

    # Deduplicate by key, preserving order
    seen = set()
    out = []
    for acc in found:
        if acc["api_key"] not in seen:
            seen.add(acc["api_key"])
            out.append(acc)
    return out


def _query_glm_account(name, short, api_key, base_url):
    """Queries the z.ai monitor API for a single GLM account."""
    url = f"{base_url}/api/monitor/usage/quota/limit"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": api_key,
            "Accept-Language": "en-US,en",
            "User-Agent": "aiacctool-monitor"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            limits = data.get("data", {}).get("limits", [])
            token_limit = next((l for l in limits if l.get("type") == "TOKENS_LIMIT"), None)
            time_limit = next((l for l in limits if l.get("type") == "TIME_LIMIT"), None)

            token_used = token_limit.get("percentage") if token_limit else None
            token_reset_ms = token_limit.get("nextResetTime") if token_limit else None
            time_used = time_limit.get("percentage") if time_limit else None
            time_reset_ms = time_limit.get("nextResetTime") if time_limit else None

            return {
                "name": name,
                "short": short,
                "status": "ok",
                "level": data.get("data", {}).get("level", "Standard"),
                "token_quota": {
                    "used_pct": token_used,
                    "remaining_pct": (100 - token_used) if token_used is not None else None,
                    "bar": make_ascii_bar(token_used),
                    "reset_ms": token_reset_ms,
                    "countdown": format_countdown_ms(token_reset_ms),
                    "reset_time": format_local_time_ms(token_reset_ms)
                },
                "tool_quota": {
                    "used_pct": time_used,
                    "remaining_pct": (100 - time_used) if time_used is not None else None,
                    "bar": make_ascii_bar(time_used),
                    "current": time_limit.get("currentValue") if time_limit else None,
                    "remaining": time_limit.get("remaining") if time_limit else None,
                    "reset_ms": time_reset_ms,
                    "countdown": format_countdown_ms(time_reset_ms),
                    "reset_time": format_local_time_ms(time_reset_ms)
                }
            }
    except urllib.error.HTTPError as he:
        return {"name": name, "short": short, "status": "error", "error": f"HTTP {he.code}"}
    except Exception as e:
        return {"name": name, "short": short, "status": "error", "error": str(e)}


def check_glm(cfg):
    glm_cfg = cfg.get("providers", {}).get("glm", {})
    if not glm_cfg.get("enabled", True):
        return {"enabled": False, "status": "disabled"}

    base_url = glm_cfg.get("base_url", "https://api.z.ai").rstrip("/")

    # Build the account list: manual config accounts first, then auto-detected
    accounts_cfg = glm_cfg.get("accounts", [])
    accounts = []
    if accounts_cfg:
        for acc in accounts_cfg:
            key = acc.get("api_key")
            if key:
                accounts.append({
                    "name": acc.get("name", "account"),
                    "short": acc.get("short") or (acc.get("name", "a")[:1].lower()),
                    "api_key": key,
                })
    if glm_cfg.get("auto_detect", True):
        for acc in _autodetect_glm_accounts():
            if acc["api_key"] not in [a["api_key"] for a in accounts]:
                accounts.append(acc)

    # Legacy single key from config
    legacy_key = glm_cfg.get("api_key")
    if legacy_key and legacy_key not in [a["api_key"] for a in accounts]:
        accounts.insert(0, {"name": "main", "short": "m", "api_key": legacy_key})

    if not accounts:
        return {"enabled": True, "status": "not_configured", "error": "No Z.ai API key found"}

    results = [_query_glm_account(a["name"], a["short"], a["api_key"], base_url) for a in accounts]
    ok_results = [r for r in results if r.get("status") == "ok"]

    out = {
        "enabled": True,
        "status": "ok" if ok_results else "error",
        "accounts": results,
        "ok_count": len(ok_results),
    }

    # Backward-compatible top-level quota (first healthy account)
    if ok_results:
        out["level"] = ok_results[0].get("level")
        out["token_quota"] = ok_results[0].get("token_quota")
        out["tool_quota"] = ok_results[0].get("tool_quota")
    else:
        out["error"] = results[0].get("error", "no healthy account") if results else "no accounts"
    return out


def check_antigravity(cfg):
    ag_cfg = cfg.get("providers", {}).get("antigravity", {})
    if not ag_cfg.get("enabled", True):
        return {"enabled": False, "status": "disabled"}

    port = ag_cfg.get("port", 0)
    ports_to_try = [port] if port > 0 else []

    if ag_cfg.get("auto_detect", True):
        try:
            res = subprocess.run(["ss", "-tlnp"], capture_output=True, text=True, timeout=2)
            for line in res.stdout.splitlines():
                if "agy" in line and "127.0.0.1:" in line:
                    m = re.search(r"127\.0\.0\.1:(\d+)", line)
                    if m:
                        p = int(m.group(1))
                        if p not in ports_to_try:
                            ports_to_try.append(p)
        except Exception:
            pass

        if not ports_to_try:
            log_path = Path.home() / ".gemini" / "antigravity-cli" / "cli.log"
            if log_path.exists():
                try:
                    with open(log_path, "r", errors="ignore") as f:
                        for line in f.readlines()[-20:]:
                            m = re.search(r"listening on random port at (\d+) for HTTP", line)
                            if m:
                                p = int(m.group(1))
                                if p not in ports_to_try:
                                    ports_to_try.append(p)
                except Exception:
                    pass

    for p in ports_to_try:
        url = f"http://127.0.0.1:{p}/exa.language_server_pb.LanguageServerService/GetAvailableModels"
        req = urllib.request.Request(
            url,
            data=b"{}",
            headers={"Content-Type": "application/json", "User-Agent": "aiacctool-monitor"}
        )
        try:
            with urllib.request.urlopen(req, timeout=2) as resp:
                data = json.loads(resp.read().decode())
                models = data.get("response", {}).get("models", {})
                if not models:
                    continue

                highlighted = {}
                for m_id, m_data in models.items():
                    quota = m_data.get("quotaInfo")
                    if quota:
                        rem = quota.get("remainingFraction")
                        rst = quota.get("resetTime")
                        used_p = round((1 - rem) * 100, 1) if rem is not None else None
                        rem_p = round(rem * 100, 1) if rem is not None else None
                        highlighted[m_id] = {
                            "remaining_pct": rem_p,
                            "used_pct": used_p,
                            "bar": make_ascii_bar(rem_p),
                            "reset_iso": rst,
                            "countdown": format_countdown_iso(rst) if rst else "Ready",
                            "reset_time": format_local_time_iso(rst)
                        }

                sonnet = highlighted.get("claude-sonnet-4-6") or highlighted.get("claude-opus-4-6-thinking")
                gemini = highlighted.get("gemini-3.8-flash-high") or highlighted.get("gemini-2.5-flash")

                return {
                    "enabled": True,
                    "status": "ok",
                    "port": p,
                    "models_count": len(models),
                    "claude_sonnet": sonnet,
                    "gemini": gemini,
                    "models": highlighted
                }
        except Exception:
            continue

    return {"enabled": True, "status": "offline", "error": "agy language server not running"}


def check_codex(cfg):
    codex_cfg = cfg.get("providers", {}).get("codex", {})
    if not codex_cfg.get("enabled", True):
        return {"enabled": False, "status": "disabled"}

    auth_path = Path(codex_cfg.get("auth_file") or (Path.home() / ".codex" / "auth.json"))
    if not auth_path.exists():
        return {"enabled": True, "status": "not_configured", "error": "No ~/.codex/auth.json"}

    try:
        with open(auth_path) as f:
            auth = json.load(f)
        token = auth.get("tokens", {}).get("access_token")
        acct = auth.get("tokens", {}).get("account_id")
        if not token:
            return {"enabled": True, "status": "not_logged_in", "error": "No access token"}

        url = "https://chatgpt.com/backend-api/wham/usage"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "ChatGPT-Account-Id": acct or "",
                "User-Agent": "codex_cli_rs"
            }
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            rate_limit = data.get("rate_limit", {})
            p_win = rate_limit.get("primary_window", {})
            s_win = rate_limit.get("secondary_window", {})

            p_reset_ms = (p_win.get("reset_at") * 1000) if p_win.get("reset_at") else None
            s_reset_ms = (s_win.get("reset_at") * 1000) if s_win.get("reset_at") else None

            p_used = p_win.get("used_percent")
            s_used = s_win.get("used_percent")

            return {
                "enabled": True,
                "status": "ok",
                "plan": data.get("plan_type", "Standard"),
                "primary_window": {
                    "used_pct": p_used,
                    "remaining_pct": (100 - p_used) if p_used is not None else None,
                    "bar": make_ascii_bar(p_used),
                    "reset_ms": p_reset_ms,
                    "countdown": format_countdown_ms(p_reset_ms),
                    "reset_time": format_local_time_ms(p_reset_ms)
                },
                "secondary_window": {
                    "used_pct": s_used,
                    "remaining_pct": (100 - s_used) if s_used is not None else None,
                    "bar": make_ascii_bar(s_used),
                    "reset_ms": s_reset_ms,
                    "countdown": format_countdown_ms(s_reset_ms),
                    "reset_time": format_local_time_ms(s_reset_ms)
                }
            }
    except urllib.error.HTTPError as he:
        if he.code == 402:
            return {"enabled": True, "status": "payment_required", "error": "Payment Required (Plan inactive)"}
        elif he.code == 401:
            return {"enabled": True, "status": "auth_expired", "error": "Token expired"}
        return {"enabled": True, "status": "error", "error": f"HTTP {he.code}"}
    except Exception as e:
        return {"enabled": True, "status": "error", "error": str(e)}


def discover_router_providers():
    """
    Discovers all configured provider connections from 9Router DB or recent backups,
    normalizing names, status, and active counts.
    """
    conns = []
    db_path = Path.home() / ".9router" / "db" / "data.sqlite"
    if db_path.exists():
        try:
            import sqlite3
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute('SELECT id, provider, name, email, isActive, testStatus, lastError FROM providerConnections;')
            for r in cur.fetchall():
                conns.append({
                    'id': r[0], 'provider': r[1], 'name': r[2], 'email': r[3],
                    'active': bool(r[4]), 'testStatus': r[5], 'lastError': r[6]
                })
            conn.close()
        except Exception:
            pass

    if not conns:
        backups = sorted(glob.glob(os.path.expanduser('~/Downloads/BAK/9router-backup-*.json')), reverse=True)
        if backups:
            try:
                with open(backups[0]) as f:
                    d = json.load(f)
                for r in d.get('providerConnections', []):
                    conns.append({
                        'id': r.get('id'), 'provider': r.get('provider'), 'name': r.get('name'),
                        'email': r.get('email'), 'active': bool(r.get('isActive')),
                        'testStatus': r.get('testStatus'), 'lastError': r.get('lastError')
                    })
            except Exception:
                pass

    grouped = {}
    for c in conns:
        raw_p = c.get('provider', 'other')
        p = raw_p.split('-chat-')[0] if '-chat-' in raw_p else raw_p
        if p not in grouped:
            grouped[p] = {
                'provider': p,
                'count': 0,
                'active_count': 0,
                'accounts': [],
                'has_error': False
            }
        grouped[p]['count'] += 1
        if c.get('active'):
            grouped[p]['active_count'] += 1
        acc = c.get('name') or c.get('email')
        if acc and acc not in grouped[p]['accounts']:
            grouped[p]['accounts'].append(acc)
        detail = {
            'name': acc or '(unnamed)',
            'active': bool(c.get('active')),
            'error': (c.get('lastError') or '')[:120] or None,
        }
        grouped[p].setdefault('accounts_detail', []).append(detail)
        if c.get('lastError'):
            grouped[p]['has_error'] = True

    return grouped


def check_9router(cfg):
    r_cfg = cfg.get("providers", {}).get("nine_router", {})
    if not r_cfg.get("enabled", True):
        return {"enabled": False, "status": "disabled"}

    result = {
        "enabled": True,
        "status": "ok",
        "local_running": False,
        "remote_running": False,
        "today_requests": 0,
        "today_tokens": 0,
        "provider_count": 0,
        "all_providers": {},
        "filtered_providers": {}
    }

    # 1. Check local SQLite DB for requests/tokens
    db_path = Path.home() / ".9router" / "db" / "data.sqlite"
    if db_path.exists():
        try:
            import sqlite3
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute('SELECT count(*), coalesce(sum(promptTokens + completionTokens), 0) FROM usageHistory WHERE date(timestamp) = date("now");')
            cnt, tokens = cur.fetchone()
            result["today_requests"] = cnt
            result["today_tokens"] = tokens
            cur.execute('SELECT count(*) FROM providerConnections WHERE isActive = 1;')
            result["provider_count"] = cur.fetchone()[0]
            conn.close()
        except Exception:
            pass

    # 2. Check local server health (port 20128)
    base_url = r_cfg.get("base_url", "http://localhost:20128").rstrip("/")
    try:
        with urllib.request.urlopen(f"{base_url}/api/health", timeout=2) as resp:
            if resp.status == 200:
                result["local_running"] = True
    except Exception:
        result["local_running"] = False

    # 3. Check remote server health (if a remote_url is configured)
    remote_url = r_cfg.get("remote_url", "").rstrip("/")
    if remote_url:
        try:
            with urllib.request.urlopen(f"{remote_url}/api/health", timeout=3) as resp:
                if resp.status == 200:
                    result["remote_running"] = True
                    result["remote_url"] = remote_url
        except Exception:
            result["remote_running"] = False

    # 4. Discover all provider connections
    all_p = discover_router_providers()
    result["all_providers"] = all_p
    if result["provider_count"] == 0:
        result["provider_count"] = sum(p["active_count"] for p in all_p.values())

    # 5. Filter by user's monitored_providers list
    monitored = r_cfg.get("monitored_providers", [])
    if monitored:
        filtered = {}
        for m in monitored:
            if m in all_p:
                filtered[m] = all_p[m]
            else:
                # Include even if 0 connections
                filtered[m] = {
                    "provider": m,
                    "count": 0,
                    "active_count": 0,
                    "accounts": [],
                    "has_error": False
                }
        result["filtered_providers"] = filtered
    else:
        # Default: show all active providers
        result["filtered_providers"] = {k: v for k, v in all_p.items() if v["active_count"] > 0}

    return result


def check_omniroute(cfg):
    om_cfg = cfg.get("providers", {}).get("omniroute", {})
    if not om_cfg.get("enabled", True):
        return {"enabled": False, "status": "disabled"}

    base_url = om_cfg.get("base_url", "http://localhost:20128").rstrip("/")
    result = {
        "enabled": True,
        "status": "offline",
        "url": base_url,
        "models_count": 0,
        "filtered_providers": {}
    }

    try:
        req = urllib.request.Request(f"{base_url}/v1/models", headers={"User-Agent": "aiacctool-monitor"})
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read().decode())
            result["status"] = "ok"
            models = data.get("data", [])
            result["models_count"] = len(models)
            # Group models by provider prefix (e.g. claude/..., gpt/..., glm/...)
            prov_groups = {}
            for m in models:
                mid = m.get("id", "")
                parts = mid.split("/")
                p_name = parts[0] if len(parts) > 1 else mid.split("-")[0]
                prov_groups[p_name] = prov_groups.get(p_name, 0) + 1

            monitored = om_cfg.get("monitored_providers", [])
            if monitored:
                result["filtered_providers"] = {p: prov_groups.get(p, 0) for p in monitored}
            else:
                result["filtered_providers"] = prov_groups
    except Exception:
        result["status"] = "offline"

    return result


def check_openrouter(cfg):
    or_cfg = cfg.get("providers", {}).get("openrouter", {})
    if not or_cfg.get("enabled", False):
        return {"enabled": False, "status": "disabled"}

    key = or_cfg.get("api_key") or os.environ.get("OPENROUTER_API_KEY")
    if not key:
        return {"enabled": True, "status": "not_configured", "error": "No OpenRouter API key"}

    try:
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/auth/key",
            headers={"Authorization": f"Bearer {key}", "User-Agent": "aiacctool-monitor"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode()).get("data", {})
            limit = data.get("limit")
            usage = data.get("usage")
            return {
                "enabled": True,
                "status": "ok",
                "label": data.get("label", "Key"),
                "usage_usd": usage,
                "limit_usd": limit,
                "is_free_tier": data.get("is_free_tier", False)
            }
    except Exception as e:
        return {"enabled": True, "status": "error", "error": str(e)}


def check_custom_apis(cfg):
    items = cfg.get("custom_apis", [])
    results = []
    for c in items:
        if not c.get("enabled", False) or not c.get("url"):
            continue
        try:
            req = urllib.request.Request(
                c["url"],
                headers=c.get("headers", {}),
                method=c.get("method", "GET").upper()
            )
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode())
                def extract(path):
                    curr = data
                    for part in path.split("."):
                        if isinstance(curr, dict):
                            curr = curr.get(part)
                        else:
                            return None
                    return curr

                pct = extract(c.get("used_pct_path", "used_percent"))
                rst = extract(c.get("reset_path", "reset_at"))
                results.append({
                    "name": c.get("name", "Custom API"),
                    "status": "ok",
                    "used_pct": pct,
                    "bar": make_ascii_bar(pct),
                    "countdown": format_countdown_iso(str(rst)) if rst else ""
                })
        except Exception as e:
            results.append({
                "name": c.get("name", "Custom API"),
                "status": "error",
                "error": str(e)
            })
    return results


def _text_bar(pct, cells=8):
    """Horizontal usage bar as text characters, e.g. '██░░░░░░' for 25%."""
    filled = max(1, min(cells, int(round(pct / 100 * cells)))) if pct > 0 else 0
    return "█" * filled + "░" * (cells - filled)


def generate_panel_summary(results, cfg, theme):
    """
    Generates a concise label and status icon for the GNOME top bar, styled according to the active theme.

    Layout policy:
    - Each GLM account gets its own badge: colored percent + horizontal mini bar.
      The reset countdown lives in the bar tooltip and the menu rows, not the badge.
    - All other providers (Antigravity Claude/Gemini, Codex, custom APIs) are grouped
      into a single AVERAGE badge WITHOUT time-left.
    """
    p_format = cfg.get("panel_format", "compact")
    show_reset = cfg.get("show_reset_in_topbar", True)
    text_badge = bool(cfg.get("text_badge", False))
    badges = theme.get("badge_icons", {})

    b_glm = badges.get("glm", "⚡")
    b_grp = badges.get("group", "🌐")

    parts = []        # final rendered segments
    tmpl_parts = []   # segments with {glmN} placeholders for live ticking in JS
    cd_vars = {}      # placeholder -> reset epoch ms
    has_warning = False
    has_ok = False

    # 1. GLM — one badge per account: percent + horizontal mini bar (rendered by JS)
    glm = results.get("glm", {})
    glm_used_min = []
    panel_accounts = []
    if glm.get("enabled"):
        accounts = glm.get("accounts", [])
        multi = len([a for a in accounts if a.get("status") == "ok"]) > 1
        gi = 0
        for acc in accounts:
            if acc.get("status") != "ok":
                continue
            has_ok = True
            tok = acc.get("token_quota", {})
            used = tok.get("used_pct")
            cd = tok.get("countdown")
            reset_ms = tok.get("reset_ms")
            if used is None:
                continue
            if used >= int(cfg.get("alert_warn_pct", 85)):
                has_warning = True
            tag = f"{acc.get('short', '')} " if multi else ""
            nm = acc.get("name", "glm")
            panel_accounts.append({
                "name": nm,
                "short": acc.get("short", ""),
                "used_pct": used,
                "reset_ms": reset_ms,
                "reset_time": tok.get("reset_time", "")
            })

            # Transitional text-badge mode: bar + countdown drawn as characters
            # inside the badge text, rendered by any build (works even while a
            # stale pre-chips extension module is still cached in the shell)
            if text_badge:
                key = f"glm{gi}"
                bar = _text_bar(used)
                cd_c = (cd or "").replace(" ", "")
                if show_reset and cd_c and reset_ms:
                    cd_vars[key] = reset_ms
                    parts.append(f"{b_glm}{tag}{used:.0f}% {bar} {cd_c}")
                    tmpl_parts.append(f"{b_glm}{tag}{used:.0f}% {bar} {{{key}}}")
                else:
                    parts.append(f"{b_glm}{tag}{used:.0f}% {bar}")
                    tmpl_parts.append(f"{b_glm}{tag}{used:.0f}% {bar}")
                gi += 1
                continue

            if p_format == "compact":
                parts.append(f"{b_glm}{tag}{used}%")
                tmpl_parts.append(f"{b_glm}{tag}{used}%")
            elif p_format == "standard":
                parts.append(f"GLM-{nm} {used}%")
                tmpl_parts.append(f"GLM-{nm} {used}%")
            elif p_format == "full":
                cd_c = (cd or "").replace(" ", "")
                key = f"glm{gi}"
                if show_reset and cd_c and reset_ms:
                    cd_vars[key] = reset_ms
                    parts.append(f"GLM[{nm}]: {used}% used · {cd}")
                    tmpl_parts.append(f"GLM[{nm}]: {used}% used · {{{key}}}")
                else:
                    parts.append(f"GLM[{nm}]: {used}% used")
                    tmpl_parts.append(f"GLM[{nm}]: {used}% used")
            else:  # minimal
                glm_used_min.append(f"{used:.0f}")
            gi += 1

        if p_format == "minimal" and glm_used_min:
            seg = b_glm + "·".join(glm_used_min)
            parts.append(seg)
            tmpl_parts.append(seg)

    # 2. Grouped average for all other providers (no time-left shown)
    group_remaining = []

    ag = results.get("antigravity", {})
    if ag.get("enabled") and ag.get("status") == "ok":
        has_ok = True
        for key in ("claude_sonnet", "gemini"):
            rem = (ag.get(key) or {}).get("remaining_pct")
            if rem is not None:
                group_remaining.append(rem)
                if rem <= (100 - int(cfg.get("alert_warn_pct", 85))):
                    has_warning = True

    codex = results.get("codex", {})
    if codex.get("enabled") and codex.get("status") == "ok":
        has_ok = True
        u = (codex.get("primary_window") or {}).get("used_pct")
        if u is not None:
            group_remaining.append(100 - u)
            if u >= int(cfg.get("alert_warn_pct", 85)):
                has_warning = True

    for cust in results.get("custom_apis", []):
        if cust.get("status") == "ok" and cust.get("used_pct") is not None:
            group_remaining.append(100 - cust["used_pct"])

    r9 = results.get("nine_router", {})
    if r9.get("enabled") and (r9.get("remote_running") or r9.get("local_running")):
        has_ok = True

    group_text = None
    if group_remaining:
        avg = sum(group_remaining) / len(group_remaining)
        if p_format == "compact" or p_format == "minimal":
            seg = f"{b_grp}{avg:.0f}%"
        elif p_format == "standard":
            seg = f"Others avg {avg:.0f}%"
        else:
            seg = f"Others (avg of {len(group_remaining)}): {avg:.0f}% left"
        parts.append(seg)
        tmpl_parts.append(seg)
        group_text = seg
    elif r9.get("enabled") and (r9.get("remote_running") or r9.get("local_running")):
        # Fallback when no quota-bearing provider is live: show how many
        # upstream accounts across the monitored providers are online.
        online = sum(p.get("active_count", 0) for p in (r9.get("filtered_providers") or {}).values())
        if online > 0:
            if p_format == "compact" or p_format == "minimal":
                seg = f"{b_grp}{online}↑"
            elif p_format == "standard":
                seg = f"Others {online} online"
            else:
                seg = f"Others: {online} upstream accounts online (no quota data)"
            parts.append(seg)
            tmpl_parts.append(seg)
            group_text = seg

    badge_text = " · ".join(parts) if parts else ("AI Monitor" if has_ok else "AI Offline")
    template = " · ".join(tmpl_parts) if tmpl_parts else badge_text
    icon = theme.get("icon_warn") if has_warning else (theme.get("icon_ok") if has_ok else theme.get("icon_err"))

    return {
        "text": badge_text,
        "template": template,
        "template_vars": cd_vars,
        "panel_accounts": [] if text_badge else panel_accounts,
        "panel_group": {"text": group_text} if group_text else None,
        "show_short": len(panel_accounts) > 1,
        "icon": icon,
        "show_icon": cfg.get("show_icon", True),
        "panel_position": cfg.get("panel_position", "center"),
        "has_warning": has_warning,
        "has_ok": has_ok
    }


def collect_all():
    cfg = load_config()
    theme = get_active_theme(cfg)
    data = {
        "timestamp": int(time.time()),
        "time_str": datetime.datetime.now().strftime("%H:%M:%S"),
        "theme": theme,
        "available_themes": list(THEME_PRESETS.keys()),
        "ui_options": {
            "ui_mode": cfg.get("ui_mode", "notch"),
            "panel_format": cfg.get("panel_format", "compact"),
            "panel_position": cfg.get("panel_position", "center"),
            "show_icon": cfg.get("show_icon", True),
            "show_alerts": cfg.get("show_alerts", True),
            "alert_exhaust_pct": int(cfg.get("alert_exhaust_pct", 95)),
            "alert_warn_pct": int(cfg.get("alert_warn_pct", 85)),
            "show_reset_in_topbar": cfg.get("show_reset_in_topbar", True),
            "poll_interval_sec": cfg.get("poll_interval_sec", 30),
            "account_colors": (cfg.get("appearance") or {}).get("account_colors", []),
        },
        "glm": check_glm(cfg),
        "antigravity": check_antigravity(cfg),
        "codex": check_codex(cfg),
        "nine_router": check_9router(cfg),
        "omniroute": check_omniroute(cfg),
        "openrouter": check_openrouter(cfg),
        "custom_apis": check_custom_apis(cfg)
    }
    data["summary"] = generate_panel_summary(data, cfg, theme)
    return data


def set_theme(theme_name):
    if theme_name not in THEME_PRESETS:
        return False, f"Unknown theme '{theme_name}'. Available: {', '.join(THEME_PRESETS.keys())}"
    cfg = load_config()
    cfg["theme"] = theme_name
    save_config(cfg)
    return True, f"Theme set to '{theme_name}' ({THEME_PRESETS[theme_name]['name']})"


def toggle_router_provider(router_type, provider_name):
    """
    Toggles monitoring for a specific provider in 9router or omniroute.
    """
    cfg = load_config()
    r_key = "nine_router" if "9" in router_type else "omniroute"
    r_cfg = cfg.get("providers", {}).get(r_key, {})
    current_list = list(r_cfg.get("monitored_providers", []))

    if provider_name in current_list:
        current_list.remove(provider_name)
        status = "removed"
    else:
        current_list.append(provider_name)
        status = "added"

    r_cfg["monitored_providers"] = current_list
    cfg["providers"][r_key] = r_cfg
    save_config(cfg)
    return True, f"Provider '{provider_name}' {status} from {r_key} monitor."


def set_option(key, value):
    """
    Sets a UI/behavior option in config.json from the menu or CLI.
    Accepts booleans as 'true'/'false', ints as digits, everything else verbatim.
    """
    bool_keys = {"show_icon", "show_reset_in_topbar", "show_alerts", "text_badge"}
    int_keys = {"poll_interval_sec", "alert_exhaust_pct", "alert_warn_pct"}

    if key not in {"theme", "ui_mode", "panel_format", "panel_position", "poll_interval_sec",
                   "show_reset_in_topbar", "show_icon", "show_alerts",
                   "alert_exhaust_pct", "alert_warn_pct", "text_badge"}:
        return False, f"Unknown option '{key}'"

    if key == "ui_mode" and value not in ("notch", "panel"):
        return False, "ui_mode expects 'notch' or 'panel'"

    if key in bool_keys:
        value = str(value).lower() in ("true", "1", "yes", "on")
    elif key in int_keys:
        try:
            value = int(value)
        except ValueError:
            return False, f"'{key}' expects a number"

    cfg = load_config()
    cfg[key] = value
    save_config(cfg)
    return True, f"{key} = {value}"


def main():
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "--config":
            print(json.dumps(load_config(), indent=2))
            return
        elif cmd == "--summary":
            d = collect_all()
            print(d["summary"]["text"])
            return
        elif cmd == "--set-theme" and len(sys.argv) > 2:
            ok, msg = set_theme(sys.argv[2])
            print(msg)
            sys.exit(0 if ok else 1)
        elif cmd == "--toggle-provider" and len(sys.argv) > 3:
            ok, msg = toggle_router_provider(sys.argv[2], sys.argv[3])
            print(msg)
            sys.exit(0 if ok else 1)
        elif cmd == "--set-option" and len(sys.argv) > 3:
            ok, msg = set_option(sys.argv[2], sys.argv[3])
            print(msg)
            sys.exit(0 if ok else 1)
        elif cmd == "--get-option" and len(sys.argv) > 2:
            cfg = load_config()
            val = cfg.get(sys.argv[2])
            print(json.dumps(val) if isinstance(val, (dict, list)) else val)
            sys.exit(0 if val is not None else 1)

    data = collect_all()
    print(json.dumps(data, indent=2))


if __name__ == "__main__":
    main()
