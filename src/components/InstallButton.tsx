import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, Trash2, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { installApp, uninstallApp, markInstalledAppUpdated, compareVersions } from "@/lib/store";
import { downloadApkWithProgress, isAndroidDevice } from "@/lib/apk-download";
import { formatBytes } from "@/lib/apk-parser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  appId: string;
  appName?: string;
  filePath?: string | null;
  appUrl?: string | null;
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


export function InstallButton({
  appId,
  appName = "app",
  filePath,
  appUrl,
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
  const [installed, setInstalled] = useState(initialInstalled);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showHelper, setShowHelper] = useState(false);
  const isPaid = license === "paid" && (priceKobo ?? 0) > 0;


  useEffect(() => setInstalled(initialInstalled), [initialInstalled]);

  const updateAvailable =
    installed &&
    !!latestVersion &&
    !!installedVersion &&
    compareVersions(latestVersion, installedVersion) > 0;

  async function runDownloadAndMark(markFn: () => Promise<void>, successMsg: string) {
    setBusy(true);
    setProgress(0);
    try {
      if (filePath) {
        // Real APK download — native wrapper handles installer, else browser stream.
        const result = await downloadApkWithProgress(filePath, appName, (loaded, total) => {
          setProgress(total ? (loaded / total) * 100 : 0);
        });
        if (result.nativeInstalled) {
          toast.success("Installing via Nova Android…");
        } else if (isAndroidDevice()) {
          setShowHelper(true);
          toast.success("APK downloaded — tap the notification to install");
        } else {
          toast.success("APK downloaded");
        }
      } else {
        // No file_path → simulate progress for installs without binaries.
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
      setInstalled(true);
      onChange?.(true);
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["install-state", appId] });
      toast.success(successMsg);
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
      // Paid apps route through checkout before install.
      toast.message(`Redirecting to checkout for ${formatNaira(priceKobo ?? 0)}…`);
      navigate({ to: "/premium" });
      return;
    }
    if (!filePath && appUrl) {
      // Web/PWA app — just open it and mark installed.
      window.open(appUrl, "_blank", "noopener,noreferrer");
    }
    await runDownloadAndMark(() => installApp(user.id, appId), "Installed");
  }


  async function handleUpdate() {
    if (!user) return;
    await runDownloadAndMark(() => markInstalledAppUpdated(user.id, appId), `Updated to v${latestVersion}`);
  }

  async function handleUninstall() {
    if (!user) return;
    setBusy(true);
    try {
      await uninstallApp(user.id, appId);
      setInstalled(false);
      onChange?.(false);
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["install-state", appId] });
      toast.message("Removed from your library");
    } catch {
      toast.error("Couldn't remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {renderButton()}
      {showHelper && (
        <AndroidInstallHelper appName={appName} onDismiss={() => setShowHelper(false)} />
      )}
    </>
  );

  function renderButton() {
    if (installed && !busy) {
      return (
        <div className="flex items-center gap-2">
          {updateAvailable ? (
            <Button
              onClick={handleUpdate}
              className={cn("rounded-full font-semibold text-primary-foreground shadow-md", variant === "compact" ? "h-9 px-4 text-sm" : "h-11 px-7")}
              style={{ background: "var(--gradient-primary)" }}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" /> Update{apkSize ? ` · ${formatBytes(apkSize)}` : ""}
            </Button>
          ) : (
            <Button
              className={cn("rounded-full font-semibold", variant === "compact" ? "h-9 px-4 text-sm" : "h-11 px-7")}
              variant="secondary"
              onClick={() => toast.message("Opening " + appName)}
            >
              <Check className="mr-1.5 h-4 w-4" /> Open
            </Button>
          )}
          {variant !== "compact" && (
            <Button variant="ghost" size="icon" className="rounded-full" onClick={handleUninstall} disabled={busy} aria-label="Uninstall">
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
              <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-primary)" strokeWidth={stroke} fill="none"
                strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (progress / 100) * c}
                style={{ transition: "stroke-dashoffset 60ms linear" }} />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold tabular-nums text-primary">{Math.round(progress)}</span>
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

    return (
      <Button
        onClick={handleInstall}
        disabled={busy}
        className={cn(
          "rounded-full font-semibold shadow-md transition hover:shadow-lg",
          isDemo ? "bg-muted text-muted-foreground hover:bg-muted" : "text-primary-foreground",
          variant === "compact" ? "h-9 px-4 text-sm" : "h-11 px-7",
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
        <li>If prompted, allow <span className="font-medium text-foreground">"Install unknown apps"</span> for your browser, then tap Install.</li>
      </ol>
      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="ghost" className="rounded-full" onClick={onDismiss}>Got it</Button>
      </div>
    </div>
  );
}
