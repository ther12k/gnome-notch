// Notch — a living notch for GNOME Shell 46.
//
// A macOS-style droplet pill hangs from the top-center of the screen:
//   resting   → clock + status chips (+ cute eyes when everything is calm)
//   hover     → compact read-only island (media, focus, battery, AI, water)
//   click     → full menu with module toggles and actions
// It steps aside when the primary monitor goes fullscreen.
//
// Layout reference: Nusa (https://rama2555.github.io/nusa/) — a living
// notch for Windows. AI-quota module spun off from aiacctool
// (github.com/ther12k — private) which ships ai-collector.py.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { MprisPlayer } from 'resource:///org/gnome/shell/ui/mpris.js';

/* ---------- constants ---------- */

const ISLAND_MAX_W = 500;
const PAD_X = 16;
const PAD_TOP = 10;
const PAD_BOTTOM = 12;

const FONT = 'font-family: "Inter","Cantarell","Ubuntu Sans",sans-serif;';

/* Pill presets. "glass" is the aiacctool droplet: flat top, rounded
 * bottom, faint white edge (the glow border) and a deep drop shadow.
 * "flat" is a quiet, fully-rounded pill without the border.
 * "outline" keeps the bar nearly transparent with a crisp edge.
 * "mist" is a softer, lighter droplet for subtle wallpapers. */
const PILL_STYLES = {
    glass: {
        base: 'background: rgba(13, 15, 19, 0.90);' +
            'border-radius: 0px 0px 22px 22px;' +
            'border: 1px solid rgba(255, 255, 255, 0.10);' +
            'border-top-width: 0px;' +
            'box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55);',
        hover: 'background: rgba(23, 26, 33, 0.96);' +
            'border-radius: 0px 0px 22px 22px;' +
            'border: 1px solid rgba(255, 255, 255, 0.18);' +
            'border-top-width: 0px;' +
            'box-shadow: 0 12px 30px rgba(0, 0, 0, 0.60);',
        alert: 'background: rgba(20, 17, 12, 0.92);' +
            'border-radius: 0px 0px 22px 22px;' +
            'border: 1px solid rgba(253, 214, 99, 0.32);' +
            'border-top-width: 0px;' +
            'box-shadow: 0 0 24px rgba(253, 214, 99, 0.40);',
    },
    flat: {
        base: 'background: rgba(15, 17, 23, 0.92); border-radius: 17px;' +
            'box-shadow: 0 3px 14px rgba(0, 0, 0, 0.5);',
        hover: 'background: rgba(25, 28, 38, 0.97); border-radius: 17px;' +
            'box-shadow: 0 6px 22px rgba(0, 0, 0, 0.6);',
        alert: 'background: rgba(62, 24, 30, 0.95); border-radius: 17px;' +
            'box-shadow: 0 3px 16px rgba(244, 113, 116, 0.35);',
    },
    outline: {
        base: 'background: rgba(10, 12, 16, 0.45);' +
            'border-radius: 0px 0px 20px 20px;' +
            'border: 1px solid rgba(255, 255, 255, 0.22);' +
            'border-top-width: 0px;' +
            'box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);',
        hover: 'background: rgba(16, 19, 26, 0.75);' +
            'border-radius: 0px 0px 20px 20px;' +
            'border: 1px solid rgba(255, 255, 255, 0.30);' +
            'border-top-width: 0px;' +
            'box-shadow: 0 10px 26px rgba(0, 0, 0, 0.45);',
        alert: 'background: rgba(28, 22, 12, 0.70);' +
            'border-radius: 0px 0px 20px 20px;' +
            'border: 1px solid rgba(253, 214, 99, 0.45);' +
            'border-top-width: 0px;' +
            'box-shadow: 0 0 20px rgba(253, 214, 99, 0.35);',
    },
    mist: {
        base: 'background: rgba(13, 15, 19, 0.62);' +
            'border-radius: 0px 0px 26px 26px;' +
            'border: 1px solid rgba(255, 255, 255, 0.07);' +
            'border-top-width: 0px;' +
            'box-shadow: 0 8px 22px rgba(0, 0, 0, 0.40);',
        hover: 'background: rgba(20, 23, 30, 0.86);' +
            'border-radius: 0px 0px 26px 26px;' +
            'border: 1px solid rgba(255, 255, 255, 0.14);' +
            'border-top-width: 0px;' +
            'box-shadow: 0 12px 28px rgba(0, 0, 0, 0.50);',
        alert: 'background: rgba(26, 21, 15, 0.80);' +
            'border-radius: 0px 0px 26px 26px;' +
            'border: 1px solid rgba(253, 214, 99, 0.28);' +
            'border-top-width: 0px;' +
            'box-shadow: 0 0 18px rgba(253, 214, 99, 0.30);',
    },
};

const T = {
    ok: '#3fd68f',
    warn: '#f5b455',
    err: '#f47174',
    accent: '#7ab8ff',
    text: '#e8eaed',
    muted: 'rgba(232, 234, 237, 0.55)',
};

const ACCOUNT_COLORS = ['#7ab8ff', '#b59aff', '#3fd68f', '#f5b455', '#ff9ecb', '#6fd9e8'];

// per-activity accent used by the island's page-icon chooser
const PAGE_HUES = {
    overview: '#7ab8ff',
    media: '#3fd68f',
    focus: '#b59aff',
    ai: '#f5b455',
    ghome: '#6fd9e8',
    battery: '#3fd68f',
    water: '#7ab8ff',
    calendar: '#7ab8ff',
    config: '#ff9ecb',
};

const PAGE_NAMES = {
    overview: 'Overview', media: 'Media', focus: 'Focus timer', ai: 'AI quota',
    ghome: 'Google Home', battery: 'Battery', water: 'Hydration',
    calendar: 'Calendar', config: 'Quick settings',
};

const CONFIG_DIR = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'gnome-notch']);
const CONFIG_PATH = GLib.build_filenamev([CONFIG_DIR, 'config.json']);

const DEFAULT_CONFIG = {
    modules: {
        media: true,
        focus: true,
        battery: true,
        ai: true,
        ghome: false,
        water: false,
        eyes: true,
    },
    clock_24h: true,
    pill_mode: 'ai',            // 'ai' = GLM chips like aiacctool, 'clock' = clock-first
    appearance: { preset: 'glass', min_width: 260, hide_panel: false },
    focus: { work_min: 25, break_min: 5 },
    water_goal_ml: 2000,
    water: { date: '', ml: 0 },
    ai: { poll_sec: 30, warn_pct: 85, exhaust_pct: 95 },
    // battery · temp · ram strip shown on every island page
    status_strip: { battery: true, temp: true, ram: true },
};

/* ---------- config ---------- */

function _merge(base, over) {
    if (Array.isArray(base) || typeof base !== 'object' || base === null)
        return over === undefined ? base : over;
    if (!over || typeof over !== 'object' || Array.isArray(over))
        over = {};
    const out = {};
    for (const k of Object.keys(base)) out[k] = _merge(base[k], over[k]);
    for (const k of Object.keys(over)) if (!(k in out)) out[k] = over[k];
    return out;
}

function readConfig() {
    const [ok, raw] = GLib.file_get_contents(CONFIG_PATH);
    if (!ok)
        throw new Error('settings file could not be read');
    const parsed = JSON.parse(new TextDecoder().decode(raw));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object')
        throw new Error('settings must be a JSON object');
    return _merge(DEFAULT_CONFIG, parsed);
}

function loadConfig() {
    try {
        return readConfig();
    } catch (e) {
        log(`[Notch] config load failed, using defaults: ${e}`);
        const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        if (!Gio.File.new_for_path(CONFIG_PATH).query_exists(null))
            saveConfig(cfg);
        return cfg;
    }
}

