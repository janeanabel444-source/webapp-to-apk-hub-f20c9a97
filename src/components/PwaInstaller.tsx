import { useEffect } from "react";

/**
 * PWA install prompts are permanently suppressed for Niza App Store: the app
 * is distributed as a native APK with its own in-app updater, so browser
 * "Add to home screen" banners must never appear. Every beforeinstallprompt
 * event is intercepted and cancelled, and any install banner a previous
 * build may have rendered is removed.
 */
export function PwaInstaller() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const suppress = (e: Event) => {
      e.preventDefault();
    };
    window.addEventListener("beforeinstallprompt", suppress);

    // Remove any install banner left behind by an older build.
    document.querySelectorAll("[data-niza-pwa-banner]").forEach((el) => el.remove());

    // Guarded app-shell service-worker registration: skip in dev / Lovable
    // preview / iframes. Kept for offline support; it never shows a prompt.
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
      return () => window.removeEventListener("beforeinstallprompt", suppress);
    }
    if (import.meta.env.PROD && !isPreview && !inFrame && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => window.removeEventListener("beforeinstallprompt", suppress);
  }, []);

  return null;
}
