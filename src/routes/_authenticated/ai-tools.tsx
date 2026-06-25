import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Images, Crown, Infinity as InfinityIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyAiQuota } from "@/lib/ai-quota.functions";

export const Route = createFileRoute("/_authenticated/ai-tools")({
  head: () => ({ meta: [{ title: "AI Tools — Nova" }] }),
  component: AiToolsHub,
});

function AiToolsHub() {
  const getQuota = useServerFn(getMyAiQuota);
  const { data: q } = useQuery({
    queryKey: ["ai-quota"],
    queryFn: () => getQuota({ data: undefined as never }),
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold">AI Tools</h1>
          <p className="text-sm text-muted-foreground">Optional AI features for Nova members.</p>
        </div>
      </div>

      {q && (
        <div className="mt-5 rounded-2xl border border-border/60 bg-card p-4 text-sm">
          <p className="font-medium">Your AI quota today</p>
          {q.unlimited ? (
            <p className="mt-1 inline-flex items-center gap-1 text-emerald-600">
              <InfinityIcon className="h-4 w-4" /> Unlimited (Admin)
            </p>
          ) : q.quota === 0 ? (
            <p className="mt-1 text-muted-foreground">
              No free generations.{" "}
              <Link to="/redeem" className="text-primary hover:underline">Redeem a promo code</Link>{" "}
              or <Link to="/premium" className="text-primary hover:underline">go Premium</Link>.
            </p>
          ) : (
            <p className="mt-1 text-muted-foreground">
              {q.remaining} of {q.quota} generations remaining today ({q.role.replace("_", " ")})
            </p>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link to="/ai-image" className="group rounded-2xl border border-border/60 bg-card p-5 transition hover:shadow-md">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="mt-3 font-display text-lg font-semibold">Create AI Image</h2>
          <p className="mt-1 text-sm text-muted-foreground">Turn a prompt into an image with Stability AI.</p>
        </Link>
        <Link to="/ai-gallery" className="group rounded-2xl border border-border/60 bg-card p-5 transition hover:shadow-md">
          <Images className="h-6 w-6 text-primary" />
          <h2 className="mt-3 font-display text-lg font-semibold">AI Gallery</h2>
          <p className="mt-1 text-sm text-muted-foreground">Browse images created by the community.</p>
        </Link>
      </div>

      <div className="mt-6 rounded-2xl border border-border/60 bg-card p-5">
        <Crown className="h-5 w-5 text-primary" />
        <p className="mt-2 text-sm">
          Want higher limits or unlimited generations? <Link to="/premium" className="text-primary hover:underline">Upgrade to Premium</Link>.
        </p>
      </div>
    </div>
  );
}
