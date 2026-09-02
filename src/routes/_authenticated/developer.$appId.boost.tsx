import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, Megaphone, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyDeveloperApp } from "@/lib/developer.functions";
import { createAdCampaign, initCampaignPayment } from "@/lib/ads.functions";

export const Route = createFileRoute("/_authenticated/developer/$appId/boost")({
  head: () => ({
    meta: [
      { title: "Boost your app — Niza Ads" },
      { name: "description", content: "Create an ad campaign to promote your app across the Niza network." },
      { property: "og:title", content: "Boost your app — Niza Ads" },
      { property: "og:description", content: "Create an ad campaign to promote your app across the Niza network." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BoostPage,
});

const COST_PER_VIEW_NAIRA = 5;

function BoostPage() {
  const { appId } = useParams({ from: "/_authenticated/developer/$appId/boost" });
  const getApp = useServerFn(getMyDeveloperApp);
  const createFn = useServerFn(createAdCampaign);
  const payFn = useServerFn(initCampaignPayment);

  const { data: app, isLoading } = useQuery({
    queryKey: ["developer-app", appId],
    queryFn: () => getApp({ data: { id: appId } }),
  });

  const a = app as any;
  const [name, setName] = useState("");
  const [format, setFormat] = useState<"video" | "screenshot">("screenshot");
  const [daily, setDaily] = useState(2000);
  const [total, setTotal] = useState(10000);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);

  const estimatedViews = useMemo(() => Math.floor(total / COST_PER_VIEW_NAIRA), [total]);

  async function launch() {
    if (!a) return;
    setBusy(true);
    try {
      const campaign = await createFn({
        data: {
          appId,
          name: name.trim() || `${a.name} campaign`,
          format,
          dailyBudgetNaira: daily,
          totalBudgetNaira: total,
          durationDays: days,
          targetCountries: [],
          targetCategories: [],
        },
      });
      const pay = await payFn({
        data: {
          campaignId: campaign.id,
          callbackUrl: `${window.location.origin}/payment-callback?purpose=ads`,
        },
      });
      window.location.href = pay.authorizationUrl;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start the campaign.");
      setBusy(false);
    }
  }

  if (isLoading) return <p className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>;
  if (!a) return <p className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">App not found.</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 rounded-full">
        <Link to="/developer/$appId" params={{ appId }}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to app
        </Link>
      </Button>

      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Megaphone className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold">Boost {a.name}</h1>
          <p className="text-sm text-muted-foreground">
            Promote your listing across the Niza Ads network. Every ad is clearly labelled “Sponsored”.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-5 rounded-3xl border border-border/60 bg-card p-5">
        <div>
          <Label htmlFor="cname">Campaign name</Label>
          <Input id="cname" value={name} onChange={(e) => setName(e.target.value)}
            placeholder={`${a.name} campaign`} className="mt-1.5" maxLength={120} />
        </div>

        <div>
          <Label>Creative format</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(["screenshot", "video"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFormat(f)}
                className={
                  "rounded-2xl border p-3 text-left text-sm transition " +
                  (format === f ? "border-primary bg-primary/5" : "border-border hover:bg-secondary")
                }>
                <p className="font-medium capitalize">{f === "video" ? "Video ad" : "Screenshot ad"}</p>
                <p className="text-xs text-muted-foreground">
                  {f === "video"
                    ? "Full-screen video with a 5s countdown, then a close button."
                    : "Rotating screenshots from your store listing."}
                </p>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Creatives are taken straight from your store listing — icon, screenshots
            {a.promo_video_path ? ", promo video" : ""} and short description.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="daily">Daily budget (₦)</Label>
            <Input id="daily" type="number" min={100} value={daily}
              onChange={(e) => setDaily(Number(e.target.value))} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="total">Total budget (₦)</Label>
            <Input id="total" type="number" min={100} value={total}
              onChange={(e) => setTotal(Number(e.target.value))} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="days">Duration (days)</Label>
            <Input id="days" type="number" min={1} max={90} value={days}
              onChange={(e) => setDays(Number(e.target.value))} className="mt-1.5" />
          </div>
        </div>

        <div className="rounded-2xl bg-secondary/60 p-4 text-sm">
          <p className="font-medium">Estimate</p>
          <p className="mt-1 text-muted-foreground">
            ₦{COST_PER_VIEW_NAIRA} per completed view · about {estimatedViews.toLocaleString()} views over {days} day{days === 1 ? "" : "s"}.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your campaign goes live only after payment is confirmed and it passes review.
          </p>
        </div>

        <Button onClick={launch} disabled={busy} className="w-full rounded-full">
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing payment…</>
                : <><CreditCard className="mr-2 h-4 w-4" /> Pay ₦{total.toLocaleString()} and submit</>}
        </Button>
      </div>
    </div>
  );
}
