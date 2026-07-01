import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchApps } from "@/lib/store";
import { AppCard, AppCardSkeleton } from "@/components/AppCard";
import { ArrowRight, Gamepad2, LayoutGrid, TrendingUp, Code2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nova App Store — Discover apps and games" },
      { name: "description", content: "Welcome to Nova App Store. Discover apps and games in one place. Explore, install, and publish apps easily." },
      { property: "og:title", content: "Nova App Store" },
      { property: "og:description", content: "Discover apps and games in one place." },
    ],
  }),
  component: Home,
});

function Section({
  title,
  subtitle,
  to,
  icon: Icon,
  category,
}: {
  title: string;
  subtitle?: string;
  to: "/apps" | "/games" | "/trending";
  icon: typeof LayoutGrid;
  category: "app" | "game";
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["apps", category],
    queryFn: () => fetchApps(category),
  });
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-bold sm:text-xl">{title}</h2>
            {subtitle && <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{subtitle}</p>}
          </div>
        </div>
        <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline sm:text-sm">
          See all <ArrowRight className="h-3.5 w-3.5" />
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
    <div className="mx-auto max-w-7xl space-y-8 px-3 py-6 sm:space-y-10 sm:px-6 sm:py-10">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-5 shadow-sm sm:p-10" style={{ backgroundImage: "var(--gradient-hero)" }}>
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur sm:text-xs">
            Welcome to Nova App Store
          </span>
          <h1 className="mt-3 font-display text-[1.75rem] font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
            Discover <span style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>apps and games</span> in one place.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base md:text-lg">
            Explore, install, and publish apps easily. Hand-picked apps and games from developers around the world.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/apps" className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90 sm:px-5 sm:py-2.5 sm:text-sm">Browse apps</Link>
            <Link to="/games" className="rounded-full border border-border bg-background/60 px-4 py-2 text-xs font-semibold backdrop-blur hover:bg-background sm:px-5 sm:py-2.5 sm:text-sm">Explore games</Link>
            <Link to="/developer" className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 inline-flex items-center gap-1.5 sm:px-5 sm:py-2.5 sm:text-sm">
              <Code2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Developer Hub
            </Link>
          </div>
        </div>
      </section>

      <Section title="Featured apps" subtitle="Editor picks" to="/apps" icon={LayoutGrid} category="app" />
      <Section title="Featured games" subtitle="Top games to play right now" to="/games" icon={Gamepad2} category="game" />
      <Section title="Trending apps" subtitle="Most installed this week" to="/trending" icon={TrendingUp} category="app" />
      <Section title="Trending games" subtitle="What gamers love right now" to="/trending" icon={TrendingUp} category="game" />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link to="/developer" className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card p-5 transition hover:shadow-md sm:p-6" style={{ backgroundImage: "var(--gradient-primary)" }}>
          <Code2 className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
          <h3 className="mt-2 font-display text-base font-bold text-primary-foreground sm:text-lg">Are you a developer?</h3>
          <p className="mt-1 text-xs text-primary-foreground/90 sm:text-sm">Upload your apps and games. Reach Nova's users in minutes.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-foreground sm:text-sm">
            Publish on Nova <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </span>
        </Link>
        <Link to="/ai-tools" className="group rounded-3xl border border-border/60 bg-card p-5 transition hover:shadow-md sm:p-6">
          <Sparkles className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
          <h3 className="mt-2 font-display text-base font-bold sm:text-lg">AI Tools (optional)</h3>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Generate AI images and browse the AI Gallery. Limits depend on your role.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary sm:text-sm">
            Open AI Tools <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </span>
        </Link>
      </section>
    </div>
  );
}
