import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, Trash2, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
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
import { downloadApkWithProgress, isAndroidDevice } from "@/lib/apk-download";
import { nativeBridge, isNizaAndroid } from "@/lib/native-bridge";
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
  isDemo?: boolean;
  installedVersion?: string | null;
  latestVersion?: string | null;
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
  isDemo = false,
  installedVersion,
  latestVersion,
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
  const isPaid = license === "paid" && (priceKobo ?? 0) > 0;
  const canProbe = isNizaAndroid() && !!packageName;

  useEffect(() => setInLibrary(initialInstalled), [initialInstalled]);

  /** Ask the Android wrapper whether the package is really on this device. */
  const probeDevice = useCallback(async () => {
    if (!canProbe) return;
    setChecking(true);
    try {
      const res = await nativeBridge.isPackageInstalled(packageName!);
      setDeviceInstalled(!!res?.installed);
    } catch {
      setDeviceInstalled(null);
    } finally {
      setChecking(false);
    }
  }, [canProbe, packageName]);

  // Sync with the real device state on mount and whenever the app regains focus
  // (the user may have installed or uninstalled it in the Android installer).
  useEffect(() => {
    if (!canProbe) {
      setDeviceInstalled(null);
      return;
    }
    void probeDevice();
    const onFocus = () => void probeDevice();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [canProbe, probeDevice]);

  const updateAvailable =
    inLibrary &&
    !!latestVersion &&
    !!installedVersion &&
    compareVersions(latestVersion, installedVersion) > 0;

  /** We only claim the app is openable when the device confirms it, or it's a hosted web app. */
  const confirmedOnDevice = deviceInstalled === true;
  const canOpen = confirmedOnDevice || (!filePath && !!appUrl);
  /** In library but the device says it isn't installed → the install never finished. */
  const needsFinish = inLibrary && canProbe && deviceInstalled === false;

  async function runDownloadAndMark(markFn: () => Promise<void>, successMsg: string) {
    setBusy(true);
    setProgress(0);
    try {
      if (filePath) {
        const result = await downloadApkWithProgress(filePath, appName, (loaded, total) => {
          setProgress(total ? (loaded / total) * 100 : 0);
        });
        if (result.nativeInstalled) {
          toast.success("Installing via Niza Android…");
        } else if (isAndroidDevice()) {
          setShowHelper(true);
          toast.success("APK downloaded — tap the notification to install");
        } else {
          toast.success("APK downloaded");
        }
      } else {
        const start = performance.now();
        const dur = 1000;
        await new Promise<void>((resolve) => {
          const tick = () => {
            const p = Math.min(100, ((performance.now() - start) / dur) * 100);
            setProgress(p);
            if (p < 100) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
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
      toast.error(err?.message ?? "Couldn't complete — please try again");
    } finally {
      setBusy(false);
      setProgress(0);
    }
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
    if (!user) return;
    await runDownloadAndMark(() => markInstalledAppUpdated(user.id, appId), `Updated to v${latestVersion}`);
  }

  async function handleOpen() {
    if (confirmedOnDevice && packageName) {
      try {
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
    if (!user) return;
    setBusy(true);
    try {
      // Ask Android to remove the package first when we know it's installed.
      if (confirmedOnDevice && packageName) {
        try {
          await nativeBridge.uninstallPackage(packageName);
        } catch (e: any) {
          toast.error(e?.message ?? "Android couldn't remove the app");
        }
        await probeDevice();
      }
      await uninstallApp(user.id, appId);
      setInLibrary(false);
      onChange?.(false);
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["install-state", appId] });
      toast.message(`${appName} removed`);
    } catch {
      toast.error("Couldn't remove");
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
                : "This removes the app from your Niza library. If it's still on your device, uninstall it from Android settings."}
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
          {variant !== "compact" && (
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
        </div>
      );
    }

    // Not in the library, but Android says the package is already on the device.
    if (!inLibrary && confirmedOnDevice) {
      return (
        <Button className={cn("rounded-full font-semibold", sizeCls)} variant="secondary" onClick={handleOpen}>
          <Check className="mr-1.5 h-4 w-4" /> Open
        </Button>
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
