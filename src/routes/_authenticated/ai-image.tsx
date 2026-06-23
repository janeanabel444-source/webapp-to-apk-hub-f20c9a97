import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Sparkles, Crown, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getMyPremiumStatus } from "@/lib/premium.functions";
import { generateImage } from "@/lib/stability.functions";

export const Route = createFileRoute("/_authenticated/ai-image")({
  head: () => ({ meta: [{ title: "AI Image Generation — Nova" }] }),
  component: AiImagePage,
});

type Message = { role: "user" | "image"; text?: string; src?: string };

function AiImagePage() {
  const getStatus = useServerFn(getMyPremiumStatus);
  const gen = useServerFn(generateImage);
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["premium-status"],
    queryFn: () => getStatus({ data: undefined as never }),
  });

  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = prompt.trim();
    if (!p || busy) return;
    setErr(null);
    setMessages((m) => [...m, { role: "user", text: p }]);
    setPrompt("");
    setBusy(true);
    try {
      const { dataUrl } = await gen({ data: { prompt: p } });
      setMessages((m) => [...m, { role: "image", src: dataUrl }]);
    } catch (e: any) {
      const m = e?.message ?? "Generation failed";
      setErr(m === "PREMIUM_REQUIRED" ? "Premium required to generate images." : m);
    } finally {
      setBusy(false);
    }
  }

  if (statusLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!status?.isPremium) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-border/60 bg-card p-8 text-center">
          <Crown className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-3 font-display text-2xl font-bold">AI Image Generation is Premium</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Upgrade to Nova Premium to generate unlimited AI images with Stability AI.
          </p>
          <Button asChild className="mt-6 rounded-full" size="lg">
            <Link to="/premium">Go Premium</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 sm:px-6">
      <div className="flex items-center gap-2 py-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="font-display text-xl font-bold">AI Image Studio</h1>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Crown className="h-3 w-3" /> Premium
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-border/60 bg-card/50 p-4">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
            <div>
              <Sparkles className="mx-auto h-8 w-8 opacity-50" />
              <p className="mt-2">Describe an image to generate.</p>
              <p className="mt-1 text-xs">e.g. "A neon cyberpunk city at night, cinematic, 4k"</p>
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="overflow-hidden rounded-2xl border border-border bg-background">
                <img src={m.src} alt="Generated" className="block max-w-full" />
                <div className="flex justify-end p-2">
                  <a
                    href={m.src}
                    download={`nova-${Date.now()}.png`}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Download className="h-3 w-3" /> Download
                  </a>
                </div>
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating image…
          </div>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
      </div>

      <form onSubmit={onSubmit} className="my-4 flex gap-2">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate…"
          rows={2}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e as any);
            }
          }}
        />
        <Button type="submit" disabled={busy || !prompt.trim()} className="self-end rounded-full">
          Generate
        </Button>
      </form>
    </div>
  );
}