function saveConfig(cfg) {
    try {
        GLib.mkdir_with_parents(CONFIG_DIR, 0o755);
        GLib.file_set_contents(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    } catch (e) {
        log(`[Notch] config save failed: ${e}`);
    }
}

/* ---------- helpers ---------- */

function _trunc(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function _nowLocal() {
    return GLib.DateTime.new_now_local();
}

// Wall-clock time of a reset moment: "18:04" today, "Tue 03:00" on later days.
function _resetClockText(ms) {
    if (!ms)
        return '';
    const dt = GLib.DateTime.new_from_unix_local(Math.floor(ms / 1000));
    return ms - Date.now() >= 86400000 ? dt.format('%a %H:%M') : dt.format('%H:%M');
}

function _ghomeIcon(type) {
    switch (type) {
        case 'light': return '💡';
        case 'socket': return '🔌';
        case 'switch': return '🔘';
        case 'thermostat': return '🌡️';
        default: return '🏠';
    }
}

// '#7ab8ff' → 'rgba(122,184,255,0.3)' for glow tints
function _hexA(hex, a) {
    const h = String(hex).replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(h))
        return String(hex);   // already rgba()/named — pass through unchanged
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
}

// Accounts to surface everywhere (pill + island). summary.panel_accounts is
// the primary source, but aiacctool's text_badge mode empties it — fall back
// to glm.accounts so the notch always has structured chips.
function _panelAccounts(data) {
    if (!data)
        return [];
    const s = data.summary || {};
    if (s.panel_accounts && s.panel_accounts.length)
        return s.panel_accounts;
    const glm = data.glm || {};
    return (glm.accounts || [])
        .filter(a => a.status === 'ok' && a.token_quota &&
            a.token_quota.used_pct !== null && a.token_quota.used_pct !== undefined)
        .map(a => ({
            name: a.name,
            short: a.short || String(a.name || 'glm').slice(0, 7),
            used_pct: a.token_quota.used_pct,
            reset_ms: a.token_quota.reset_ms,
        }));
}

function _usedColor(pct) {
    if (pct === null || pct === undefined) return T.muted;
    if (pct >= 95) return T.err;
    if (pct >= 80) return T.warn;
    return T.ok;
}

/* ---------- MPRIS media watcher ---------- */

const MPRIS_PREFIX = 'org.mpris.MediaPlayer2.';
const DBUS_IFACE_XML =
    '<node><interface name="org.freedesktop.DBus">' +
    '<method name="ListNames"><arg type="as" direction="out"/></method>' +
    '<signal name="NameOwnerChanged"><arg type="s"/><arg type="s"/><arg type="s"/></signal>' +
    '</interface></node>';
const DBusProxy = Gio.DBusProxy.makeProxyWrapper(DBUS_IFACE_XML);

class MediaWatcher {
    constructor(onChange) {
        this._players = new Map();
        this._onChange = onChange;
        this._proxy = new DBusProxy(Gio.DBus.session, 'org.freedesktop.DBus',
            '/org/freedesktop/DBus', (p, err) => {
                if (err) {
                    log(`[Notch] DBus proxy failed: ${err}`);
                    return;
                }
                this._ready();
            });
    }

    async _ready() {
        try {
            const [names] = await this._proxy.ListNamesAsync();
            names.forEach(n => {
                if (n.startsWith(MPRIS_PREFIX))
                    this._add(n);
            });
        } catch (e) {
            log(`[Notch] ListNames failed: ${e}`);
        }
        this._proxy.connectSignal('NameOwnerChanged', (_, __, [name, oldO, newO]) => {
            if (!name.startsWith(MPRIS_PREFIX))
                return;
            if (newO && !oldO)
                this._add(name);
        });
        this._onChange();
    }

    _add(busName) {
        if (this._players.has(busName))
            return;
        const player = new MprisPlayer(busName);
        player.connect('changed', () => this._onChange());
        player.connect('closed', () => {
            this._players.delete(busName);
            this._onChange();
        });
        this._players.set(busName, player);
    }

    // Prefer whichever player is actively playing, else the first one.
    get active() {
        let first = null;
        for (const p of this._players.values()) {
            if (p.status === 'Playing')
                return p;
            if (!first)
                first = p;
        }
        return first;
    }

    destroy() {
        this._players.clear();
    }
}

/* ---------- the notch bar ---------- */

// deployed as impl-<timestamp>.js; the stamp keeps the GType name unique
// across hot-reloads within one shell session
const _IMPL_STAMP = (import.meta.url.match(/impl-(\d+)\.js$/) || [])[1] || 'src';

const NotchBar = GObject.registerClass(
{ GTypeName: `NotchBar_${_IMPL_STAMP}` },
class NotchBar extends PanelMenu.Button {
    _init(app) {
        super._init(0.5, 'Notch');
        this._app = app;

        this.set_style(PILL_STYLES.glass.base);
        this._hovered = false;
        this._expanded = false;
        this._hoverTimer = 0;
        this._alert = false;
        this._collapsedH = 30;
        this._lastSig = null;

        this._clockLbl = null;
        this._cdLabels = [];        // live countdown labels [{label, ms}]
        this._islandCd = [];        // island-page countdown labels
        this._islandPage = 0;       // which island activity page is shown
        this._islandKind = null;    // its kind ('overview', 'media', …)
        this._eyes = [];            // eye actors (blink loop pokes them)
        this._blinkTimer = 0;
        this._glanceTimer = 0;

        // Surface: fixed-layout container; children positioned manually
        this._surface = new St.Widget();
        this.add_child(this._surface);

        // Rav-inspired ambient halo behind the pill plus a thin light strip
        // on the bottom edge; both tinted by the live activity and breathing
        // slowly (_scheduleAmbientBreath). Non-reactive so they never eat
        // hover or click events.
        this._ambHue = T.accent;
        this._ambUp = false;
        this._ambTimer = 0;
        this._eqTimers = [];
        this._ambGlow = new St.Widget({ reactive: false, opacity: 100 });
        this._lightStrip = new St.Widget({ reactive: false, opacity: 140 });
        this._surface.add_child(this._ambGlow);
        this._surface.add_child(this._lightStrip);
        this._setAmbientHue(T.accent);

        this._collapsedBox = new St.BoxLayout({
            style: 'spacing: 9px;',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._surface.add_child(this._collapsedBox);

        this._expandedBox = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 4px;',
        });
        this._expandedBox.hide();
        this._surface.add_child(this._expandedBox);

        this.connect('enter-event', () => {
            this._hovered = true;
            this._applyPillStyle();
            this._scheduleExpand();
        });
        this.connect('leave-event', () => {
            this._hovered = false;
            this._applyPillStyle();
            this._scheduleCollapse();
        });
        this.menu.connect('open-state-changed', (_, open) => {
            if (open)
                this._buildMenu();
            else if (!this.hover)
                this._scheduleCollapse();
        });
        this.connect('notify::width', () => this._recenter());
        this.connect('destroy', () => {
            this._cancelHoverTimers();
            this._cancelEyeTimers();
            this._cancelAmbTimer();
            this._cancelEq();
        });

        this._scheduleBlink();
        this._scheduleGlance();
        this._scheduleAmbientBreath();
    }

    attach() {
        // PanelMenu.Button (ButtonBox) wraps itself in a container St.Bin;
        // clutter add_child refuses parented actors, so release the bin's
        // child first or addChrome silently fails and nothing shows.
        if (this.container && this.get_parent() === this.container)
            this.container.child = null;
        Main.layoutManager.addChrome(this, { affectsInputRegion: true });
        if (Main.panel.menuManager)
            Main.panel.menuManager.addMenu(this.menu);
        this._monChangedId = Main.layoutManager.connect('monitors-changed', () => this._syncMetrics());
        this._fsId = global.display.connect('in-fullscreen-changed', () => this._updateFullscreen());
        this._syncMetrics();
        this._updateFullscreen();
    }

    detach() {
        this._cancelHoverTimers();
        this._cancelEyeTimers();
        if (this._monChangedId) {
            Main.layoutManager.disconnect(this._monChangedId);
            this._monChangedId = 0;
        }
        if (this._fsId) {
            global.display.disconnect(this._fsId);
            this._fsId = 0;
        }
        if (Main.panel.menuManager)
            Main.panel.menuManager.removeMenu(this.menu);
        try {
            Main.layoutManager.removeChrome(this);
        } catch (e) { /* already gone */ }
        this.destroy();
    }

    vfunc_event(event) {
        // PanelMenu.Button toggles the menu on BUTTON_PRESS; sprout the
        // island first so the menu anchors to the expanded size.
        if (event.type() === Clutter.EventType.BUTTON_PRESS)
            this._expand();
        return super.vfunc_event(event);
    }

    /* ---------- fullscreen ---------- */

    _updateFullscreen() {
        const m = Main.layoutManager.primaryMonitor;
        const fs = m ? global.display.get_monitor_in_fullscreen(m.index) : false;
        this.visible = !fs;
    }

    /* ---------- geometry ---------- */

    _syncMetrics() {
        this._collapsedH = Math.max(26, Main.panel ? Main.panel.height : 30);
        if (!this._expanded)
            this._applyRestingSize();
        this._recenter();
    }

    _pillMinW() {
        return Math.max(180, (this._app.cfg.appearance || {}).min_width || 260);
    }

    _maxIslandWidth() {
        const monitor = Main.layoutManager.primaryMonitor;
        const available = monitor ? Math.max(220, monitor.width - 24) : ISLAND_MAX_W;
        return Math.min(ISLAND_MAX_W, available);
    }

    /* ---------- ambient halo / light strip (Rav-inspired) ---------- */

    _cancelAmbTimer() {
        if (this._ambTimer) {
            GLib.source_remove(this._ambTimer);
            this._ambTimer = 0;
        }
    }

    _cancelEq() {
        this._eqTimers.forEach(t => {
            if (t)
                GLib.source_remove(t);
        });
        this._eqTimers = [];
        if (this._ambGlow)
            this._ambGlow.scale_x = this._ambGlow.scale_y = 1;
    }

    _ambientHueFor(kind) {
        return this._alert ? T.err : (PAGE_HUES[kind] || T.accent);
    }

    _setAmbientHue(hex) {
        this._ambHue = hex;
        this._ambGlow.style = `background-color: ${_hexA(hex, 0.03)};` +
            `border-radius: 26px; box-shadow: 0 0 14px 2px ${_hexA(hex, 0.16)};`;
        this._lightStrip.style = `border-radius: 2px;` +
            `background-gradient-direction: horizontal;` +
            `background-gradient-start: ${hex};` +
            `background-gradient-end: #b59aff;` +
            `box-shadow: 0 0 5px ${_hexA(hex, 0.30)};`;
    }

    // slow breathing of the halo and strip — kept subtle so the notch
    // glows softly rather than shining
    _scheduleAmbientBreath() {
        this._cancelAmbTimer();
        const step = () => {
            this._ambUp = !this._ambUp;
            const hi = this._ambUp;
            this._ambGlow.ease({
                opacity: hi ? 135 : 85, duration: 1500,
                mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
            });
            this._lightStrip.ease({
                opacity: hi ? 185 : 120, duration: 1500,
                mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
            });
            return GLib.SOURCE_CONTINUE;
        };
        step();
        this._ambTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, step);
    }

    // keep the halo and light strip hugging the pill / island edges
    _layoutAmbient(dur, w = this.width, h = this.height) {
        const open = this._expanded;
        const pad = open ? 46 : 22;
        const top = open ? -14 : -8;
        const gw = w + pad * 2;
        const gh = h - top + (open ? 26 : 14);
        const sw = Math.max(0, w - 28);
        if (dur > 0) {
            this._ambGlow.ease({
                x: -pad, y: top, width: gw, height: gh,
                duration: dur, mode: Clutter.AnimationMode.EASE_OUT_SINE,
            });
            this._lightStrip.ease({
                x: 14, y: h - 3, width: sw, height: 2,
                duration: dur, mode: Clutter.AnimationMode.EASE_OUT_SINE,
            });
        } else {
            this._ambGlow.set_position(-pad, top);
            this._ambGlow.set_size(gw, gh);
            this._lightStrip.set_position(14, h - 3);
            this._lightStrip.set_size(sw, 2);
        }
    }

    /* animated equalizer bars while music plays (sine-driven like Rav).
     * Each group owns its timer: the pill and an island page can both
     * have live EQ groups at the same time. */
    _makeEq(color) {
        const box = new St.BoxLayout({
            style: 'spacing: 2px;',
            y_align: Clutter.ActorAlign.CENTER,
        });
        const bars = [];
        for (let i = 0; i < 3; i++) {
            const bar = new St.Widget({
                style: `width: 3px; height: 13px; border-radius: 2px;` +
                    `background-color: ${color}; box-shadow: 0 0 6px ${_hexA(color, 0.6)};`,
            });
            bar.set_pivot_point(0.5, 1.0);
            bar.set_scale(1, 0.5);
            bars.push(bar);
            box.add_child(bar);
        }
        const timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            const t = Date.now() / 1000;
            bars.forEach((b, i) => {
                b.scale_y = 0.25 + 0.75 * (0.5 + 0.5 *
                    Math.sin(t * (9 + i * 3.7) + i * 1.9));
            });
            return GLib.SOURCE_CONTINUE;
        });
        this._eqTimers.push(timer);
        return box;
    }

    _applyRestingSize() {
        // measure the content at natural size first so new chips widen the
        // pill, then pin the box to the full inner width so the spacer can
        // push the clock to the right edge
        this._collapsedBox.set_width(-1);
        const [, natW] = this._collapsedBox.get_preferred_width(-1);
        const [, natH] = this._collapsedBox.get_preferred_height(natW);
        const targetW = Math.min(this._maxIslandWidth(),
            Math.max(this._pillMinW(), natW + 2 * PAD_X));
        this.set_size(targetW, this._collapsedH);
        this._layoutAmbient(0, targetW, this._collapsedH);
        this._collapsedBox.set_width(targetW - 2 * PAD_X);
        this._collapsedBox.set_position(PAD_X,
            Math.max(0, Math.round((this._collapsedH - natH) / 2)));
    }

    _recenter() {
        const m = Main.layoutManager.primaryMonitor;
        if (!m)
            return;
        this.set_position(Math.round(m.x + (m.width - this.width) / 2), 0);
    }

    /* ---------- expand / collapse ---------- */

    _cancelHoverTimers() {
        if (this._hoverTimer) {
            GLib.source_remove(this._hoverTimer);
            this._hoverTimer = 0;
        }
    }

    _scheduleExpand() {
        this._cancelHoverTimers();
        if (this._expanded)
            return;
        this._hoverTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 110, () => {
            this._hoverTimer = 0;
            this._expand();
            return GLib.SOURCE_REMOVE;
        });
    }

    _scheduleCollapse() {
        this._cancelHoverTimers();
        if (!this._expanded || this.menu.isOpen)
            return;
        this._hoverTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 340, () => {
            this._hoverTimer = 0;
            this._collapse();
            return GLib.SOURCE_REMOVE;
        });
    }

    _expand() {
        if (this._expanded)
            return;
        this._cancelHoverTimers();
        this._expanded = true;
        this._expandedBox.set_position(PAD_X, PAD_TOP);
        this._expandedBox.show();
        this._expandedBox.opacity = 0;
        this._collapsedBox.ease({
            opacity: 0, duration: 110, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
        this._expandedBox.ease({
            opacity: 255, duration: 280, delay: 110,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
        // Compact island: never wider than the cap (or the pill itself),
        // content-sized height — slim rows, not a dashboard.
        this._expandedBox.set_width(-1);
        const [, natW] = this._expandedBox.get_preferred_width(-1);
        const targetW = Math.max(this.width,
            Math.min(natW + 2 * PAD_X, this._maxIslandWidth()));
        const innerW = targetW - 2 * PAD_X;
        this._expandedBox.set_width(innerW);
        // rebuild the pager now that the island has its real width, so the
        // page fills the space between the arrows instead of hugging the left
        this._renderIsland();
        const [, natH] = this._expandedBox.get_preferred_height(innerW);
        this._layoutAmbient(300, targetW, natH + PAD_TOP + PAD_BOTTOM);
        this.ease({
            width: targetW,
            height: natH + PAD_TOP + PAD_BOTTOM,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_BACK,
        });
    }

    _collapse() {
        if (!this._expanded || this.menu.isOpen)
            return;
        this._cancelHoverTimers();
        this._expanded = false;
        this._expandedBox.ease({
            opacity: 0, duration: 130, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
        const [, natW] = this._collapsedBox.get_preferred_width(-1);
        const [, natH] = this._collapsedBox.get_preferred_height(natW);
        const restW = Math.min(this._maxIslandWidth(),
            Math.max(this._pillMinW(), natW + 2 * PAD_X));
        this._layoutAmbient(260, restW, this._collapsedH);
        this.ease({
            width: restW,
            height: this._collapsedH,
            duration: 260,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            onStopped: () => {
                if (this._expanded)
                    return;   // re-hovered mid-collapse; new ease owns state
                // Deterministic reset so no stale layer can linger.
                this._expandedBox.hide();
                this._expandedBox.set_width(-1);
                this._collapsedBox.opacity = 255;
                this._applyRestingSize();
            },
        });
    }

    _applyPillStyle() {
        const preset = PILL_STYLES[(this._app.cfg.appearance || {}).preset] ||
            PILL_STYLES.glass;
        this.set_style(this._alert ? preset.alert
            : (this._hovered ? preset.hover : preset.base));
    }

    /* ---------- rendering ---------- */

    // Rebuild both layers only when something meaningful changed; the clock
    // and countdowns tick in place so the eyes animation is never disturbed.
    render() {
        const sig = this._stateSig();
        if (sig === this._lastSig)
            return;
        this._lastSig = sig;
        this._renderCollapsed();
        this._renderIsland();
        if (!this._expanded)
            this._applyRestingSize();
    }

    _stateSig() {
        const st = this._app.state;
        const p = st.media;
        const f = st.focus;
        const media = p ? [p.trackTitle, p.trackArtists, p.status] : null;
        const focus = [f.phase, f.phase !== 'idle' ? Math.ceil(f.endsAt / 30000) : 0];
        const ai = st.ai ? _panelAccounts(st.ai)
            .map(a => `${a.short}:${Math.round(a.used_pct)}:${a.reset_ms}`) : null;
        const bat = st.battery ? [st.battery.pct, st.battery.charging] : null;
        const sys = st.sys ? [Math.round(st.sys.ram_pct || 0),
            Math.round(st.sys.temp_c || 0)] : null;
        const gh = st.ghome ? [
            (st.ghome.summary || {}).active_count || 0,
            (st.ghome.devices || []).map(d => `${d.name}:${d.state}`).join(','),
        ] : null;
        return JSON.stringify([this._app.cfgVersion, media, focus, ai, bat, sys,
            gh, st.water ? [st.water.date, st.water.ml] : null, this._dayStr()]);
    }

    _dayStr() {
        return _nowLocal().format('%Y-%m-%d');
    }

    _renderCollapsed() {
        const app = this._app;
        const st = app.state;
        const mods = app.cfg.modules;

        this._cancelEq();
        this._collapsedBox.destroy_all_children();
        this._cdLabels = [];
        this._eyes = [];
        const aiAccounts = _panelAccounts(st.ai);
        const worst = aiAccounts.reduce((m, a) => Math.max(m, a.used_pct || 0), 0);
        const batteryLow = st.battery && !st.battery.charging && st.battery.pct <= 20;
        const batteryCharging = st.battery && st.battery.charging;
        const focusRunning = st.focus.phase !== 'idle';
        const mediaPlaying = !!st.media && st.media.status === 'Playing';

        const aiWarn = mods.ai && aiAccounts.length > 0 &&
            ((st.ai.summary && st.ai.summary.has_warning) ||
                worst >= app.cfg.ai.warn_pct);
        this._alert = aiWarn || batteryLow;
        this._applyPillStyle();

        // The pill mirrors the island's selected activity; when the selected
        // page has nothing to show, fall back to the overview (AI summary or
        // the calm eyes).
        let mode = this._islandKind || 'overview';
        if ((mode === 'media' && (!mods.media || !st.media)) ||
            (mode === 'focus' && (!mods.focus || !focusRunning)) ||
            (mode === 'battery' && (!mods.battery || !st.battery)) ||
            (mode === 'ghome' && (!mods.ghome || !st.ghome)) ||
            (mode === 'water' && !mods.water) || mode === 'config' ||
            (mode === 'ai' && !(mods.ai && aiAccounts.length)))
            mode = 'overview';

        const aiMode = (mode === 'overview' || mode === 'ai') &&
            app.cfg.pill_mode !== 'clock' &&
            mods.ai && aiAccounts.length > 0;

        // ambient halo + light strip follow the live activity's hue
        this._pillKind = aiMode ? 'ai' : mode;
        this._setAmbientHue(this._ambientHueFor(
            this._expanded ? (this._islandKind || this._pillKind) : this._pillKind));

        if (mode === 'media') {
            if (mediaPlaying) {
                // live equalizer while a track plays
                this._collapsedBox.add_child(this._makeEq(T.ok));
            } else {
                this._collapsedBox.add_child(new St.Widget({
                    style: `width: 7px; height: 7px; border-radius: 4px;` +
                        `background-color: ${T.muted}; box-shadow: 0 0 7px ${T.muted}; margin-left: 2px;`,
                    y_align: Clutter.ActorAlign.CENTER,
                }));
            }
            this._collapsedBox.add_child(new St.Label({
                text: `${mediaPlaying ? '▶' : '⏸'}  ${_trunc(st.media.trackTitle || 'Untitled', 22)}`,
                y_align: Clutter.ActorAlign.CENTER,
                style: `${FONT}font-size: 12.5px; font-weight: 700; color: ${T.text};`,
            }));
        } else if (mode === 'focus') {
            const work = st.focus.phase === 'work';
            this._collapsedBox.add_child(new St.Label({
                text: work ? '🎯' : '☕',
                y_align: Clutter.ActorAlign.CENTER,
                style: 'font-size: 12px;',
            }));
            const lbl = new St.Label({
                text: app.focusClockText(),
                y_align: Clutter.ActorAlign.CENTER,
                style: `${FONT}font-size: 13px; font-weight: 700; color: ${work ? T.accent : T.ok};`,
            });
            this._focusPillLbl = lbl;
            this._collapsedBox.add_child(lbl);
        } else if (mode === 'ghome') {
            const s = st.ghome.summary || {};
            this._collapsedBox.add_child(new St.Label({
                text: s.has_active ? `🏠  ${s.active_count} on` : '🏠  all off',
                y_align: Clutter.ActorAlign.CENTER,
                style: `${FONT}font-size: 12.5px; font-weight: 700; color: ${s.has_active ? T.ok : T.muted};`,
            }));
        } else if (mode === 'battery') {
            this._collapsedBox.add_child(new St.Label({
                text: `${batteryCharging ? '⚡' : '🔋'}  ${st.battery.pct}%`,
                y_align: Clutter.ActorAlign.CENTER,
                style: `${FONT}font-size: 12.5px; font-weight: 700; color: ${batteryLow ? T.warn : T.ok};`,
            }));
        } else if (mode === 'water') {
            const w = st.water || { ml: 0 };
            this._collapsedBox.add_child(new St.Label({
                text: `💧  ${w.ml} / ${app.cfg.water_goal_ml} ml`,
                y_align: Clutter.ActorAlign.CENTER,
                style: `${FONT}font-size: 12.5px; font-weight: 700; color: ${T.accent};`,
            }));
        } else if (mode === 'calendar') {
            this._collapsedBox.add_child(new St.Label({
                text: `📅  ${_nowLocal().format('%b %e')}`,
                y_align: Clutter.ActorAlign.CENTER,
                style: `${FONT}font-size: 12.5px; font-weight: 700; color: ${T.text};`,
            }));
        } else if (aiMode) {
            const th = app.cfg.ai;
            const dotColor = worst >= th.exhaust_pct ? T.err
                : (aiWarn ? T.warn : T.ok);
            this._collapsedBox.add_child(new St.Widget({
                style: `width: 7px; height: 7px; border-radius: 4px;` +
                    `background-color: ${dotColor}; box-shadow: 0 0 7px ${dotColor}; margin-left: 2px;`,
                y_align: Clutter.ActorAlign.CENTER,
            }));

            // aiacctool-style: one chip per account (label + bar + reset),
            // so both bars show by default
            aiAccounts.slice(0, 3).forEach((a, i) => {
                const pct = Math.round(a.used_pct);
                const exhausted = a.used_pct >= th.exhaust_pct;
                const color = exhausted ? T.err
                    : ACCOUNT_COLORS[i % ACCOUNT_COLORS.length];
                const chip = new St.BoxLayout({
                    y_align: Clutter.ActorAlign.CENTER,
                    style: 'spacing: 6px;',
                });
                const tag = a.short ? `${String(a.short).slice(0, 7)} ` : '';
                chip.add_child(new St.Label({
                    text: `✦${tag}${pct}%`,
                    y_align: Clutter.ActorAlign.CENTER,
                    style: `${FONT}font-size: 12.5px; font-weight: 700; color: ${color};`,
                }));
                chip.add_child(this._miniBar(pct, _usedColor(pct), 40));
                if (a.reset_ms) {
                    const cd = new St.Label({
                        text: `↻ ${app.fmtCountdown(a.reset_ms - Date.now(), true)}`,
                        y_align: Clutter.ActorAlign.CENTER,
                        style: `${FONT}font-size: 11.5px; font-weight: 700; color: ${T.text};`,
                    });
                    this._cdLabels.push({ label: cd, until: a.reset_ms, clock: false });
                    chip.add_child(cd);
                }
                this._collapsedBox.add_child(chip);
            });
            if (aiAccounts.length > 3)
                this._collapsedBox.add_child(new St.Label({
                    text: `+${aiAccounts.length - 3}`,
                    y_align: Clutter.ActorAlign.CENTER,
                    style: `${FONT}font-size: 10px; color: ${T.muted};`,
                }));
        } else {
            /* clock-first pill: eyes when calm, else a status dot */
            if (this._alert) {
                this._collapsedBox.add_child(new St.Widget({
                    style: `width: 8px; height: 8px; border-radius: 4px;` +
                        `background-color: ${T.err}; box-shadow: 0 0 8px ${T.err}; margin-left: 2px;`,
                    y_align: Clutter.ActorAlign.CENTER,
                }));
            } else if (mods.eyes && !mediaPlaying && !focusRunning) {
                this._collapsedBox.add_child(this._makeEyes());
            } else {
                const playing = mediaPlaying ? T.ok : T.muted;
                this._collapsedBox.add_child(new St.Widget({
                    style: `width: 8px; height: 8px; border-radius: 4px;` +
                        `background-color: ${playing}; box-shadow: 0 0 8px ${playing}; margin-left: 2px;`,
                    y_align: Clutter.ActorAlign.CENTER,
                }));
            }
        }

        /* transient chips for whatever the main area didn't cover */
        const chips = new St.BoxLayout({
            style: 'spacing: 8px;',
            y_align: Clutter.ActorAlign.CENTER,
        });

        if (mode === 'overview' && !aiMode && mods.media && mediaPlaying)
            chips.add_child(this._makeEq(T.ok));

        if (mode !== 'focus' && mods.focus && focusRunning) {
            const work = st.focus.phase === 'work';
            const lbl = new St.Label({
                text: app.focusClockText(),
                y_align: Clutter.ActorAlign.CENTER,
                style: `${FONT}font-size: 12.5px; font-weight: 700; color: ${work ? T.accent : T.ok};`,
            });
            this._focusPillLbl = lbl;
            chips.add_child(lbl);
        } else if (mode !== 'focus') {
            this._focusPillLbl = null;
        }

        if ((mode === 'overview' || mode === 'media') && !aiMode && mods.ai &&
            aiAccounts.length) {
            chips.add_child(new St.Label({
                text: `✦ ${Math.round(worst)}%`,
                y_align: Clutter.ActorAlign.CENTER,
                style: `${FONT}font-size: 11.5px; font-weight: 700; color: ${_usedColor(worst)};`,
            }));
        }

        if (mode !== 'battery' && st.battery &&
            (app.cfg.appearance.hide_panel || batteryCharging || batteryLow)) {
            chips.add_child(new St.Label({
                text: `${batteryCharging ? '⚡' : '🔋'} ${st.battery.pct}%`,
                y_align: Clutter.ActorAlign.CENTER,
                style: `${FONT}font-size: 11.5px; font-weight: 700; color: ${batteryLow ? T.warn : (st.battery.pct >= 95 ? T.ok : T.text)};`,
            }));
        }

        if (mode !== 'ghome' && !aiMode && mods.ghome && st.ghome &&
            st.ghome.summary && st.ghome.summary.has_active)
            chips.add_child(new St.Label({
                text: `🏠 ${st.ghome.summary.active_count}`,
                y_align: Clutter.ActorAlign.CENTER,
                style: `${FONT}font-size: 11.5px; font-weight: 700; color: ${T.ok};`,
            }));

        if (chips.get_children().length > 0)
            this._collapsedBox.add_child(chips);

        /* clock, anchored to the right edge of the pill */
        this._collapsedBox.add_child(new St.Widget({ x_expand: true }));
        this._clockLbl = new St.Label({
            text: app.clockText(),
            y_align: Clutter.ActorAlign.CENTER,
            style: `${FONT}font-size: 13.5px; font-weight: 700; color: ${T.text}; margin-right: 3px;`,
        });
        this._collapsedBox.add_child(this._clockLbl);
    }

    _makeEyes() {
        const box = new St.BoxLayout({
            style: 'spacing: 5px; margin-left: 2px;',
            y_align: Clutter.ActorAlign.CENTER,
        });
        for (let i = 0; i < 2; i++) {
            const eye = new St.Widget({
                style: `width: 13px; height: 9px; border-radius: 5px;` +
                    `background-color: rgba(232, 234, 237, 0.9);`,
            });
            const pupil = new St.Widget({
                style: 'width: 4px; height: 4px; border-radius: 2px;' +
                    'background-color: #14161c;',
            });
            pupil.set_position(4, 2);
            eye.add_child(pupil);
            eye._pupil = pupil;
            this._eyes.push(eye);
            box.add_child(eye);
        }
        return box;
    }

    /* Compact hover island, paged Nusa-style: ◀ ▶ flip between activities,
     * dots show which page you're on. Rows stay read-only; actions live in
     * the click menu. */
    _renderIsland() {
        const app = this._app;
        const st = app.state;

        // page builds may have created EQ bars; their timer references dead
        // actors after this teardown, so stop it before rebuilding
        this._cancelEq();
        this._expandedBox.destroy_all_children();
        this._islandCd = [];
        this._focusRowLbl = null;

        const pages = this._islandPages();
        if (pages.length === 0) {
            this._expandedBox.add_child(new St.Label({
                text: 'all quiet',
                style: `${FONT}font-size: 10.5px; color: ${T.muted};`,
            }));
            return;
        }
        // keep the selected activity stable across page-list changes (a
        // player quitting shifts indices; the kind survives)
        let idx = pages.findIndex(p => p.kind === this._islandKind);
        if (idx < 0)
            idx = Math.min(this._islandPage, pages.length - 1);
        this._islandPage = idx;
        this._islandKind = pages[idx].kind;

        if (pages.length === 1) {
            this._expandedBox.add_child(pages[this._islandPage].build());
            const strip = this._buildStatusStrip();
            if (strip)
                this._expandedBox.add_child(strip);
            return;
        }

        // header: ◀ ▶ plus the icon chooser, fixed at the top so it stays
        // in place no matter which page is showing
        const header = new St.BoxLayout({
            style: 'spacing: 8px;',
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        header.add_child(this._pageBtn('◀', () => this._turnIslandPage(-1)));

        const pickScroll = new St.ScrollView({
            style: 'min-height: 31px; max-height: 31px;',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.NEVER,
            enable_mouse_scrolling: true,
            x_expand: true,
        });
        const pick = new St.BoxLayout({
            style: 'spacing: 4px;',
            x_align: Clutter.ActorAlign.CENTER,
        });
        pages.forEach((p, i) => {
            const name = PAGE_NAMES[p.kind] || p.kind;
            const btn = this._glowBtn(p.icon,
                PAGE_HUES[p.kind] || T.accent, i === this._islandPage,
                () => this._gotoIslandPage(i), 28);
            btn.set_accessible_name(name);
            pick.add_child(btn);
        });
        pickScroll.set_child(pick);
        pickScroll.connect('scroll-event', (_, event) => {
            const hadj = pickScroll.hadjustment;
            let delta = 0;
            switch (event.get_scroll_direction()) {
            case Clutter.ScrollDirection.LEFT:
                delta = -hadj.step_increment;
                break;
            case Clutter.ScrollDirection.RIGHT:
                delta = hadj.step_increment;
                break;
            case Clutter.ScrollDirection.SMOOTH: {
                const [dx] = event.get_scroll_delta();
                delta = dx * hadj.step_increment;
                break;
            }
            default:
                break;
            }
            if (!delta)
                return Clutter.EVENT_PROPAGATE;
            const max = Math.max(0, hadj.upper - hadj.page_size);
            hadj.value = Math.max(0, Math.min(max, hadj.value + delta));
            return Clutter.EVENT_STOP;
        });
        header.add_child(pickScroll);
        header.add_child(this._pageBtn('▶', () => this._turnIslandPage(1)));
        this._expandedBox.add_child(header);

        // the page itself; slides on page turns (kept as its own actor)
        const pageHost = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 5px; min-height: 96px;',
            y_align: Clutter.ActorAlign.CENTER,
        });
        pageHost.add_child(pages[this._islandPage].build());
        this._pageHost = pageHost;
        this._expandedBox.add_child(pageHost);

        // battery · temp · ram strip shared by every page
        const strip = this._buildStatusStrip();
        if (strip)
            this._expandedBox.add_child(strip);
    }

    _buildStatusStrip() {
        const app = this._app;
        const st = app.state;
        const cfg = app.cfg.status_strip || {};
        const bits = [];
        if (cfg.battery !== false && st.battery) {
            const low = !st.battery.charging && st.battery.pct <= 20;
            const full = st.battery.pct >= 95;
            bits.push({
                text: `${st.battery.charging ? '⚡' : '🔋'} ${st.battery.pct}%`,
                color: low ? T.err : (full ? T.ok : T.text),
            });
        }
        if (cfg.temp !== false && st.sys && st.sys.temp_c !== null &&
            st.sys.temp_c !== undefined) {
            const t = st.sys.temp_c;
            bits.push({
                text: `🌡 ${Math.round(t)}°C`,
                color: t >= 85 ? T.err : (t >= 75 ? T.warn : T.ok),
            });
        }
        if (cfg.ram !== false && st.sys && st.sys.ram_pct !== null &&
            st.sys.ram_pct !== undefined) {
            const r = st.sys.ram_pct;
            bits.push({
                text: `🧠 ${Math.round(r)}%`,
                color: r >= 90 ? T.err : (r >= 75 ? T.warn : T.ok),
            });
        }
        if (bits.length < 1)
            return null;
        const box = new St.BoxLayout({
            style: 'spacing: 12px; margin-top: 6px; padding: 4px 16px; ' +
                'border-radius: 999px; background-color: rgba(255, 255, 255, 0.06); ' +
                'border: 1px solid rgba(255, 255, 255, 0.08);',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        bits.forEach((b, i) => {
            if (i > 0)
                box.add_child(new St.Label({
                    text: '·',
                    y_align: Clutter.ActorAlign.CENTER,
                    style: `${FONT}font-size: 10px; color: rgba(232,234,237,0.25);`,
                }));
            box.add_child(new St.Label({
                text: b.text,
                y_align: Clutter.ActorAlign.CENTER,
                style: `${FONT}font-size: 11px; font-weight: 700; color: ${b.color};` +
                    'font-variant-numeric: tabular-nums;',
            }));
        });
        return box;
    }

    /* one page per activity; only modules with something to say */
    _islandPages() {
        const app = this._app;
        const st = app.state;
        const mods = app.cfg.modules;
        const pages = [];
        const lbl = (text, style) => new St.Label({ text, style: `${FONT}${style}` });

        /* overview: date + one summary line per live module */
        pages.push({
            kind: 'overview', icon: '🗓',
            build: () => {
                const box = new St.BoxLayout({ vertical: true, style: 'spacing: 5px;' });
                box.add_child(lbl(_nowLocal().format('%A, %B %e'),
                    `font-size: 11px; font-weight: 700; color: ${T.muted};`));
                const line = (icon, text, color) => box.add_child(lbl(
                    `${icon}  ${text}`, `font-size: 12.5px; font-weight: 700; color: ${color};`));
                if (mods.media && st.media)
                    line(st.media.status === 'Playing' ? '▶' : '⏸',
                        _trunc(st.media.trackTitle || 'Untitled', 26), T.text);
                if (mods.focus && st.focus.phase !== 'idle')
                    line(st.focus.phase === 'work' ? '🎯' : '☕',
                        app.focusClockText(), st.focus.phase === 'work' ? T.accent : T.ok);
                if (mods.ai && st.ai) {
                    const acc = _panelAccounts(st.ai);
                    const worst = acc.reduce((m, a) => Math.max(m, a.used_pct || 0), 0);
                    const reset = acc.length ? app.fmtCountdown(
                        (acc.find(a => a.used_pct === worst) || {}).reset_ms - Date.now(), true) : '';
                    if (acc.length)
                        line('✦', `${Math.round(worst)}%${reset ? `  ↻ ${reset}` : ''}`,
                            _usedColor(worst));
                }
                if (mods.battery && st.battery)
                    line(st.battery.charging ? '⚡' : '🔋', `${st.battery.pct}%`, T.text);
                if (mods.water)
                    line('💧', `${(st.water || { ml: 0 }).ml} / ${app.cfg.water_goal_ml} ml`, T.text);
                return box;
            },
        });

        if (mods.media && st.media) {
            const player = st.media;
            pages.push({
                kind: 'media', icon: '🎵',
                build: () => {
                    const box = new St.BoxLayout({
                        style: 'spacing: 12px;',
                        y_align: Clutter.ActorAlign.CENTER,
                    });
                    const artStyle =
                        'width: 54px; height: 54px; border-radius: 9px;' +
                        'background-color: rgba(255,255,255,0.08);';
                    let art;
                    try {
                        if (player.trackCoverUrl)
                            art = new St.Icon({
                                gicon: new Gio.FileIcon({
                                    file: Gio.File.new_for_uri(player.trackCoverUrl),
                                }),
                                icon_size: 54,
                                style: artStyle,
                            });
                    } catch (e) {
                        log(`[Notch] media artwork unavailable: ${e}`);
                    }
                    if (!art)
                        art = new St.Icon({
                            icon_name: 'audio-x-generic-symbolic',
                            icon_size: 28,
                            style: artStyle,
                        });
                    box.add_child(art);

                    const details = new St.BoxLayout({
                        vertical: true,
                        style: 'spacing: 3px;',
                        y_align: Clutter.ActorAlign.CENTER,
                        x_expand: true,
                    });
                    const appName = player.app ? player.app.get_name() : 'Now playing';
                    const sourceRow = new St.BoxLayout({
                        style: 'spacing: 7px;',
                        y_align: Clutter.ActorAlign.CENTER,
                    });
                    if (player.status === 'Playing')
                        sourceRow.add_child(this._makeEq(PAGE_HUES.media));
                    sourceRow.add_child(lbl(
                        `${player.status === 'Playing' ? '▶' : '⏸'}  ${_trunc(appName, 24)}`,
                        `font-size: 10.5px; font-weight: 700; color: ${PAGE_HUES.media};`));
                    details.add_child(sourceRow);
                    details.add_child(lbl(_trunc(player.trackTitle || 'Untitled', 34),
                        `font-size: 14px; font-weight: 700; color: ${T.text};`));
                    const artist = _trunc((player.trackArtists || []).join(', '), 32);
                    if (artist)
                        details.add_child(lbl(artist,
                            `font-size: 11.5px; color: ${T.muted};`));
                    box.add_child(details);
                    return box;
                },
            });
        }

        if (mods.focus) {
            pages.push({
                kind: 'focus', icon: '🎯',
                build: () => {
                    const f = st.focus;
                    const box = new St.BoxLayout({ vertical: true, style: 'spacing: 5px;' });
                    const work = f.phase === 'work';
                    if (f.phase !== 'idle') {
                        box.add_child(lbl(work ? '🎯 focus' : '☕ break',
                            `font-size: 11px; font-weight: 700; color: ${T.muted};`));
                        const timer = lbl(app.focusClockText(),
                            `font-size: 15px; font-weight: 700; color: ${work ? T.accent : T.ok};`);
                        this._focusRowLbl = timer;
                        box.add_child(timer);
                        const frac = f.totalMs > 0
                            ? Math.max(0, Math.min(100, 100 * (1 - (f.endsAt - Date.now()) / f.totalMs)))
                            : 0;
                        const barRow = new St.BoxLayout({ spacing: 8 });
                        barRow.add_child(this._miniBar(frac, work ? T.accent : T.ok, 180));
                        box.add_child(barRow);
                    } else {
                        box.add_child(lbl('🎯 Focus timer',
                            `font-size: 14px; font-weight: 700; color: ${T.text};`));
                        box.add_child(lbl(
                            `work ${app.cfg.focus.work_min}m · break ${app.cfg.focus.break_min}m`,
                            `font-size: 11px; color: ${T.muted};`));
                    }
                    return box;
                },
            });
        }

        if (mods.ai && st.ai) {
            const data = st.ai;
            // panel_accounts is what the pill shows; aiacctool's text_badge
            // mode empties it, so _panelAccounts falls back to glm.accounts.
            const summaryAccs = _panelAccounts(data);
            const glm = data.glm || {};
            const glmAccounts = (glm.accounts && glm.accounts.length > 0)
                ? glm.accounts
                : (glm.enabled ? [{ name: 'main', status: glm.status, token_quota: glm.token_quota }] : []);
            if (summaryAccs.length || glmAccounts.length || (data.summary || {}).panel_group) {
                pages.push({
                    kind: 'ai', icon: '✦',
                    build: () => {
                        const box = new St.BoxLayout({ vertical: true, style: 'spacing: 5px;' });
                        const bGlm = ((data.theme || {}).badge_icons &&
                            data.theme.badge_icons.glm) || '✦';
                        if (summaryAccs.length) {
                            summaryAccs.slice(0, 3).forEach((a, i) => {
                                box.add_child(this._aiRow(
                                    `${bGlm}${a.short ? String(a.short).slice(0, 7) : ''}`,
                                    ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
                                    a.used_pct, a.reset_ms));
                            });
                            if (summaryAccs.length > 3)
                                box.add_child(lbl(`+${summaryAccs.length - 3} more accounts`,
                                    `font-size: 10.5px; color: ${T.muted};`));
                        } else {
                            const visible = glmAccounts.slice(0, 3);
                            visible.forEach((acc, i) => {
                                if (acc.status === 'ok') {
                                    const tok = acc.token_quota || {};
                                    const short = acc.name ? String(acc.name).slice(0, 7) : 'glm';
                                    box.add_child(this._aiRow(`✦${short}`,
                                        ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
                                        tok.used_pct, tok.reset_ms));
                                } else {
                                    box.add_child(lbl(
                                        `✦${String(acc.name || 'glm').slice(0, 7)} offline`,
                                        `font-size: 11px; color: ${T.err};`));
                                }
                            });
                            if (glmAccounts.length > visible.length)
                                box.add_child(lbl(`+${glmAccounts.length - visible.length} more accounts`,
                                    `font-size: 10.5px; color: ${T.muted};`));
                        }
                        const codex = data.codex || {};
                        if (codex.enabled && codex.status === 'ok')
                            box.add_child(this._aiRow('🤖5h', T.accent,
                                (codex.primary_window || {}).used_pct,
                                (codex.primary_window || {}).reset_ms));
                        const s = data.summary || {};
                        const bits = [];
                        if (s.panel_group && s.panel_group.text)
                            bits.push(s.panel_group.text.replace(/\{\w+\}/g, '').trim());
                        const r9 = data.nine_router || {};
                        if (r9.enabled && (r9.remote_running || r9.local_running)) {
                            const up = Object.values(r9.filtered_providers || {})
                                .reduce((a, p) => a + (p.active_count || 0), 0);
                            bits.push(`9R ${up}↑`);
                        }
                        if (bits.length)
                            box.add_child(lbl(bits.join('  ·  '),
                                `font-size: 10.5px; color: ${T.muted};`));
                        return box;
                    },
                });
            }
        }

        if (mods.battery && st.battery) {
            pages.push({
                kind: 'battery', icon: '🔋',
                build: () => {
                    const b = st.battery;
                    const box = new St.BoxLayout({ vertical: true, style: 'spacing: 5px;' });
                    box.add_child(lbl(`${b.charging ? '⚡ charging' : '🔋 battery'}  ${b.pct}%`,
                        `font-size: 14px; font-weight: 700; color: ${T.text};`));
                    box.add_child(this._miniBar(b.pct,
                        b.charging ? T.ok : (b.pct <= 20 ? T.err : T.ok), 180));
                    return box;
                },
            });
        }

        if (mods.ghome && st.ghome && (st.ghome.devices || []).length) {
            const g = st.ghome;
            pages.push({
                kind: 'ghome', icon: '🏠',
                build: () => {
                    const box = new St.BoxLayout({ vertical: true, style: 'spacing: 5px;' });
                    const s = g.summary || {};
                    box.add_child(lbl(`🏠 home  ${s.has_active ? `${s.active_count} on` : 'all off'}`,
                        `font-size: 14px; font-weight: 700; color: ${s.has_active ? T.ok : T.muted};`));
                    g.devices.slice(0, 5).forEach(d => {
                        const on = d.state === 'on';
                        const offline = d.state === 'offline';
                        const row = new St.BoxLayout({
                            style: 'spacing: 8px;',
                            y_align: Clutter.ActorAlign.CENTER,
                        });
                        row.add_child(lbl(_ghomeIcon(d.type), 'font-size: 12.5px;'));
                        row.add_child(lbl(String(d.name || 'device'),
                            `font-size: 12.5px; font-weight: 700; color: ${T.text};`));
                        row.add_child(new St.Widget({ x_expand: true }));
                        if (d.room)
                            row.add_child(lbl(`${d.room} · `,
                                `font-size: 10.5px; color: ${T.muted};`));
                        row.add_child(lbl(offline ? 'offline' : (on ? 'on' : 'off'),
                            `font-size: 12px; font-weight: 700; color: ${offline ? T.err : (on ? T.ok : T.muted)};`));
                        box.add_child(row);
                    });
                    if (g.devices.length > 5)
                        box.add_child(lbl(`+${g.devices.length - 5} more devices`,
                            `font-size: 10.5px; color: ${T.muted};`));
                    return box;
                },
            });
        }

        // month calendar: today highlighted, Monday-first grid
        pages.push({
            kind: 'calendar', icon: '📅',
            build: () => {
                const hue = PAGE_HUES.calendar;
                const box = new St.BoxLayout({ vertical: true, style: 'spacing: 5px;' });
                box.add_child(lbl(`📅  ${_nowLocal().format('%B %Y')}`,
                    `font-size: 11px; font-weight: 700; color: ${T.muted};`));

                const cell = (text, style) => new St.Label({
                    text,
                    x_expand: true,
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                    style: `${FONT}font-size: 11px; min-width: 32px; ${style}`,
                });

                const wkRow = new St.BoxLayout({ style: 'spacing: 2px;' });
                ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach(d =>
                    wkRow.add_child(cell(d, `font-size: 9.5px; font-weight: 700; color: ${T.muted};`)));
                box.add_child(wkRow);

                const now = _nowLocal();
                const y = now.get_year();
                const m = now.get_month();
                const today = now.get_day_of_month();
                const daysInMonth = new Date(y, m, 0).getDate();
                const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday = 0
                const grid = new St.BoxLayout({ vertical: true, style: 'spacing: 2px;' });
                for (let d = 1 - firstDow; d <= daysInMonth; d += 7) {
                    const row = new St.BoxLayout({ style: 'spacing: 2px;' });
                    for (let k = 0; k < 7; k++) {
                        const day = d + k;
                        if (day < 1 || day > daysInMonth) {
                            row.add_child(cell('', ''));
                            continue;
                        }
                        if (day === today)
                            row.add_child(cell(String(day),
                                `font-weight: 800; color: #10131a; background-color: ${hue};` +
                                `border-radius: 8px; padding: 0 7px; box-shadow: 0 0 7px ${_hexA(hue, 0.5)};`));
                        else
                            row.add_child(cell(String(day),
                                `font-weight: 600; color: ${T.text};`));
                    }
                    grid.add_child(row);
                }
                box.add_child(grid);
                return box;
            },
        });

        if (mods.water) {
            pages.push({
                kind: 'water', icon: '💧',
                build: () => {
                    const w = st.water || { ml: 0 };
                    const goal = app.cfg.water_goal_ml;
                    const pct = Math.min(100, Math.round(100 * w.ml / goal));
                    const box = new St.BoxLayout({ vertical: true, style: 'spacing: 5px;' });
                    box.add_child(lbl(`💧  ${w.ml} / ${goal} ml`,
                        `font-size: 14px; font-weight: 700; color: ${T.text};`));
                    box.add_child(this._miniBar(pct, T.accent, 180));
                    return box;
                },
            });
        }

        // quick settings: same layout as the other pages — module toggles
        // as glowing chips, pill style and width as small choice buttons
        pages.push({
            kind: 'config',
            icon: '⚙',
            build: () => {
                const box = new St.BoxLayout({ vertical: true, style: 'spacing: 7px;' });
                box.add_child(lbl('⚙  quick settings',
                    'font-size: 10.5px; font-weight: 700; color: ' +
                    `${T.muted}; letter-spacing: 0.1em;`));

                const modsRow = new St.BoxLayout({ style: 'spacing: 6px;' });
                [
                    ['media', '🎵'], ['focus', '🎯'], ['battery', '🔋'],
                    ['ai', '✦'], ['ghome', '🏠'], ['water', '💧'], ['eyes', '👁'],
                ].forEach(([key, icon]) => {
                    modsRow.add_child(this._glowBtn(icon,
                        PAGE_HUES[key] || '#e8eaed', !!mods[key],
                        () => app.setModule(key, !mods[key])));
                });
                box.add_child(modsRow);

                const styleRow = new St.BoxLayout({ style: 'spacing: 6px;' });
                [['glass', 'Glass'], ['flat', 'Flat'], ['outline', 'Outline'],
                    ['mist', 'Mist']].forEach(([key, name]) => {
                    styleRow.add_child(this._textChoiceBtn(name,
                        ((app.cfg.appearance || {}).preset || 'glass') === key,
                        () => {
                            app.cfg.appearance = app.cfg.appearance || {};
                            app.cfg.appearance.preset = key;
                            this._applyCfg();
                        }));
                });
                box.add_child(styleRow);

                const widthRow = new St.BoxLayout({ style: 'spacing: 6px;' });
                [['Compact', 200], ['Regular', 260], ['Wide', 340]]
                    .forEach(([name, px]) => {
                        widthRow.add_child(this._textChoiceBtn(name,
                            ((app.cfg.appearance || {}).min_width || 260) === px,
                            () => {
                                app.cfg.appearance = app.cfg.appearance || {};
                                app.cfg.appearance.min_width = px;
                                this._applyCfg();
                            }));
                    });
                box.add_child(widthRow);

                // status strip (battery · temp · ram) + top-bar removal
                const stripCfg = app.cfg.status_strip ||
                    (app.cfg.status_strip = { battery: true, temp: true, ram: true });
                const stripRow = new St.BoxLayout({ style: 'spacing: 6px;' });
                [['battery', '🔋'], ['temp', '🌡'], ['ram', 'RAM']]
                    .forEach(([key, name]) => {
                        stripRow.add_child(this._textChoiceBtn(name,
                            stripCfg[key] !== false,
                            () => {
                                stripCfg[key] = !(stripCfg[key] !== false);
                                this._applyCfg();
                            }));
                    });
                box.add_child(stripRow);

                const barRow = new St.BoxLayout({ style: 'spacing: 6px;' });
                barRow.add_child(this._textChoiceBtn('🖥 Hide top bar',
                    !!((app.cfg.appearance || {}).hide_panel),
                    () => {
                        app.cfg.appearance = app.cfg.appearance || {};
                        app.cfg.appearance.hide_panel =
                            !(app.cfg.appearance.hide_panel);
                        this._applyCfg();
                    }));
                box.add_child(barRow);
                return box;
            },
        });

        return pages;
    }

    _showIslandPage(idx, dir) {
        const pages = this._islandPages();
        if (pages.length < 2 || idx === this._islandPage)
            return;
        this._islandPage = idx;
        this._islandKind = pages[idx].kind;   // keep this page through re-render
        this._setAmbientHue(this._ambientHueFor(pages[idx].kind));
        this._renderIsland();
        this._relayoutIsland();
        // the pill mirrors the selected activity — refresh it too
        this._renderCollapsed();
        // slide the new page in from the direction of travel, springy settle
        const host = this._pageHost;
        if (host) {
            host.translation_x = dir * 22;
            host.opacity = 60;
            host.ease({
                translation_x: 0, opacity: 255, duration: 280,
                mode: Clutter.AnimationMode.EASE_OUT_BACK,
            });
        }
    }

    _turnIslandPage(dir) {
        const pages = this._islandPages();
        if (pages.length < 2)
            return;
        this._showIslandPage((this._islandPage + dir + pages.length) % pages.length, dir);
    }

    _gotoIslandPage(idx) {
        this._showIslandPage(idx, idx > this._islandPage ? 1 : -1);
    }

    // apply an appearance change made from the config page and re-render
    _applyCfg() {
        this._app.cfgVersion++;
        saveConfig(this._app.cfg);
        this._app.applyHidePanel();
        this.render();
    }

    // small glowing icon toggle (used by the page chooser and config page)
    _glowBtn(glyph, hue, active, onActivate, size = 31) {
        const styleFor = state =>
            `${FONT}width: ${size}px; height: ${size}px; border-radius: 9px;` +
            `font-size: 14.5px; font-weight: 700;` +
            (state === 'active'
                ? `background-color: ${_hexA(hue, 0.20)};` +
                    `border: 1px solid ${_hexA(hue, 0.60)};` +
                    `box-shadow: 0 0 10px ${_hexA(hue, 0.35)};` +
                    `color: ${hue};`
                : state === 'hover'
                    ? 'background-color: rgba(255, 255, 255, 0.13);' +
                        'border: 1px solid rgba(255, 255, 255, 0.12);' +
                        `color: ${T.text};`
                    : 'background-color: rgba(255, 255, 255, 0.05);' +
                        'border: 1px solid rgba(255, 255, 255, 0.04);' +
                        'color: rgba(232, 234, 237, 0.55);');
        const btn = new St.Button({
            label: glyph,
            style: styleFor(active ? 'active' : 'idle'),
            y_align: Clutter.ActorAlign.CENTER,
        });
        if (!active) {
            btn.connect('enter-event', () => btn.set_style(styleFor('hover')));
            btn.connect('leave-event', () => btn.set_style(styleFor('idle')));
        }
        btn.connect('clicked', onActivate);
        return btn;
    }

    // small text choice button (config page rows)
    _textChoiceBtn(label, active, onActivate) {
        const btn = new St.Button({
            label,
            style: active
                ? 'height: 27px; border-radius: 9px; padding-left: 12px; padding-right: 12px;' +
                    'background-color: rgba(122,184,255,0.20);' +
                    'border: 1px solid rgba(122,184,255,0.60);' +
                    'box-shadow: 0 0 10px rgba(122,184,255,0.30);' +
                    'font-size: 11.5px; font-weight: 700; color: #7ab8ff;'
                : 'height: 27px; border-radius: 9px; padding-left: 12px; padding-right: 12px;' +
                    'background-color: rgba(255,255,255,0.06);' +
                    'border: 1px solid rgba(255,255,255,0.08);' +
                    'font-size: 11.5px; font-weight: 600; color: rgba(232,234,237,0.7);',
        });
        btn.connect('clicked', onActivate);
        return btn;
    }

    // Re-ease the expanded island to the current page's size.
    _relayoutIsland() {
        if (!this._expanded)
            return;
        this._expandedBox.set_width(-1);
        this._renderIsland();
        const [, natW] = this._expandedBox.get_preferred_width(-1);
        const targetW = Math.max(this.width,
            Math.min(natW + 2 * PAD_X, this._maxIslandWidth()));
        const innerW = targetW - 2 * PAD_X;
        this._expandedBox.set_width(innerW);
        this._renderIsland();
        const [, natH] = this._expandedBox.get_preferred_height(innerW);
        this._layoutAmbient(220, targetW, natH + PAD_TOP + PAD_BOTTOM);
        this.ease({
            width: targetW,
            height: natH + PAD_TOP + PAD_BOTTOM,
            duration: 220,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
        this._recenter();
    }

    _pageBtn(glyph, onActivate) {
        const btn = new St.Button({
            label: glyph,
            style: `${FONT}width: 30px; height: 36px; border-radius: 10px;` +
                `background-color: rgba(255, 255, 255, 0.14);` +
                `border: 1px solid rgba(255, 255, 255, 0.12);` +
                `font-size: 14px; font-weight: 700; color: ${T.text};`,
            y_align: Clutter.ActorAlign.CENTER,
        });
        btn.connect('clicked', onActivate);
        return btn;
    }

    _aiRow(tag, tagColor, pct, resetMs) {
        const val = Math.max(0, Math.min(100, pct === null || pct === undefined ? 0 : pct));
        const color = _usedColor(val);
        const row = new St.BoxLayout({
            style: 'spacing: 8px;',
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        row.add_child(new St.Label({
            text: tag,
            style: `${FONT}font-size: 12px; font-weight: 700; color: ${tagColor}; min-width: 44px;`,
            y_align: Clutter.ActorAlign.CENTER,
        }));
        row.add_child(new St.Widget({ x_expand: true }));
        row.add_child(this._miniBar(val, color, 96));
        row.add_child(new St.Label({
            text: `${Math.round(val)}%`,
            style: `${FONT}font-size: 12.5px; font-weight: 700; color: ${color}; min-width: 34px;`,
            y_align: Clutter.ActorAlign.CENTER,
        }));
        if (resetMs) {
            const cd = new St.Label({
                text: `↻ ${this._app.fmtCountdown(resetMs - Date.now(), true)} @ ${_resetClockText(resetMs)}`,
                style: `${FONT}font-size: 11.5px; font-weight: 700; color: ${T.text};`,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._islandCd.push({ label: cd, until: resetMs, clock: true });
            row.add_child(cd);
        }
        return row;
    }

    _miniBar(pct, color, width = 64) {
        const val = Math.max(0, Math.min(100, pct));
        const fillW = val > 0 ? Math.max(4, Math.round(width * val / 100)) : 0;
        const box = new St.BoxLayout({ y_align: Clutter.ActorAlign.CENTER });
        if (fillW > 0)
            box.add_child(new St.BoxLayout({
                style: `width: ${fillW}px; height: 6px; background-color: ${color}; border-radius: 3px;` +
                    `box-shadow: 0 0 6px ${_hexA(color, 0.45)};`,
            }));
        box.add_child(new St.BoxLayout({
            style: `width: ${width - fillW}px; height: 6px;` +
                `background-color: rgba(255, 255, 255, 0.10); border-radius: 3px;`,
        }));
        return box;
    }

    /* ---------- eyes animation ---------- */

    _cancelEyeTimers() {
        if (this._blinkTimer) {
            GLib.source_remove(this._blinkTimer);
            this._blinkTimer = 0;
        }
        if (this._glanceTimer) {
            GLib.source_remove(this._glanceTimer);
            this._glanceTimer = 0;
        }
    }

    _scheduleBlink() {
        this._blinkTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            2400 + Math.floor(Math.random() * 3600), () => {
                this._blinkTimer = 0;
                this._eyes.forEach(eye => {
                    eye.ease({
                        scale_y: 0.12, duration: 90,
                        mode: Clutter.AnimationMode.EASE_IN_QUAD,
                        onStopped: () => eye.ease({
                            scale_y: 1, duration: 120,
                            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                        }),
                    });
                });
                this._scheduleBlink();
                return GLib.SOURCE_REMOVE;
            });
    }

    _scheduleGlance() {
        this._glanceTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            3200 + Math.floor(Math.random() * 4200), () => {
                this._glanceTimer = 0;
                const dx = (Math.random() < 0.5 ? -1 : 1) * 2.5;
                this._eyes.forEach(eye => {
                    if (eye._pupil)
                        eye._pupil.ease({
                            translation_x: dx, duration: 260,
                            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                        });
                });
                this._scheduleGlance();
                return GLib.SOURCE_REMOVE;
            });
    }

    /* ---------- 1s tick ---------- */

    tick() {
        if (this._clockLbl)
            this._clockLbl.text = this._app.clockText();
        if (this._focusPillLbl)
            this._focusPillLbl.text = this._app.focusClockText();
        if (this._focusRowLbl)
            this._focusRowLbl.text = this._app.focusClockText();
        const tickCd = e => {
            const remaining = this._app.fmtCountdown(e.until - Date.now(), true);
            e.label.text = e.clock
                ? `↻ ${remaining} @ ${_resetClockText(e.until)}`
                : remaining;
        };
        this._cdLabels.forEach(tickCd);
        (this._islandCd || []).forEach(tickCd);
    }

    /* ---------- menu ---------- */

    _buildMenu() {
        this.menu.removeAll();
        const app = this._app;
        const st = app.state;
        const mods = app.cfg.modules;

        const player = mods.media ? st.media : null;
        if (player) {
            const title = _trunc(player.trackTitle || 'Untitled', 34);
            const artist = _trunc((player.trackArtists || []).join(', '), 26);
            const np = new PopupMenu.PopupMenuItem(
                player.status === 'Playing' ? `▶ ${title} — ${artist}` : `⏸ ${title}`,
                { reactive: false });
            this.menu.addMenuItem(np);
            const prevItem = new PopupMenu.PopupMenuItem('⏮  Previous track');
            prevItem.connect('activate', () => player.previous());
            this.menu.addMenuItem(prevItem);
            const ppItem = new PopupMenu.PopupMenuItem(
                player.status === 'Playing' ? '⏸  Pause' : '▶  Play');
            ppItem.connect('activate', () => player.playPause());
            this.menu.addMenuItem(ppItem);
            const nextItem = new PopupMenu.PopupMenuItem('⏭  Next track');
            nextItem.connect('activate', () => player.next());
            this.menu.addMenuItem(nextItem);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        if (mods.focus) {
            const f = st.focus;
            if (f.phase === 'idle') {
                const workItem = new PopupMenu.PopupMenuItem(
                    `🎯  Start focus (${app.cfg.focus.work_min}m)`);
                workItem.connect('activate', () => app.focusStart('work'));
                this.menu.addMenuItem(workItem);
                const brkItem = new PopupMenu.PopupMenuItem(
                    `☕  Start break (${app.cfg.focus.break_min}m)`);
                brkItem.connect('activate', () => app.focusStart('break'));
                this.menu.addMenuItem(brkItem);
            } else {
                const stopItem = new PopupMenu.PopupMenuItem(
                    `⏹  Stop ${f.phase === 'work' ? 'focus' : 'break'}`);
                stopItem.connect('activate', () => app.focusStop());
                this.menu.addMenuItem(stopItem);
            }
        }

        if (mods.water) {
            const w = st.water || { ml: 0 };
            const waterItem = new PopupMenu.PopupMenuItem(
                `💧  +250 ml  (${w.ml}/${app.cfg.water_goal_ml})`);
            waterItem.connect('activate', () => app.waterAdd(250));
            this.menu.addMenuItem(waterItem);
        }

        if (mods.ghome && st.ghome && (st.ghome.devices || []).length) {
            (st.ghome.devices || []).slice(0, 8).forEach(d => {
                const on = d.state === 'on';
                const item = new PopupMenu.PopupMenuItem(
                    `${_ghomeIcon(d.type)}  ${d.name}  ·  ${on ? 'on' : 'off'}`);
                item.connect('activate', () => app.ghomeToggle(d.name));
                this.menu.addMenuItem(item);
            });
            const allOff = new PopupMenu.PopupMenuItem('🏠  All devices off');
            allOff.connect('activate', () => app.ghomeSetAll('off'));
            this.menu.addMenuItem(allOff);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const modsSub = new PopupMenu.PopupSubMenuMenuItem('🧩  Modules');
        const defs = [
            ['media', '🎵  Media'],
            ['focus', '🎯  Focus timer'],
            ['battery', '🔋  Battery'],
            ['ai', '✦  AI quota'],
            ['ghome', '🏠  Google Home'],
            ['water', '💧  Hydration'],
            ['eyes', '👀  Idle eyes'],
        ];
        defs.forEach(([key, label]) => {
            const sw = new PopupMenu.PopupSwitchMenuItem(label, !!mods[key]);
            sw.connect('toggled', (_, val) => app.setModule(key, val));
            modsSub.menu.addMenuItem(sw);
        });
        this.menu.addMenuItem(modsSub);

        const styleSub = new PopupMenu.PopupSubMenuMenuItem('🎨  Pill style');
        const cur = (app.cfg.appearance || {}).preset || 'glass';
        [['glass', 'Glass droplet (glow border)'], ['flat', 'Flat pill'],
            ['outline', 'Outline (transparent)'], ['mist', 'Mist (soft)']]
            .forEach(([key, label]) => {
                const item = new PopupMenu.PopupMenuItem(
                    (cur === key ? '●  ' : '○  ') + label);
                item.connect('activate', () => {
                    app.cfg.appearance.preset = key;
                    app.cfgVersion++;
                    saveConfig(app.cfg);
                    this._applyPillStyle();
                    this._buildMenu();
                });
                styleSub.menu.addMenuItem(item);
            });
        this.menu.addMenuItem(styleSub);

        const widthSub = new PopupMenu.PopupSubMenuMenuItem('↔  Pill width');
        const curW = (app.cfg.appearance || {}).min_width || 260;
        [['compact', 200], ['regular', 260], ['wide', 340]]
            .forEach(([label, px]) => {
                const item = new PopupMenu.PopupMenuItem(
                    (curW === px ? '●  ' : '○  ') +
                    `${label[0].toUpperCase()}${label.slice(1)} (${px}px)`);
                item.connect('activate', () => {
                    app.cfg.appearance.min_width = px;
                    app.cfgVersion++;
                    saveConfig(app.cfg);
                    if (!this._expanded)
                        this._applyRestingSize();
                    this._buildMenu();
                });
                widthSub.menu.addMenuItem(item);
            });
        this.menu.addMenuItem(widthSub);

        const pillSw = new PopupMenu.PopupSwitchMenuItem('✦  AI chips in pill',
            app.cfg.pill_mode !== 'clock');
        pillSw.connect('toggled', (_, val) => app.setPillMode(val ? 'ai' : 'clock'));
        this.menu.addMenuItem(pillSw);

        const hideBarSw = new PopupMenu.PopupSwitchMenuItem('🖥  Hide GNOME top bar',
            !!((app.cfg.appearance || {}).hide_panel));
        hideBarSw.connect('toggled', (_, val) => {
            app.cfg.appearance = app.cfg.appearance || {};
            app.cfg.appearance.hide_panel = val;
            app.cfgVersion++;
            saveConfig(app.cfg);
            app.applyHidePanel();
            this.render();
        });
        this.menu.addMenuItem(hideBarSw);

        const stripSub = new PopupMenu.PopupSubMenuMenuItem('📊  Status strip');
        const stripCfg = app.cfg.status_strip ||
            (app.cfg.status_strip = { battery: true, temp: true, ram: true });
        [['battery', '🔋 Battery'], ['temp', '🌡 CPU temperature'], ['ram', '🧠 RAM usage']]
            .forEach(([key, label]) => {
                const sw = new PopupMenu.PopupSwitchMenuItem(label, stripCfg[key] !== false);
                sw.connect('toggled', (_, v) => {
                    stripCfg[key] = v;
                    app.cfgVersion++;
                    saveConfig(app.cfg);
                    this.render();
                });
                stripSub.menu.addMenuItem(sw);
            });
        this.menu.addMenuItem(stripSub);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const cfgItem = new PopupMenu.PopupMenuItem('📝  Open settings file');
        cfgItem.connect('activate', () => app.openConfigFile());
        this.menu.addMenuItem(cfgItem);

        const reloadItem = new PopupMenu.PopupMenuItem('↻  Reload settings');
        reloadItem.connect('activate', () => app.reloadConfig());
        this.menu.addMenuItem(reloadItem);

        const aboutItem = new PopupMenu.PopupMenuItem('ⓘ  About Notch');
        aboutItem.connect('activate', () =>
            Util_spawn('xdg-open https://github.com/ther12k/gnome-notch'));
        this.menu.addMenuItem(aboutItem);
    }
});

/* tiny command spawner (keeps imports minimal) */
function Util_spawn(cmdline) {
    try {
        const [ok, argv] = GLib.shell_parse_argv(cmdline);
        if (ok)
            GLib.spawn_async(null, argv, null,
                GLib.SpawnFlags.SEARCH_PATH, null);
    } catch (e) {
        log(`[Notch] spawn failed: ${e}`);
    }
}

/* ---------- app orchestrator ---------- */

class NotchApp {
    constructor(loader) {
        this._loader = loader;
    }

    enable() {
        this.cfg = loadConfig();
        this.cfgVersion = 0;

        // water day rollover
        const today = _nowLocal().format('%Y-%m-%d');
        if ((this.cfg.water || {}).date !== today) {
            this.cfg.water = { date: today, ml: 0 };
            saveConfig(this.cfg);
        }

        this.state = {
            media: null,
            focus: { phase: 'idle', endsAt: 0, totalMs: 0 },
            battery: null,
            ai: null,
            ghome: null,
            water: this.cfg.water,
            sys: { ram_pct: null, temp_c: null },
        };

        this._watcher = new MediaWatcher(() => this._mediaChanged());
        this._notch = new NotchBar(this);
        this._notch.attach();
        this._notch.render();
        this._scheduleSlowPoll();
        this.applyHidePanel();

        this._pollBattery();
        this._pollSys();
        this._pollAI();
        if (this.cfg.modules.ghome)
            this._pollGHome();
        this._fastTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1,
            () => this._tick());
        log('[Notch] enabled');
    }

    disable() {
        if (this._fastTimer) {
            GLib.source_remove(this._fastTimer);
            this._fastTimer = 0;
        }
        if (this._slowTimer) {
            GLib.source_remove(this._slowTimer);
            this._slowTimer = 0;
        }
        this.restorePanel();
        if (this._aiProc) {
            this._aiProc.force_exit();
            this._aiProc = null;
        }
        if (this._watcher) {
            this._watcher.destroy();
            this._watcher = null;
        }
        if (this._notch) {
            this._notch.detach();
            this._notch = null;
        }
        log('[Notch] disabled');
    }

    /* ----- data ----- */

    _mediaChanged() {
        if (!this._notch)
            return;
        this.state.media = this.cfg.modules.media ? this._watcher.active : null;
        this._notch.render();
    }

    _scheduleSlowPoll() {
        if (this._slowTimer) {
            GLib.source_remove(this._slowTimer);
            this._slowTimer = 0;
        }
        const seconds = Math.max(10, Number(this.cfg.ai.poll_sec) || 30);
        this._slowTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds,
            () => this._slowPoll());
    }

    _slowPoll() {
        this._pollBattery();
        this._pollSys();
        if (this.cfg.modules.ai)
            this._pollAI();
        if (this.cfg.modules.ghome)
            this._pollGHome();
        return GLib.SOURCE_CONTINUE;
    }

    // RAM + temperature for the island's status strip; graceful nulls when
    // the host exposes neither
    _pollSys() {
        const s = { ram_pct: null, temp_c: null };
        try {
            const [ok, bytes] = GLib.file_get_contents('/proc/meminfo');
            if (ok) {
                const txt = new TextDecoder().decode(bytes);
                const total = Number((txt.match(/^MemTotal:\s+(\d+)/m) || [])[1]);
                const avail = Number((txt.match(/^MemAvailable:\s+(\d+)/m) || [])[1]);
                if (total > 0 && !Number.isNaN(avail))
                    s.ram_pct = 100 * (total - avail) / total;
            }
        } catch (e) { /* no meminfo */ }
        try {
            const dir = Gio.File.new_for_path('/sys/class/thermal');
            const names = dir.enumerate_children('standard::name',
                Gio.FileQueryInfoFlags.NONE, null);
            let info, cpuTemp = null, maxTemp = null;
            while ((info = names.next_file(null))) {
                const n = info.get_name();
                if (!n.startsWith('thermal_zone'))
                    continue;
                const raw = this._readSys(`/sys/class/thermal/${n}/temp`);
                const type = (this._readSys(`/sys/class/thermal/${n}/type`) || '').toLowerCase();
                const t = parseFloat(raw);
                if (Number.isNaN(t) || t <= 0)
                    continue;
                const deg = t > 1000 ? t / 1000 : t;
                if (deg > 115)
                    continue;
                if (type.includes('pkg') || type.includes('tcpu') || type.includes('core'))
                    cpuTemp = deg;
                else if (maxTemp === null || deg > maxTemp)
                    maxTemp = deg;
            }
            names.close(null);
            s.temp_c = cpuTemp !== null ? cpuTemp : maxTemp;
        } catch (e) { /* no thermal zones */ }
        this.state.sys = s;
        this._notch && this._notch.render();
    }

    // hide the GNOME top bar so the notch is the only thing left up top
    applyHidePanel() {
        const want = !!((this.cfg.appearance || {}).hide_panel);
        const panelBox = Main.layoutManager.panelBox;
        if (!panelBox || want === this._panelHidden)
            return;
        try {
            if (want) {
                this._panelSavedH = panelBox.height || 32;
                panelBox.hide();
                panelBox.set_size(panelBox.width, 0);
                if (Main.panel)
                    Main.panel.hide();
            } else {
                panelBox.show();
                if (Main.panel)
                    Main.panel.show();
                if (this._panelSavedH)
                    panelBox.set_size(panelBox.width, this._panelSavedH);
            }
            if (Main.layoutManager._queueUpdateRegions)
                Main.layoutManager._queueUpdateRegions();
            else if (Main.layoutManager._updateWorkArea)
                Main.layoutManager._updateWorkArea();
            this._panelHidden = want;
        } catch (e) {
            log(`[Notch] hide top bar failed: ${e}`);
        }
    }

    restorePanel() {
        if (!this._panelHidden)
            return;
        try {
            const panelBox = Main.layoutManager.panelBox;
            if (panelBox) {
                panelBox.show();
                if (this._panelSavedH)
                    panelBox.set_size(panelBox.width, this._panelSavedH);
            }
            if (Main.panel)
                Main.panel.show();
            if (Main.layoutManager._queueUpdateRegions)
                Main.layoutManager._queueUpdateRegions();
            else if (Main.layoutManager._updateWorkArea)
                Main.layoutManager._updateWorkArea();
        } catch (e) { /* best effort */ }
        this._panelHidden = false;
    }

    _pollBattery() {
        try {
            const dir = Gio.File.new_for_path('/sys/class/power_supply');
            const names = dir.enumerate_children('standard::name',
                Gio.FileQueryInfoFlags.NONE, null);
            let info, bat = null;
            while ((info = names.next_file(null))) {
                const n = info.get_name();
                if (n.startsWith('BAT')) {
                    bat = n;
                    break;
                }
            }
            names.close(null);
            if (!bat) {
                this.state.battery = null;   // desktop without battery
                return;
            }
            const base = `/sys/class/power_supply/${bat}`;
            const pct = this._readSys(`${base}/capacity`);
            const status = this._readSys(`${base}/status`);
            if (pct !== null) {
                this.state.battery = {
                    pct: parseInt(pct, 10),
                    charging: status === 'Charging' || status === 'Full',
                };
                this._notch && this._notch.render();
            }
        } catch (e) {
            log(`[Notch] battery poll failed: ${e}`);
        }
    }

    _readSys(path) {
        try {
            const [ok, bytes] = GLib.file_get_contents(path);
            if (ok)
                return new TextDecoder().decode(bytes).trim();
        } catch (e) { /* missing file */ }
        return null;
    }

    _pollAI() {
        if (this._aiProc) {
            this._aiProc.force_exit();
            this._aiProc = null;
        }
        if (!this.cfg.modules.ai)
            return;
        try {
            const script = GLib.build_filenamev([this._loader.path, 'ai-collector.py']);
            const proc = new Gio.Subprocess({
                argv: ['python3', script],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            });
            proc.init(null);
            this._aiProc = proc;
            proc.communicate_utf8_async(null, null, (obj, res) => {
                if (this._aiProc !== proc)
                    return;
                this._aiProc = null;
                try {
                    const [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if (ok && stdout) {
                        this.state.ai = JSON.parse(stdout);
                        this._notch && this._notch.render();
                    } else {
                        log(`[Notch] AI collector failed: ${stderr}`);
                    }
                } catch (e) {
                    log(`[Notch] AI parse failed: ${e}`);
                }
            });
        } catch (e) {
            log(`[Notch] AI spawn failed: ${e}`);
        }
    }

    // Google Home: shared collector with google-home-panel; no-op when the
    // script is missing so the module stays dormant elsewhere.
    _runGHome(args) {
        try {
            const script = GLib.build_filenamev([this._loader.path, 'ghome-collector.py']);
            const proc = new Gio.Subprocess({
                argv: ['python3', script, ...args],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            });
            proc.init(null);
            proc.communicate_utf8_async(null, null, (obj, res) => {
                try {
                    const [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if (ok && stdout) {
                        this.state.ghome = JSON.parse(stdout);
                        this._notch && this._notch.render();
                    } else {
                        log(`[Notch] ghome collector failed: ${stderr}`);
                    }
                } catch (e) {
                    log(`[Notch] ghome parse failed: ${e}`);
                }
            });
        } catch (e) {
            log(`[Notch] ghome spawn failed: ${e}`);
        }
    }

    _pollGHome() {
        this._runGHome([]);
    }

    ghomeToggle(name) {
        this._runGHome(['--toggle', String(name)]);
    }

    ghomeSetAll(state) {
        this._runGHome([`--${state}`, 'all']);
    }

    /* ----- actions ----- */

    setModule(key, val) {
        this.cfg.modules[key] = val;
        this.cfgVersion++;
        saveConfig(this.cfg);
        if (key === 'media')
            this._mediaChanged();
        if (key === 'ai') {
            this._pollAI();
            if (!val)
                this.state.ai = null;
        }
        if (key === 'ghome') {
            if (val)
                this._pollGHome();
            else
                this.state.ghome = null;
        }
        this._notch && this._notch.render();
    }

    openConfigFile() {
        try {
            const file = Gio.File.new_for_path(CONFIG_PATH);
            const editor = Gio.AppInfo.get_default_for_type('application/json', false) ||
                Gio.AppInfo.get_default_for_type('text/plain', false);
            if (editor && editor.supports_files())
                editor.launch([file], null);
            else
                Gio.AppInfo.launch_default_for_uri(file.get_uri(), null);
        } catch (e) {
            log(`[Notch] config open failed: ${e}`);
        }
    }

    reloadConfig() {
        let next;
        try {
            next = readConfig();
        } catch (e) {
            log(`[Notch] config reload failed; keeping current settings: ${e}`);
            if (typeof Main.notify === 'function')
                Main.notify('Notch settings were not reloaded', String(e));
            return;
        }

        const previous = this.cfg;
        const today = _nowLocal().format('%Y-%m-%d');
        if (next.water.date !== today)
            next.water = { date: today, ml: 0 };
        this.cfg = next;
        this.state.water = next.water;
        this.cfgVersion++;

        if (next.modules.media !== previous.modules.media)
            this._mediaChanged();
        if (next.modules.ai !== previous.modules.ai || next.modules.ai) {
            this._pollAI();
            if (!next.modules.ai)
                this.state.ai = null;
        }
        if (next.modules.ghome && !previous.modules.ghome)
            this._pollGHome();
        else if (!next.modules.ghome)
            this.state.ghome = null;
        if (next.modules.ai !== previous.modules.ai ||
            next.ai.poll_sec !== previous.ai.poll_sec)
            this._scheduleSlowPoll();

        saveConfig(next);
        this._notch && this._notch.render();
        this.applyHidePanel();
        if (typeof Main.notify === 'function')
            Main.notify('Notch settings reloaded');
    }

    setPillMode(mode) {
        this.cfg.pill_mode = mode;
        this.cfgVersion++;
        saveConfig(this.cfg);
        this._notch && this._notch.render();
    }

    focusStart(phase) {
        const mins = phase === 'work' ? this.cfg.focus.work_min : this.cfg.focus.break_min;
        const totalMs = mins * 60 * 1000;
        this.state.focus = { phase, endsAt: Date.now() + totalMs, totalMs };
        this._notch && this._notch.render();
    }

    focusStop() {
        this.state.focus = { phase: 'idle', endsAt: 0, totalMs: 0 };
        this._notch && this._notch.render();
    }

    waterAdd(ml) {
        const today = _nowLocal().format('%Y-%m-%d');
        const w = this.state.water && this.state.water.date === today
            ? this.state.water : { date: today, ml: 0 };
        w.ml += ml;
        this.state.water = w;
        this.cfg.water = w;
        saveConfig(this.cfg);
        this._notch && this._notch.render();
    }

    /* ----- 1s tick ----- */

    _tick() {
        const f = this.state.focus;
        if (f.phase !== 'idle' && Date.now() >= f.endsAt) {
            const wasWork = f.phase === 'work';
            this.focusStop();
            if (typeof Main.notify === 'function')
                Main.notify(wasWork ? 'Focus complete 🎉' : 'Break over ☕',
                    wasWork ? 'Nice work — time for a break.'
                        : 'Back to it!');
        }
        this._notch && this._notch.tick();
        return GLib.SOURCE_CONTINUE;
    }

    /* ----- formatting ----- */

    clockText() {
        const fmt = this.cfg.clock_24h !== false ? '%H:%M' : '%l:%M';
        return _nowLocal().format(fmt).trim();
    }

    focusClockText() {
        const f = this.state.focus;
        if (f.phase === 'idle')
            return '';
        const s = Math.max(0, Math.ceil((f.endsAt - Date.now()) / 1000));
        return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }

    fmtCountdown(ms, short) {
        if (ms === null || ms === undefined || ms <= 0)
            return short ? '0s' : '—';
        const s = Math.floor(ms / 1000);
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        if (short) {
            if (d) return `${d}d${h}h`;
            if (h) return `${h}h${m}m`;
            if (m) return `${m}m`;
            return `${s % 60}s`;
        }
        if (d) return `${d}d ${h}h`;
        if (h) return `${h}h ${m}m`;
        return `${m}m ${s % 60}s`;
    }
}

export default class NotchExtension {
    constructor(loader) {
        this._loader = loader;
    }

    enable() {
        this._app = new NotchApp(this._loader);
        this._app.enable();
    }

    disable() {
        if (this._app) {
            this._app.disable();
            this._app = null;
        }
    }
}
