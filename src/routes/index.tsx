import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchApps } from "@/lib/store";
import { AppCard, AppCardSkeleton } from "@/components/AppCard";
import { ArrowRight, Gamepad2, LayoutGrid, Film } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nova App Store — Apps, games & AI videos" },
      { name: "description", content: "Browse curated apps, games, and AI videos. Install in one tap." },
      { property: "og:title", content: "Nova App Store" },
      { property: "og:description", content: "Browse curated apps, games, and AI videos. Install in one tap." },
    ],
  }),
  component: Home,
});

function Section({
  title,
  to,
  icon: Icon,
  category,
}: {
  title: string;
  to: "/apps" | "/games" | "/ai-videos";
  icon: typeof LayoutGrid;
  category: "app" | "game" | "ai_video";
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["apps", category],
    queryFn: () => fetchApps(category),
  });
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-foreground">
            <Icon className="h-4.5 w-4.5" />
          </span>
          <h2 className="font-display text-2xl font-bold">{title}</h2>
        </div>
        <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          See all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <AppCardSkeleton key={i} />)
          : (data ?? []).slice(0, 8).map((app) => <AppCard key={app.id} app={app} />)}
      </div>
    </section>
  );
}

function Home() {
  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-8 shadow-sm sm:p-12" style={{ backgroundImage: "var(--gradient-hero)" }}>
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            Welcome to Nova
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            A friendlier place to find <span style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>apps you'll love</span>.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Hand-picked apps, games, and AI videos. Install instantly, organize your library, and keep your reviews in one place.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/apps" className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90">Browse apps</Link>
            <Link to="/games" className="rounded-full border border-border bg-background/60 px-5 py-2.5 text-sm font-semibold backdrop-blur hover:bg-background">Explore games</Link>
          </div>
        </div>
      </section>

      <Section title="Top apps" to="/apps" icon={LayoutGrid} category="app" />
      <Section title="Popular games" to="/games" icon={Gamepad2} category="game" />
      <Section title="AI videos" to="/ai-videos" icon={Film} category="ai_video" />
    </div>
  );
}
