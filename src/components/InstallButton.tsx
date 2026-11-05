import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, Trash2, RefreshCw, ExternalLink, Loader2, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { installApp, uninstallApp, markInstalledAppUpdated, compareVersions } from "@/lib/store";
import { downloadApkWithProgress, isAndroidDevice, isDownloadCancelled } from "@/lib/apk-download";
import {
  startActiveDownload,
  updateActiveDownload,
  setActiveDownloadId,
  clearActiveDownload,
  getActiveDownload,
  subscribeActiveDownload,
  downloadProgressPct,
  setState as setDownloadState,
} from "@/lib/download-store";
import { nativeBridge, initNativeBridge, hasCapability } from "@/lib/native-bridge";
import { formatBytes } from "@/lib/apk-parser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  appId: string;
  appName?: string;
  filePath?: string | null;
  appUrl?: string | null;
  packageName?: string | null;
  initialInstalled: boolean;
  variant?: "default" | "compact";
  /** Compact slots hide uninstall by default; pass true to expose it (e.g. Library). */
  showUninstall?: boolean;
  isDemo?: boolean;
  installedVersion?: string | null;
  latestVersion?: string | null;
  downloadUrl?: string | null;
  apkSize?: number | null;
  license?: "free" | "paid" | null;
  priceKobo?: number | null;
  onChange?: (installed: boolean) => void;
};

