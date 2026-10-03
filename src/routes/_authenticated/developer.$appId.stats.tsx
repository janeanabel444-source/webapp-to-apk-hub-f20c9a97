import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Eye, Download, Smartphone, Star, Megaphone, MousePointerClick, Loader2 } from "lucide-react";
import { getMyAppAnalytics } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/developer/$appId/stats")({
  head: () => ({
    meta: [
      { title: "App statistics — Niza Developer Hub" },
      { name: "description", content: "Views, downloads, installs and ad performance for your app." },
      { property: "og:title", content: "App statistics — Niza Developer Hub" },
      { property: "og:description", content: "Views, downloads, installs and ad performance for your app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatsPage,
});

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString()}`;

function StatsPage() {
  const { appId } = Route.useParams();
  const fn = useServerFn(getMyAppAnalytics);
  const { data, isLoading, error } = useQuery({
    queryKey: ["app-analytics", appId],
    queryFn: () => fn({ data: { appId } }),
  });

  if (isLoading) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error || !data) return <div className="p-6 text-center text-sm text-muted-foreground">Could not load statistics.</div>;

  const max = Math.max(1, ...data.days.map((d) => d.views));
  const cards = [
    { label: "Page views", value: data.totals.views, icon: Eye },
    { label: "Downloads", value: data.totals.downloads, icon: Download },
    { label: "Installs", value: data.totals.installs, icon: Smartphone },
    { label: `Rating (${data.totals.ratingCount})`, value: data.totals.rating.toFixed(1), icon: Star },
  ];
  const ads = [
    { label: "Ad spend", value: naira(data.ads.spentKobo), icon: Megaphone },
    { label: "Ad impressions", value: data.ads.impressions, icon: Eye },
    { label: "Ad clicks", value: data.ads.clicks, icon: MousePointerClick },
    { label: "Ad downloads", value: data.ads.downloads, icon: Download },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link to="/developer/$appId" params={{ appId }} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to app
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold">{data.name} — statistics</h1>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => <Stat key={c.label} {...c} />)}
      </div>

      <section className="mt-6 rounded-3xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Page views — last 30 days</p>
        <div className="mt-4 flex h-32 items-end gap-[3px]">
          {data.days.map((d) => (
            <div key={d.date} title={`${d.date}: ${d.views}`} className="flex-1 rounded-t bg-primary/70"
              style={{ height: `${Math.max(2, (d.views / max) * 100)}%` }} />
          ))}
        </div>
      </section>

      <h2 className="mt-8 font-display text-lg font-bold">Advertising</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ads.map((c) => <Stat key={c.label} {...c} />)}
      </div>

      <div className="mt-4 space-y-2">
        {data.campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No campaigns yet. <Link to="/developer/$appId/boost" params={{ appId }} className="text-primary underline">Boost your app</Link>
          </p>
        ) : data.campaigns.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3 text-sm">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs capitalize text-muted-foreground">{c.status.replace(/_/g, " ")} · {c.format}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {naira(c.spent_kobo)} / {naira(c.total_budget_kobo)} · {c.impressions_count} seen · {c.clicks_count} clicks · {c.downloads_count} downloads
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Eye }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 font-display text-xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
