import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { installApp, uninstallApp } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  appId: string;
  initialInstalled: boolean;
  variant?: "default" | "compact";
  isDemo?: boolean;
  onChange?: (installed: boolean) => void;
};

export function InstallButton({ appId, initialInstalled, variant = "default", isDemo = false, onChange }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [installed, setInstalled] = useState(initialInstalled);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => setInstalled(initialInstalled), [initialInstalled]);

  async function handleInstall() {
    if (isDemo) {
      toast.info("This is a demo app for preview purposes only. Downloads are not available.");
      return;
    }
    if (!user) {
      navigate({ to: "/auth", search: { redirect: window.location.pathname } });
      return;
    }
    setBusy(true);
    setProgress(0);
    const start = performance.now();
    const duration = 1400;
    const tick = () => {
      const elapsed = performance.now() - start;
      const p = Math.min(100, (elapsed / duration) * 100);
      setProgress(p);
      if (p < 100) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    try {
      await installApp(user.id, appId);
      await new Promise((r) => setTimeout(r, Math.max(0, duration - (performance.now() - start))));
      setInstalled(true);
      onChange?.(true);
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["install-state", appId] });
      toast.success("Installed");
    } catch (e) {
      toast.error("Couldn't install — please try again");
    } finally {
      setBusy(false);
      setProgress(0);
    }
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

  if (installed) {
    return (
      <div className="flex items-center gap-2">
        <Button
          className={cn(
            "rounded-full font-semibold",
            variant === "compact" ? "h-9 px-4 text-sm" : "h-11 px-7",
          )}
          variant="secondary"
          onClick={() => toast.message("Opening " + (variant === "compact" ? "app" : "this app"))}
        >
          <Check className="mr-1.5 h-4 w-4" /> Open
        </Button>
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
      <div className="flex items-center gap-3" aria-label="Installing">
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
        {variant !== "compact" && <span className="text-sm text-muted-foreground">Installing…</span>}
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
      <Download className="mr-1.5 h-4 w-4" /> {isDemo ? "Demo only" : "Install"}
    </Button>
  );
}