function formatNaira(kobo: number) {
  const n = kobo / 100;
  return `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

/** null = unknown (no native bridge / no package name), true/false = confirmed device state. */
type DeviceState = boolean | null;

export function InstallButton({
  appId,
  appName = "app",
  filePath,
  appUrl,
  packageName,
  initialInstalled,
  variant = "default",
  showUninstall = false,
  isDemo = false,
  installedVersion,
  latestVersion,
  downloadUrl,
  apkSize,
  license = "free",
  priceKobo = 0,
  onChange,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [inLibrary, setInLibrary] = useState(initialInstalled);
  const [deviceInstalled, setDeviceInstalled] = useState<DeviceState>(null);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showHelper, setShowHelper] = useState(false);
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // Cancel handle for an in-flight download; null when not downloading.
  const cancelRef = useRef<(() => Promise<void>) | null>(null);
  // Mirrors `busy` for the global download subscriber (closures see stale state).
  const busyRef = useRef(false);
  // True while this button is displaying a download it did not start itself.
  const adoptedRef = useRef(false);
  // Progress is throttled to one React update every 700ms — completion and
  // cancellation render immediately.
  const lastEmitRef = useRef(0);
  const isPaid = license === "paid" && (priceKobo ?? 0) > 0;
  const [nativeReady, setNativeReady] = useState(false);
  const [deviceVersion, setDeviceVersion] = useState<string | null>(null);
  const canProbe = nativeReady && !!packageName && hasCapability("isPackageInstalled");

  // Capability handshake — resolves to browser mode after a short timeout.
  useEffect(() => {
    let alive = true;
    initNativeBridge().then(() => alive && setNativeReady(true)).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => setInLibrary(initialInstalled), [initialInstalled]);

  /** Ask the Android wrapper whether the package is really on this device.
   *  Returns the confirmed state (true/false) or null when it can't be probed. */
  const probeDevice = useCallback(async (): Promise<DeviceState> => {
    if (!canProbe || !packageName) return null;
    setChecking(true);
    try {
      const res = await nativeBridge.isPackageInstalled(packageName);
      const installed = !!res?.installed;
      setDeviceInstalled(installed);
      setDeviceVersion(installed ? res.versionName ?? null : null);
      return installed;
    } catch {
      setDeviceInstalled(null);
      setDeviceVersion(null);
      return null;
    } finally {
      setChecking(false);
    }
  }, [canProbe, packageName]);

  // Sync with the real device state on mount and whenever the app regains focus
  // (the user may have installed or uninstalled it in the Android installer).
  useEffect(() => {
    setDeviceInstalled(null);
    setDeviceVersion(null);
    if (!canProbe) {
      return;
    }
    void probeDevice();
    const onFocus = () => { if (document.visibilityState === "visible") void probeDevice(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("niza:foreground", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("niza:foreground", onFocus);
    };
  }, [canProbe, probeDevice, latestVersion]);

  // Prefer the real on-device version; fall back to the library record.
  const effectiveInstalled = deviceInstalled === true ? deviceVersion ?? installedVersion : installedVersion;
  const updateAvailable =
    (inLibrary || deviceInstalled === true) &&
    !!latestVersion &&
    !!effectiveInstalled &&
    compareVersions(latestVersion, effectiveInstalled) > 0;

  /** We only claim the app is openable when the device confirms it, or it's a hosted web app. */
  const confirmedOnDevice = deviceInstalled === true;
  const canOpen = confirmedOnDevice || (!filePath && !!appUrl);
  /** In library but the device says it isn't installed → the install never finished. */
  const needsFinish = inLibrary && canProbe && deviceInstalled === false;

  /** Push download progress to React at most every 700ms (smooth on budget
   *  devices); 100% renders immediately on completion. Also feeds the global
   *  download store so other pages show the same progress. */
  const pushProgress = useCallback((loaded: number, total: number) => {
    updateActiveDownload(appId, loaded, total);
    const pct = total ? (loaded / total) * 100 : 0;
    if (pct >= 100) {
      lastEmitRef.current = Date.now();
      setProgress(100);
      return;
    }
    const now = Date.now();
    if (now - lastEmitRef.current >= 700) {
      lastEmitRef.current = now;
      setProgress(pct);
    }
  }, [appId]);

  // Adopt a download that is already running globally (started on another
  // page, or before a full reload — the native downloader keeps running).
  useEffect(() => {
    const adopt = (d: NonNullable<ReturnType<typeof getActiveDownload>>) => {
      adoptedRef.current = true;
      setBusy(true);
      setProgress(downloadProgressPct(d));
      const nativeCancel =
        d.downloadId && hasCapability("cancelDownload")
          ? () => nativeBridge.cancelDownload(d.downloadId!)
          : null;
      cancelRef.current = d.cancel ?? nativeCancel;
    };
    return subscribeActiveDownload((d) => {
      if (d && d.appId === appId) {
        if (!busyRef.current) adopt(d);
      } else if (!d && adoptedRef.current) {
        adoptedRef.current = false;
        cancelRef.current = null;
        setProgress(0);
        if (!busyRef.current) setBusy(false);
      }
    });
  }, [appId]);

  async function runDownloadAndMark(markFn: () => Promise<void>, successMsg: string) {
    setBusy(true);
    busyRef.current = true;
    setProgress(0);
    lastEmitRef.current = 0;
    if (filePath) startActiveDownload({ appId, appName, total: apkSize ?? 0 });
    try {
      if (filePath) {
        const result = await downloadApkWithProgress(filePath, appName, pushProgress, downloadUrl ?? undefined, (handle) => {
          cancelRef.current = handle.cancel;
          setActiveDownloadId(appId, handle.downloadId, handle.cancel);
        });
        cancelRef.current = null;
        setProgress(100);
        if (result.nativeInstalled) {
          setDownloadState("installing");
          toast.success("Installing via Niza Android…");
        } else if (isAndroidDevice()) {
          setShowHelper(true);
          toast.success("APK downloaded — tap the notification to install");
        } else {
          toast.success("APK downloaded");
        }
      }
      await markFn();
      setInLibrary(true);
      onChange?.(true);
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["install-state", appId] });
      toast.success(successMsg);
      // Re-check the device once the installer has had a moment to finish.
      if (canProbe) setTimeout(() => void probeDevice(), 2500);
    } catch (err: any) {
      cancelRef.current = null;
      if (isDownloadCancelled(err)) {
        toast.info("Download cancelled");
      } else {
        toast.error(err?.message ?? "Couldn't complete — please try again");
      }
    } finally {
      // The download is no longer active — clear the global tracker first so
      // subscribers see a clean end state, then reset local UI.
      clearActiveDownload(appId);
      adoptedRef.current = false;
      busyRef.current = false;
      setBusy(false);
      setCancelling(false);
      setProgress(0);
      cancelRef.current = null;
    }
  }

  async function cancelDownload() {
    const cancel = cancelRef.current;
    if (!cancel) {
      setCancelling(false);
      return;
    }
    setCancelling(true);
    await cancel();
  }

  async function handleInstall() {
    if (isDemo) return toast.info("Demo can't install — this app is a preview placeholder.");
    if (!user) return navigate({ to: "/auth", search: { redirect: window.location.pathname } });
    if (isPaid) {
      toast.message(`Redirecting to checkout for ${formatNaira(priceKobo ?? 0)}…`);
      navigate({ to: "/premium" });
      return;
    }
    if (!filePath && appUrl) {
      window.open(appUrl, "_blank", "noopener,noreferrer");
    }
    await runDownloadAndMark(() => installApp(user.id, appId), "Installed");
  }

  async function handleUpdate() {
    if (!user) return navigate({ to: "/auth", search: { redirect: window.location.pathname } });
    await runDownloadAndMark(() => markInstalledAppUpdated(user.id, appId), `Updated to v${latestVersion}`);
  }

  async function handleOpen() {
    if (confirmedOnDevice && packageName) {
      try {
        if (!hasCapability("launchPackage")) throw new Error(`Open ${appName} from your device's app list`);
        await nativeBridge.launchPackage(packageName);
        return;
      } catch (e: any) {
        toast.error(e?.message ?? `Couldn't open ${appName}`);
        void probeDevice();
        return;
      }
    }
    if (appUrl) {
      window.open(appUrl, "_blank", "noopener,noreferrer");
      return;
    }
    toast.message(`Open ${appName} from your device's app list`);
  }

  async function doUninstall() {
    setBusy(true);
    try {
      // Direct native uninstall — Android shows its own confirmation dialog.
      if (confirmedOnDevice && packageName && hasCapability("uninstallPackage")) {
        await nativeBridge.uninstallPackage(packageName);
        await probeDevice();
      }
      if (inLibrary && user) {
        await uninstallApp(user.id, appId);
        setInLibrary(false);
        onChange?.(false);
        qc.invalidateQueries({ queryKey: ["library"] });
        qc.invalidateQueries({ queryKey: ["install-state", appId] });
        toast.message(`${appName} removed`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't remove");
    } finally {
      setBusy(false);
      setConfirmUninstall(false);
    }
  }

  return (
    <>
      {renderButton()}
      {showHelper && <AndroidInstallHelper appName={appName} onDismiss={() => setShowHelper(false)} />}
      <AlertDialog open={confirmUninstall} onOpenChange={setConfirmUninstall}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uninstall {appName}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmedOnDevice
                ? "This removes the app from your device and from your Niza library. Your app data may be deleted."
                : "This removes the app from your Niza library."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void doUninstall();
              }}
              disabled={busy}
            >
              {busy ? "Removing…" : "Uninstall"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  function renderButton() {
    const sizeCls = variant === "compact" ? "h-9 px-4 text-sm" : "h-11 px-7";

    if (inLibrary && !busy) {
      return (
        <div className="flex items-center gap-2">
          {updateAvailable ? (
            <Button
              onClick={handleUpdate}
              className={cn("rounded-full font-semibold text-primary-foreground shadow-md", sizeCls)}
              style={{ background: "var(--gradient-primary)" }}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" /> Update{apkSize ? ` · ${formatBytes(apkSize)}` : ""}
            </Button>
          ) : needsFinish ? (
            <Button
              onClick={handleInstall}
              className={cn("rounded-full font-semibold text-primary-foreground shadow-md", sizeCls)}
              style={{ background: "var(--gradient-primary)" }}
            >
              <Download className="mr-1.5 h-4 w-4" /> Finish install
            </Button>
          ) : canOpen ? (
            <Button className={cn("rounded-full font-semibold", sizeCls)} variant="secondary" onClick={handleOpen}>
              {appUrl && !filePath ? <ExternalLink className="mr-1.5 h-4 w-4" /> : <Check className="mr-1.5 h-4 w-4" />}
              Open
            </Button>
          ) : (
            <Button className={cn("rounded-full font-semibold", sizeCls)} variant="secondary" disabled>
              {checking ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              {checking ? "Checking device…" : "Installed"}
            </Button>
          )}
          {variant !== "compact" && filePath && !updateAvailable && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => void runDownloadAndMark(async () => {}, "Downloaded again")}
              disabled={busy}
              aria-label="Download APK again"
              title="Download APK again"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          {(variant !== "compact" || showUninstall) && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setConfirmUninstall(true)}
              disabled={busy}
              aria-label="Uninstall"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      );
    }

    if (busy && progress > 0) {
      const size = variant === "compact" ? 36 : 44;
      const stroke = 3;
      const r = (size - stroke) / 2;
      const c = 2 * Math.PI * r;
      return (
        <div className="flex items-center gap-3" aria-label="Downloading">
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-border)" strokeWidth={stroke} fill="none" />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke="var(--color-primary)"
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c - (progress / 100) * c}
                style={{ transition: "stroke-dashoffset 60ms linear" }}
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold tabular-nums text-primary">
              {Math.round(progress)}
            </span>
          </div>
          {variant !== "compact" && (
            <span className="text-sm text-muted-foreground">
              {filePath ? "Downloading APK…" : "Installing…"}
              {apkSize ? ` · ${formatBytes(apkSize)}` : ""}
            </span>
          )}
          {filePath && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => void cancelDownload()}
              disabled={cancelling}
              aria-label="Cancel download"
            >
              {cancelling ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1 h-3.5 w-3.5" />}
              Cancel
            </Button>
          )}
        </div>
      );
    }

    // Not in the library, but Android says the package is already on the device.
    if (!inLibrary && confirmedOnDevice && updateAvailable) {
      return (
        <Button onClick={handleUpdate} className={cn("rounded-full font-semibold text-primary-foreground shadow-md", sizeCls)} style={{ background: "var(--gradient-primary)" }}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Update
        </Button>
      );
    }
    // Not in the library, but Android says the package is already on the device:
    // offer Open alongside a direct native Uninstall (no settings detour).
    if (!inLibrary && confirmedOnDevice) {
      return (
        <div className="flex items-center gap-2">
          <Button className={cn("rounded-full font-semibold", sizeCls)} variant="secondary" onClick={handleOpen}>
            <Check className="mr-1.5 h-4 w-4" /> Open
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => void doUninstall()}
            disabled={busy}
            aria-label="Uninstall"
            title="Uninstall from device"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <Button
        onClick={handleInstall}
        disabled={busy}
        className={cn(
          "rounded-full font-semibold shadow-md transition hover:shadow-lg",
          isDemo ? "bg-muted text-muted-foreground hover:bg-muted" : "text-primary-foreground",
          sizeCls,
        )}
        style={isDemo ? undefined : { background: "var(--gradient-primary)" }}
        title={isDemo ? "Demo app — downloads not available" : undefined}
      >
        <Download className="mr-1.5 h-4 w-4" />
        {isDemo ? "Demo only" : isPaid ? `Buy · ${formatNaira(priceKobo ?? 0)}` : "Install"}
        {!isDemo && !isPaid && apkSize ? <span className="ml-1 text-xs opacity-80">· {formatBytes(apkSize)}</span> : null}
      </Button>
    );
  }
}

function AndroidInstallHelper({ appName, onDismiss }: { appName: string; onDismiss: () => void }) {
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-border/60 bg-card/95 p-4 shadow-lg backdrop-blur">
      <p className="text-sm font-semibold">Finish installing {appName}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        <li>Open the download notification (or the Downloads folder).</li>
        <li>Tap the APK file to start the Android installer.</li>
        <li>
          If prompted, allow <span className="font-medium text-foreground">"Install unknown apps"</span> for your browser,
          then tap Install.
        </li>
      </ol>
      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="ghost" className="rounded-full" onClick={onDismiss}>
          Got it
        </Button>
      </div>
    </div>
  );
}
