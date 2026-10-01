// Niza native Android bridge — single capability/handshake layer.
//
// Supported hosts (probed in order, never assumed):
//   1. Capacitor plugin "NizaNative" (window.Capacitor.Plugins.NizaNative)
//   2. Legacy JS interface "NizaAndroid" (webView.addJavascriptInterface)
//
// ── Contract for the Android side ────────────────────────────────────────
// Every method receives (id, argsJson) on the legacy interface, or (args) on
// the Capacitor plugin, and replies with { ok, data?, error? }.
//   Legacy reply:   window.__nizaResolve(id, json)
//   Legacy events:  window.__nizaEvent(json)   // { type, ...payload }
//   Capacitor events: plugin.addListener("downloadEvent", cb)
//
// Methods:
//   getCapabilities() -> { version: string, capabilities: string[] }
//   isPackageInstalled({ packageName }) -> { installed, versionName?, versionCode?, launchable? }
//   downloadApk({ downloadId, url, fileName, appId }) -> { started: true }
//      emits downloadEvent { downloadId, state: "started"|"progress"|"completed"|"failed"|"cancelled",
//                            loaded, total, error? } — loaded/total are REAL bytes
//   cancelDownload({ downloadId }) -> { cancelled }
//   installApk({ downloadId }) -> { started }      // opens the Android package installer
//   launchPackage({ packageName }) -> { launched }
//   uninstallPackage({ packageName }) -> { uninstalled }
//   openSettings({ target }) -> { opened }
//   getDeviceInfo() -> { androidVersion, sdkInt, model, abis }
// Android must declare <queries> entries (or per-package queries) so only
// the requested package is visible — we never ask for the full package list.

export type DownloadState = "started" | "progress" | "completed" | "failed" | "cancelled";
export type DownloadEvent = {
  downloadId: string;
  state: DownloadState;
  loaded: number;
  total: number;
  error?: string;
};
export type PackageInfo = { installed: boolean; versionName?: string; versionCode?: number; launchable?: boolean };

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };
type Host = "capacitor" | "legacy" | null;

declare global {
  interface Window {
    NizaAndroid?: Record<string, (...args: unknown[]) => unknown>;
    Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, any> };
    __nizaResolve?: (id: string, payload: string) => void;
    __nizaEvent?: (payload: string) => void;
  }
}

const pending = new Map<string, Pending>();
const downloadListeners = new Set<(e: DownloadEvent) => void>();
let capabilities: Set<string> = new Set();
let host: Host = null;
let handshake: Promise<Set<string>> | null = null;
let installed = false;

function emitDownload(e: DownloadEvent) {
  downloadListeners.forEach((l) => {
    try { l(e); } catch { /* listener errors never break the bridge */ }
  });
}

function installGlobals() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.__nizaResolve = (id, payload) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    clearTimeout(p.timer);
    try {
      const parsed = JSON.parse(payload) as { ok: boolean; data?: unknown; error?: string };
      if (parsed.ok) p.resolve(parsed.data);
      else p.reject(new Error(parsed.error ?? "Native call failed"));
    } catch (e) {
      p.reject(e as Error);
    }
  };
  window.__nizaEvent = (payload) => {
    try {
      const e = JSON.parse(payload);
      if (e?.type === "download") emitDownload(e as DownloadEvent);
    } catch { /* ignore */ }
  };
}

function capPlugin() {
  if (typeof window === "undefined") return null;
  const c = window.Capacitor;
  if (!c?.isNativePlatform?.()) return null;
  return c.Plugins?.NizaNative ?? null;
}

function detectHost(): Host {
  if (capPlugin()) return "capacitor";
  if (typeof window !== "undefined" && window.NizaAndroid) return "legacy";
  return null;
}

