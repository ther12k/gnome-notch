// Entry point kept tiny and stable. GNOME Shell caches extension ES modules
// for the whole session, so editing this file would never load without a
// logout. The real implementation lives in impl-<stamp>.js, whose unique
// filename bypasses the module cache on every deploy (deploy.sh stamps it),
// and never triggers re-evaluation of core resource:// modules.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

function _newestImplName(dirPath) {
    const names = [];
    const iter = Gio.File.new_for_path(dirPath)
        .enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    let info;
    while ((info = iter.next_file(null))) {
        const n = info.get_name();
        if (/^impl-\d+\.js$/.test(n))
            names.push(n);
    }
    names.sort();
    return names.length ? names[names.length - 1] : null;
}

export default class AIUsageMonitorLoader extends Extension {
    enable() {
        this._enableRequested = true;
        const name = _newestImplName(this.path);
        if (!name) {
            log('[Notch] no impl-*.js build found in ' + this.path);
            return;
        }
        const uri = Gio.File.new_for_path(
            GLib.build_filenamev([this.path, name])).get_uri();
        import(uri).then(mod => {
            if (!this._enableRequested)
                return;
            this._impl = new mod.default(this);
            this._impl.enable();
            log(`[Notch] loaded ${name}`);
        }).catch(e => {
            log(`[Notch] impl load failed: ${e}\n${e.stack}`);
        });
    }

    disable() {
        this._enableRequested = false;
        if (this._impl) {
            this._impl.disable();
            this._impl = null;
        }
    }
}
