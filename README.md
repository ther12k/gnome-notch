# Notch — a living notch for GNOME Shell

A small, dark droplet pill hangs from the top-center of your screen — a
macOS-style notch for GNOME. It shows the time at a glance, glances back
with a pair of eyes when everything is calm, and springs open into a
compact island when you hover. It steps aside automatically when an app
goes fullscreen.

Inspired by [Nusa](https://rama2555.github.io/nusa/) — a living notch for
Windows. The AI-quota module spun out of my internal AI usage monitor
(aiacctool), which ships `ai-collector.py`.

## What lives in the notch

| Module | Pill | Hover island | Menu |
|---|---|---|---|
| **Clock** | big time | date line | — |
| **Media** (MPRIS) | ▶ chip while playing | prev / play-pause / next + track | media controls |
| **Focus timer** | ⏱ countdown chip | progress bar + stop | start focus 25m / break 5m / stop |
| **Battery** | ⚡ / 🔋 chip when charging or low | % + bar | — |
| **AI quota** | ✦ worst % chip | per-account bars + reset countdowns | — |
| **Hydration** (off by default) | — | 💧 progress + quick add | +250 ml |
| **Idle eyes** | blinks and glances when nothing is happening | — | — |

Everything is a module — toggle any of them off from **🧩 Modules** in the
click menu. Settings live in `~/.config/gnome-notch/config.json`.

## Install

```bash
git clone https://github.com/ther12k/gnome-notch.git
cd gnome-notch
./deploy.sh
```

`deploy.sh` copies the extension to
`~/.local/share/gnome-shell/extensions/`, stamps a fresh build so GNOME
Shell's ES-module cache can't serve stale code, and reloads it. On the
**very first install** of a new extension UUID, GNOME Shell only scans the
extensions directory at login — so log out and back in once, then run
`./deploy.sh` again (or `gnome-extensions enable gnome-notch@ther12k`).

Requirements: GNOME Shell 46, `python3` (only for the AI-quota module).

## Notes

- The AI-quota module reads your existing `~/.config/ai-usage-monitor/`
  config if present; otherwise it starts fresh.
- Hover is intentionally compact (read-only glance); all interaction is in
  the click menu.
- Screenshots welcome — this box's Wayland session refuses programmatic
  capture.

## License

[MIT](LICENSE) © 2026 Rizky Zulkarnaen
