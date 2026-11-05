// Global, page-independent registry of active APK downloads.
//
// A download must never "reset" when the user navigates away and comes back:
// the state lives here (module-level, plus a localStorage snapshot that
// survives full page reloads while the native downloader keeps running).
// InstallButton reads it on mount and subscribes, so returning to an app
// page shows the real, ongoing progress instead of a fresh "Install" button.
//
// The custom `niza:download-progress` window event mirrors every change so
// any component can observe progress without importing the store.

export type ActiveDownload = {
  appId: string;
  appName: string;
  /** Native downloader job id — present only for bridge downloads. */
  downloadId?: string;
  /** Present only for browser downloads that can be aborted. */
  cancel?: () => Promise<void>;
  loaded: number;
  total: number;
  state: "downloading" | "installing";
  startedAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "niza:active-download";
const EVENT_NAME = "niza:download-progress";
/** Anything with no update for this long is treated as dead. */
const STALE_MS = 10 * 60 * 1000;

const listeners = new Set<(d: ActiveDownload | null) => void>();
let current: ActiveDownload | null = null;
let hydrated = false;
let bridgeAttached = false;

function readPersisted(): ActiveDownload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as ActiveDownload;
    if (!d?.appId) return null;
    // Drop dead entries: nothing updated for a long time, or a browser-only
    // download whose page was reloaded (its bytes can't be tracked anymore).
    if (Date.now() - d.updatedAt > STALE_MS) return null;
    if (!d.downloadId) return null;
    return d;
  } catch {
    return null;
  }
}

function persist() {
  try {
    if (current) localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => {
    try {
      l(current);
    } catch {
      /* listener errors never break the store */
    }
  });
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: current
          ? { appId: current.appId, loaded: current.loaded, total: current.total, state: current.state }
          : { appId: null, cleared: true },
      }),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Keep watching native download events so a download started on another page
 * (or before a full reload) continues to update this store.
 */
function attachBridgeWatcher() {
  if (bridgeAttached || typeof window === "undefined") return;
  bridgeAttached = true;
  void import("@/lib/native-bridge").then(({ onDownloadEvent }) => {
    onDownloadEvent((e) => {
      if (!current || current.downloadId !== e.downloadId) return;
      if (e.state === "started" || e.state === "progress") {
        update(e.loaded, e.total);
      } else if (e.state === "completed") {
        update(e.loaded, e.total || e.loaded);
        setState("installing");
      } else if (e.state === "failed" || e.state === "cancelled") {
        clear();
      }
    });
  });
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  current = readPersisted();
  if (current?.downloadId) attachBridgeWatcher();
}

export function getActiveDownload(appId?: string): ActiveDownload | null {
  hydrate();
  if (current && appId && current.appId !== appId) return null;
  return current;
}

export function subscribeActiveDownload(listener: (d: ActiveDownload | null) => void): () => void {
  hydrate();
  listeners.add(listener);
  // Emit the current state immediately so components adopt an in-flight
  // download on mount instead of flashing "Install".
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

/** Register that `appId` has started downloading. Replaces any stale entry. */
export function startActiveDownload(meta: {
  appId: string;
  appName: string;
  loaded?: number;
  total?: number;
}): ActiveDownload {
  hydrate();
  current = {
    appId: meta.appId,
    appName: meta.appName,
    loaded: meta.loaded ?? 0,
    total: meta.total ?? 0,
    state: "downloading",
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
  attachBridgeWatcher();
  emit();
  return current;
}

/** Adopt a persisted download (after reload) by attaching its cancel handle. */
export function adoptActiveDownload(appId: string, cancel?: () => Promise<void>): ActiveDownload | null {
  hydrate();
  if (!current || current.appId !== appId) return null;
  if (cancel) current.cancel = cancel;
  emit();
  return current;
}

export function updateActiveDownload(
  appId: string,
  loaded: number,
  total: number,
  extra?: { downloadId?: string },
): void {
  hydrate();
  if (!current || current.appId !== appId) return;
  current.loaded = loaded;
  current.total = total;
  if (extra?.downloadId) current.downloadId = extra.downloadId;
  current.updatedAt = Date.now();
  emit();
}

export function setActiveDownloadId(appId: string, downloadId: string | undefined, cancel?: () => Promise<void>): void {
  hydrate();
  if (!current || current.appId !== appId) return;
  if (downloadId) current.downloadId = downloadId;
  if (cancel) current.cancel = cancel;
  current.updatedAt = Date.now();
  emit();
}

export function setState(state: ActiveDownload["state"]): void {
  hydrate();
  if (!current) return;
  current.state = state;
  current.updatedAt = Date.now();
  emit();
}

/** End tracking (download finished installing, or was cancelled/failed). */
export function clearActiveDownload(appId?: string): void {
  hydrate();
  if (!current) return;
  if (appId && current.appId !== appId) return;
  current = null;
  emit();
}

export function downloadProgressPct(d: ActiveDownload): number {
  if (d.state === "installing") return 100;
  if (!d.total) return 0;
  return Math.min(100, (d.loaded / d.total) * 100);
}
