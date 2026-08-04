// Native bridge to the Niza Android wrapper.
//
// The Android app injects a JS interface named `NizaAndroid` and (optionally)
// dispatches `niza-android-response` CustomEvents for async replies. Every
// method is optional — we probe for it and gracefully fall back to the
// standard web behaviour when running in a normal browser.
//
// Android side (Kotlin) should expose something like:
//   webView.addJavascriptInterface(NizaBridge(activity), "NizaAndroid")
// with @JavascriptInterface methods matching the names below. Async replies
// travel back via: webView.evaluateJavascript("window.__nizaResolve(id, json)")

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };
const pending = new Map<string, Pending>();

declare global {
  interface Window {
    NizaAndroid?: Record<string, (...args: unknown[]) => unknown>;
    __nizaResolve?: (id: string, payload: string) => void;
  }
}

if (typeof window !== "undefined" && !window.__nizaResolve) {
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
}

export function isNizaAndroid(): boolean {
  return typeof window !== "undefined" && !!window.NizaAndroid;
}

function call<T = unknown>(method: string, args: Record<string, unknown> = {}, timeoutMs = 30_000): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!isNizaAndroid()) return reject(new Error("Native bridge not available"));
    const fn = window.NizaAndroid?.[method];
    if (typeof fn !== "function") return reject(new Error(`Native method ${method} not implemented`));
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Native call ${method} timed out`));
    }, timeoutMs);
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
    try {
      // The Android side receives (id, argsJson) and later calls __nizaResolve.
      fn.call(window.NizaAndroid, id, JSON.stringify(args));
    } catch (e) {
      pending.delete(id);
      clearTimeout(timer);
      reject(e as Error);
    }
  });
}

/** High-level API — every method is a graceful no-op / rejection on non-wrapper browsers. */
export const nativeBridge = {
  isAvailable: isNizaAndroid,

  /** Download an APK to device storage and hand it to the package installer. */
  installApk: (opts: { url: string; fileName: string; appId?: string }) =>
    call<{ installed: boolean }>("installApk", opts, 5 * 60_000),

  /** Ask the wrapper for a native permission. Returns { granted }. */
  requestPermission: (permission: string) =>
    call<{ granted: boolean }>("requestPermission", { permission }),

  /** Open a system settings page (e.g. "unknown_sources", "notifications"). */
  openSettings: (target: string) =>
    call<{ opened: boolean }>("openSettings", { target }),

  /** Check whether a package is installed on the device. */
  isPackageInstalled: (packageName: string) =>
    call<{ installed: boolean; versionName?: string }>("isPackageInstalled", { packageName }),

  /** Launch an installed app by package name. */
  launchPackage: (packageName: string) =>
    call<{ launched: boolean }>("launchPackage", { packageName }),

  /** Get device info (androidVersion, sdkInt, model, abis). */
  getDeviceInfo: () => call<{ androidVersion: string; sdkInt: number; model: string; abis: string[] }>("getDeviceInfo"),
};
