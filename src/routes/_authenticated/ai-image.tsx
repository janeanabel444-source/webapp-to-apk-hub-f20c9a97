import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Sparkles, Crown, Download, Loader2, Images, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getMyAiQuota } from "@/lib/ai-quota.functions";
import { generateImage } from "@/lib/stability.functions";
import { listMyImages } from "@/lib/ai-images.functions";

export const Route = createFileRoute("/_authenticated/ai-image")({
  head: () => ({ meta: [{ title: "AI Image Generation — Nova" }] }),
  component: AiImagePage,
});

function AiImagePage() {
  const qc = useQueryClient();
  const getQuota = useServerFn(getMyAiQuota);
  const gen = useServerFn(generateImage);
  const listMine = useServerFn(listMyImages);

  const { data: quota, isLoading: quotaLoading } = useQuery({
    queryKey: ["ai-quota"],
    queryFn: () => getQuota({ data: undefined as never }),
  });
  const { data: mine } = useQuery({
    queryKey: ["my-ai-images"],
    queryFn: () => listMine({ data: undefined as never }),
    enabled: !!quota && (quota.unlimited || quota.quota !== 0),
  });

  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);

  async function doGenerate(p: string) {
    setErr(null);
    setBusy(true);
    setPreview(null);
    try {
      const res = await gen({ data: { prompt: p } });
      setPreview(res.dataUrl);
      setLastPrompt(p);
      qc.invalidateQueries({ queryKey: ["my-ai-images"] });
      qc.invalidateQueries({ queryKey: ["ai-gallery"] });
      qc.invalidateQueries({ queryKey: ["ai-quota"] });
    } catch (e: any) {
      const m = e?.message ?? "Generation failed";
      if (m === "AI_QUOTA_NONE") setErr("You have no AI image generations. Redeem a promo code or go Premium.");
      else if (m === "AI_QUOTA_EXCEEDED") setErr("Daily AI image limit reached. Try again tomorrow.");
      else setErr(m);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = prompt.trim();
    if (!p || busy) return;
    setPrompt("");
    await doGenerate(p);
  }

  if (quotaLoading) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (quota && !quota.unlimited && quota.quota === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-border/60 bg-card p-8 text-center">
          <Crown className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-3 font-display text-2xl font-bold">AI image generation needs access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Redeem a valid promo code for 20 images/day, or upgrade to Premium for unlimited access.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild className="rounded-full"><Link to="/redeem">Redeem promo code</Link></Button>
            <Button asChild variant="outline" className="rounded-full"><Link to="/premium">Go Premium</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl font-bold">Create AI Image</h1>
        {quota && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {quota.unlimited ? "Unlimited" : `${quota.remaining}/${quota.quota} today`}
          </span>
        )}
        <Button asChild variant="outline" size="sm" className="ml-auto rounded-full">
          <Link to="/ai-gallery"><Images className="mr-1.5 h-4 w-4" /> Gallery</Link>
        </Button>
      </div>

      <form onSubmit={onSubmit} className="mt-5 rounded-2xl border border-border/60 bg-card p-4">
        <label className="text-sm font-medium">Describe the image you want</label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. A neon cyberpunk city at night, cinematic, 4k"
          rows={3}
          className="mt-2 resize-none"
        />
        <div className="mt-3 flex justify-end">
          <Button type="submit" disabled={busy || !prompt.trim()} className="rounded-full">
            {busy ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>) : "Generate"}
          </Button>
        </div>
      </form>

      {err && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <span className="flex-1">{err}</span>
          {lastPrompt && (
            <Button size="sm" variant="outline" onClick={() => doGenerate(lastPrompt)}>
              <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Retry
            </Button>
          )}
        </div>
      )}

      {busy && !preview && (
        <div className="mt-4 grid h-72 place-items-center rounded-2xl border border-dashed border-border/60 bg-card/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating image with Stability AI…
          </div>
        </div>
      )}

      {preview && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
          <img src={preview} alt={lastPrompt ?? "Generated"} className="block max-h-[70vh] w-full object-contain" />
          <div className="flex items-center justify-between gap-2 border-t border-border/60 p-3">
            <p className="line-clamp-1 text-xs text-muted-foreground">{lastPrompt}</p>
            <a
              href={preview}
              download={`nova-${Date.now()}.png`}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <Download className="h-3.5 w-3.5" /> Download Image
            </a>
          </div>
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold">My AI Images</h2>
        <p className="text-sm text-muted-foreground">Your generated images, also shared in the gallery.</p>
        {!mine || mine.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No images yet.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {mine.map((img) => (
              <figure key={img.id} className="overflow-hidden rounded-xl border border-border/60 bg-card">
                <img src={img.url} alt={img.prompt} className="aspect-square w-full object-cover" loading="lazy" />
                <figcaption className="space-y-1 p-2">
                  <p className="line-clamp-2 text-xs">{img.prompt}</p>
                  <a
                    href={img.url}
                    download={`nova-${img.id}.png`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Download className="h-3 w-3" /> Download
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
