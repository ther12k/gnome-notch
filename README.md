# Notch — a living notch for GNOME Shell

**[Website](https://ther12k.github.io/gnome-notch/)** · screenshots, live demo and FAQ.

A small, dark droplet pill hangs from the top-center of your screen — a
macOS-style notch for GNOME. It shows the time at a glance, glances back
with a pair of eyes when everything is calm, and springs open into a
compact island when you hover. It steps aside automatically when an app
goes fullscreen.

Inspired by [Nusa](https://rama2555.github.io/nusa/) — a living notch for
Windows. The AI-quota module spun out of my internal AI usage monitor
(aiacctool), which ships `ai-collector.py`.

## What lives in the notch

| Module | Resting pill | Hover island | Click menu |
|---|---|---|---|
| **Clock** | time | date | — |
| **Media** (MPRIS) | play indicator while playing | current track | previous / play-pause / next |
| **Focus timer** | countdown while active | countdown + progress | start work / break, or stop |
| **Battery** | warning/charging indicator when relevant | percentage + bar | — |
| **AI quota** | highest-used account percentage + bar | up to three account rows with reset countdowns | — |
| **Hydration** (off by default) | — | progress | +250 ml |
| **Idle eyes** | blink and glance when everything is calm | — | — |

Hover is a compact, paged island — ◀ ▶ flips between activities (overview,
media, focus, AI, battery, water) with dots showing position; rows stay
read-only and actions live in the click menu. Click the pill for actions and
settings: toggle **🧩 Modules**, pick a **🎨 Pill style** — glass droplet
(glow border, default), flat pill, outline or mist — choose the **↔ Pill width**
(compact / regular / wide), or switch **AI chips in pill** on/off. Settings
live in `~/.config/gnome-notch/config.json` (`appearance.preset`,
`appearance.min_width`); after editing the file, choose
**↻ Reload settings** in the menu to apply changes without restarting GNOME Shell.

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
