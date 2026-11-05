import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { compareVersions } from "@/lib/store";
import { downloadApkWithProgress, isDownloadCancelled } from "@/lib/apk-download";
import { initNativeBridge, nativeBridge, hasCapability } from "@/lib/native-bridge";
import { toast } from "sonner";

// In-app update prompt for the Niza Store wrapper itself. When the web app
// runs inside the native Android APK (package com.niza.marketplace) and a
// newer release of Niza Store is live, the user is asked to update; tapping
// Update downloads the new APK through the native bridge and hands it to the
// Android installer. The store listing itself stays unlisted/publicly hidden.

const NIZA_STORE_APP_ID = "c8261fad-30f4-40a0-baa5-fa22ab76e08a";
const NIZA_STORE_PACKAGE = "com.niza.marketplace";
const SNOOZE_KEY = "niza:store-update-snooze";
const SNOOZE_MS = 24 * 60 * 60 * 1000;

type Detected = { latest: string; installed: string };

export function NizaStoreUpdatePrompt() {
  const [update, setUpdate] = useState<Detected | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [installing, setInstalling] = useState(false);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    try {
      await initNativeBridge();
      if (!hasCapability("isPackageInstalled")) return;
      const info = await nativeBridge.isPackageInstalled(NIZA_STORE_PACKAGE).catch(() => null);
      if (!info?.installed) return;
      // RLS already allows public read of live published apps.
      const { data } = await supabase
        .from("apps")
        .select("version")
        .eq("id", NIZA_STORE_APP_ID)
        .maybeSingle();
      if (!data?.version) return;
      if (compareVersions(data.version, info.versionName ?? "0") <= 0) {
        setUpdate(null);
        return;
      }
      // Respect a "Later" snooze, but always re-check when a new release lands.
      const snoozedAt = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
      if (snoozedAt && Date.now() - snoozedAt < SNOOZE_MS) {
        setUpdate(null);
        return;
      }
      setUpdate({ latest: data.version, installed: info.versionName ?? "" });
    } catch {
      /* never break the app over an update check */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await check();
    })();
    const onFg = () => {
      if (alive) void check();
    };
    window.addEventListener("niza:foreground", onFg);
    window.addEventListener("focus", onFg);
    return () => {
      alive = false;
      window.removeEventListener("niza:foreground", onFg);
      window.removeEventListener("focus", onFg);
    };
  }, [check]);

  async function handleUpdate() {
    if (!update) return;
    setBusy(true);
    setPct(0);
    try {
      const url = `${window.location.origin}/download/${NIZA_STORE_APP_ID}`;
      const result = await downloadApkWithProgress("self-update", "Niza Store", (loaded, total) => {
        setPct(total ? Math.round((loaded / total) * 100) : 0);
      }, url);
      if (result.nativeInstalled) {
        setInstalling(true);
        toast.success("Niza Store is installing — Android will prompt you to confirm.");
      }
    } catch (e: any) {
      if (!isDownloadCancelled(e)) toast.error(e?.message ?? "Update failed — please try again");
    } finally {
      setBusy(false);
      setInstalling(false);
      setPct(null);
    }
  }

  function snooze() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setUpdate(null);
  }

  if (!update) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-border/60 bg-card/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10">
          <RefreshCw className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Update Niza App Store</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Version {update.latest} is available (you have {update.installed || "an older version"}). The update installs
            through the Niza updater and keeps your apps and library.
          </p>
          {pct !== null && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {installing ? "Installing…" : `Downloading update… ${pct}%`}
              </p>
            </div>
          )}
          <div className="mt-3 flex items-center justify-end gap-2">
            {pct === null && (
              <Button size="sm" variant="ghost" className="rounded-full" onClick={snooze} disabled={busy}>
                <X className="mr-1 h-3.5 w-3.5" /> Later
              </Button>
            )}
            {pct === null && (
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => void handleUpdate()}
                disabled={busy}
              >
                <Download className="mr-1 h-3.5 w-3.5" /> Update now
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
