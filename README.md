# Notch — a living notch for GNOME Shell

**[Website](https://ther12k.github.io/gnome-notch/)** · screenshots, live demo and FAQ.

Inspired by Nusa's visual language: glanceable resting state, rich media hierarchy
and a compact activity surface — adapted to GNOME's hover-to-expand and click-menu
interaction model. The ambient glow, bottom light strip and live equalizer borrow
from [Rav](https://ravdynamicisland.netlify.app/)'s dynamic island.

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
| **Calendar** | today's date | month grid with today highlighted | — |
| **System strip** | — | battery · CPU temp · RAM on every page (each toggleable) | — |
| **Media** (MPRIS) | animated equalizer while playing | artwork, track and artist | previous / play-pause / next |
| **Focus timer** | countdown while active | countdown + progress | start work / break, or stop |
| **Battery** | warning/charging indicator when relevant | percentage + bar | — |
| **AI quota** | one chip per account: label, percentage bar and reset countdown (up to three) | up to three account rows with reset countdowns | — |
| **Google Home** (off by default) | 🏠 N-on chip while devices are active | device states per room | toggle each device · all off |
| **Hydration** (off by default) | — | progress | +250 ml |
| **Idle eyes** | blink and glance when everything is calm | — | — |

Hover opens a compact island capped at 500px wide (narrower on small
monitors). The icon chooser stays fixed at the top while pages flip below
it, and a battery · temp · RAM strip runs along the bottom of every page
(toggle each in the ⚙ Quick settings page). A soft ambient halo and a thin
bottom light strip tint themselves to the live activity — blue for the
clock, amber for AI quota, green while music plays, with a breathing
equalizer in the pill. ◀ ▶ and the labeled
icon chooser move between Overview, Media, Focus, AI, Battery, Google Home,
Calendar, Hydration and Quick settings. Status pages
are read-only; the dedicated **⚙ Quick settings** page provides small module,
style and width toggles. Track controls, focus start/stop, hydration logging,
and device actions are in the click menu. The resting pill shows each AI
account's chip with its own bar and reset countdown; the AI page repeats them
with fuller detail. Click the pill for actions and the full settings menu:
toggle **🧩 Modules**, pick a **🎨 Pill style** — glass droplet (glow border,
default), flat pill, outline or mist — choose **↔ Pill width** (compact / regular /
wide), adjust **↕ Position & Margins** (flush 0px or floating 8px/14px/20px, center),
or simply **click and drag the notch** anywhere across the top of your screen to move it.
Settings live in
`~/.config/gnome-notch/config.json` (`appearance.preset`, `appearance.min_width`,
`appearance.hide_panel`, `appearance.margin_top`, `appearance.offset_x`, `appearance.shape`,
`status_strip.battery/temp/ram`).
Setting `appearance.hide_panel` to `true` (or the **🖥 Hide top bar** button on
the ⚙ page) hides the GNOME top bar entirely so the notch is the only thing
left at the top — the panel returns when the option is switched off or the
extension is disabled. After editing the file, choose **↻ Reload settings** in
the menu. Invalid JSON is
left untouched and the current settings remain active until the file is fixed.
The config editor opens the JSON file through the default file handler.

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
- Hover is intentionally compact and read-only except for the activity pager
  and Quick settings page; media, timer and device actions live in the click menu.
- Screenshots welcome — this box's Wayland session refuses programmatic
  capture.

## License

[MIT](LICENSE) © 2026 Rizky Zulkarnaen
