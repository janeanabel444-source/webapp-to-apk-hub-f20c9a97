import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Play, Loader2, ExternalLink, Gift, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pickAdForReward, claimAdReward, recordAdClick } from "@/lib/ads.functions";
import { toast } from "sonner";

type PickResult = Awaited<ReturnType<Awaited<ReturnType<typeof useServerFn<typeof pickAdForReward>>>>>;

export function AdViewer({ onRewarded, onClose }: { onRewarded: (bonus: number) => void; onClose: () => void }) {
  const pickFn = useServerFn(pickAdForReward);
  const claimFn = useServerFn(claimAdReward);
  const clickFn = useServerFn(recordAdClick);

  const [ad, setAd] = useState<PickResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [claimed, setClaimed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shotIndex, setShotIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await pickFn({ data: undefined as never });
        setAd(res);
        setRemaining(res.requiredSeconds);
      } catch (e: any) {
        setError(e?.message === "NO_ADS_AVAILABLE"
          ? "No ads available right now — check back soon."
          : (e?.message ?? "Could not load an ad."));
      } finally {
        setLoading(false);
      }
    })();
  }, [pickFn]);

  // Countdown timer; also cycles screenshot ads.
  useEffect(() => {
    if (!ad) return;
    const t = setInterval(() => {
      setRemaining((s) => (s > 0 ? s - 1 : 0));
      if (ad.format === "screenshot" && ad.screenshotUrls.length > 1) {
        setShotIndex((i) => (i + 1) % ad.screenshotUrls.length);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [ad]);

  async function onClaim() {
    if (!ad || claimed || remaining > 0) return;
    setBusy(true);
    try {
      const r = await claimFn({ data: { sessionId: ad.sessionId } });
      setClaimed(true);
      onRewarded(r.bonusCredits);
      toast.success("+1 Image Generation Credit earned!");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not credit reward.");
    } finally { setBusy(false); }
  }

  async function onInstall() {
    if (!ad) return;
    try { await clickFn({ data: { campaignId: ad.campaignId } }); } catch { /* non-blocking */ }
    window.open(`/app/${ad.app.slug}`, "_blank", "noopener");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sponsored</span>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading && (
          <div className="grid h-72 place-items-center text-sm text-muted-foreground">
            <Loader2 className="mb-2 h-6 w-6 animate-spin" /> Loading advertisement…
          </div>
        )}

        {error && !loading && (
          <div className="p-6 text-center text-sm text-muted-foreground">{error}</div>
        )}

        {ad && !error && (
          <>
            <div className="relative aspect-[9/16] max-h-[60vh] bg-black">
              {ad.format === "video" && ad.videoUrl && (
                <video
                  ref={videoRef}
                  src={ad.videoUrl}
                  autoPlay
                  playsInline
                  className="h-full w-full object-contain"
                  onEnded={() => setRemaining(0)}
                />
              )}
              {ad.format === "screenshot" && ad.screenshotUrls[shotIndex] && (
                <img
                  src={ad.screenshotUrls[shotIndex]}
                  alt=""
                  className="h-full w-full object-contain"
                />
              )}
              {remaining > 0 && (
                <div className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                  Reward in {remaining}s
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-border/50 p-4">
              {ad.app.iconUrl && (
                <img src={ad.app.iconUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-bold">{ad.app.name}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {ad.app.shortDescription ?? ad.app.tagline ?? "Discover this app on Nova."}
                </p>
              </div>
              <Button size="sm" onClick={onInstall} className="rounded-full">
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Install
              </Button>
            </div>

            <div className="border-t border-border/50 p-4">
              {claimed ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/10 py-3 text-sm font-medium text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> +1 Image Credit added
                </div>
              ) : (
                <Button
                  onClick={onClaim}
                  disabled={remaining > 0 || busy}
                  className="w-full rounded-full"
                >
                  {busy
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Crediting…</>
                    : remaining > 0
                      ? <><Play className="mr-2 h-4 w-4" /> Watch for {remaining}s to earn</>
                      : <><Gift className="mr-2 h-4 w-4" /> Claim +1 Image Credit</>}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
