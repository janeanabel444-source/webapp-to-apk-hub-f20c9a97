import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Registers the app-shell service worker (only in production browser contexts)
 * and shows a small "Install Nova" prompt when the browser fires
 * beforeinstallprompt.
 */
export function PwaInstaller() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Guarded service-worker registration: skip in dev / Lovable preview / iframes.
    const host = window.location.hostname;
    const isPreview =
      host.startsWith("id-preview--") ||
      host.startsWith("preview--") ||
      host.endsWith(".lovableproject.com") ||
      host.endsWith(".lovableproject-dev.com") ||
      host.endsWith(".beta.lovable.dev");
    const inFrame = window.top !== window.self;
    const killed = new URL(window.location.href).searchParams.get("sw") === "off";

    if (killed) {
      navigator.serviceWorker?.getRegistrations().then((rs) =>
        rs.forEach((r) => r.unregister()),
      );
      return;
    }
    if (import.meta.env.PROD && !isPreview && !inFrame && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!evt || hidden) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur">
      <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Install Nova App Store</p>
        <p className="truncate text-xs text-muted-foreground">Add Nova to your home screen.</p>
      </div>
      <Button
        size="sm"
        className="rounded-full"
        onClick={async () => {
          await evt.prompt();
          await evt.userChoice;
          setEvt(null);
        }}
      >
        <Download className="mr-1 h-3.5 w-3.5" /> Install
      </Button>
      <button onClick={() => setHidden(true)} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