function rawCall<T>(method: string, args: Record<string, unknown>, timeoutMs: number): Promise<T> {
  installGlobals();
  const h = host ?? detectHost();
  if (h === "capacitor") {
    const plugin = capPlugin();
    const fn = plugin?.[method];
    if (typeof fn !== "function") return Promise.reject(new Error(`Native method ${method} not available`));
    return Promise.race([
      Promise.resolve(fn.call(plugin, args)) as Promise<T>,
      new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`Native call ${method} timed out`)), timeoutMs)),
    ]);
  }
  if (h === "legacy") {
    return new Promise((resolve, reject) => {
      const fn = window.NizaAndroid?.[method];
      if (typeof fn !== "function") return reject(new Error(`Native method ${method} not available`));
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Native call ${method} timed out`));
      }, timeoutMs);
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      try {
        fn.call(window.NizaAndroid, id, JSON.stringify(args));
      } catch (e) {
        pending.delete(id);
        clearTimeout(timer);
        reject(e as Error);
      }
    });
  }
  return Promise.reject(new Error("Native bridge not available"));
}

/**
 * Lightweight handshake. Resolves to the set of capabilities the host
 * advertises, or an empty set (browser) after a short timeout. Never throws.
 */
export function initNativeBridge(timeoutMs = 1500): Promise<Set<string>> {
  if (typeof window === "undefined") return Promise.resolve(new Set());
  if (handshake) return handshake;
  handshake = (async () => {
    const h = detectHost();
    if (!h) return new Set<string>();
    host = h;
    installGlobals();
    if (h === "capacitor") {
      try {
        capPlugin()?.addListener?.("downloadEvent", (e: DownloadEvent) => emitDownload(e));
      } catch { /* ignore */ }
    }
    try {
      const res = await rawCall<{ capabilities?: string[] }>("getCapabilities", {}, timeoutMs);
      capabilities = new Set(res?.capabilities ?? []);
    } catch {
      // Older wrappers without getCapabilities: infer from exposed methods.
      const names = h === "legacy" ? Object.keys(window.NizaAndroid ?? {}) : Object.keys(capPlugin() ?? {});
      capabilities = new Set(names.filter((n) => typeof (h === "legacy" ? window.NizaAndroid : capPlugin())?.[n] === "function"));
      if (capabilities.size === 0) host = null;
    }
    return capabilities;
  })();
  return handshake;
}

export function isNizaAndroid(): boolean {
  return detectHost() !== null;
}

export function hasCapability(name: string): boolean {
  return host !== null && capabilities.has(name);
}

export function onDownloadEvent(listener: (e: DownloadEvent) => void) {
  downloadListeners.add(listener);
  return () => { downloadListeners.delete(listener); };
}

async function call<T>(method: string, args: Record<string, unknown> = {}, timeoutMs = 30_000): Promise<T> {
  await initNativeBridge();
  if (!hasCapability(method)) throw new Error(`Native method ${method} not available`);
  return rawCall<T>(method, args, timeoutMs);
}

/**
 * Download an APK through the native downloader and resolve when it is
 * completely written to disk. Progress is reported from real byte counts
 * emitted by Android — nothing here is simulated.
 */
export function nativeDownloadApk(
  opts: { url: string; fileName: string; appId?: string },
  onProgress: (loaded: number, total: number) => void,
): { downloadId: string; done: Promise<DownloadEvent>; cancel: () => Promise<void> } {
  const downloadId = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let off = () => {};
  const done = new Promise<DownloadEvent>((resolve, reject) => {
    off = onDownloadEvent((e) => {
      if (e.downloadId !== downloadId) return;
      if (e.state === "started" || e.state === "progress") onProgress(e.loaded, e.total);
      else if (e.state === "completed") { onProgress(e.loaded, e.total || e.loaded); off(); resolve(e); }
      else if (e.state === "failed") { off(); reject(new Error(e.error || "Download failed")); }
      else if (e.state === "cancelled") { off(); reject(new Error("Download cancelled")); }
    });
    call("downloadApk", { ...opts, downloadId }, 30_000).catch((err) => { off(); reject(err); });
  });
  return {
    downloadId,
    done,
    cancel: async () => { await call("cancelDownload", { downloadId }).catch(() => {}); },
  };
}

/** High-level API — every method rejects safely when unsupported. */
export const nativeBridge = {
  init: initNativeBridge,
  isAvailable: isNizaAndroid,
  hasCapability,
  installApk: (downloadId: string) => call<{ started: boolean }>("installApk", { downloadId }, 5 * 60_000),
  isPackageInstalled: (packageName: string) => call<PackageInfo>("isPackageInstalled", { packageName }),
  launchPackage: (packageName: string) => call<{ launched: boolean }>("launchPackage", { packageName }),
  uninstallPackage: (packageName: string) =>
    call<{ uninstalled: boolean }>("uninstallPackage", { packageName }, 5 * 60_000),
  requestPermission: (permission: string) => call<{ granted: boolean }>("requestPermission", { permission }),
  openSettings: (target: string) => call<{ opened: boolean }>("openSettings", { target }),
  getDeviceInfo: () =>
    call<{ androidVersion: string; sdkInt: number; model: string; abis: string[] }>("getDeviceInfo"),
};
