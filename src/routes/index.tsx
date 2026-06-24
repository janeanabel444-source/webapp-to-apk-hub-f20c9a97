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
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-foreground">
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-bold">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
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
            Welcome to Nova App Store
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Discover <span style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>apps and games</span> in one place.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Explore, install, and publish apps easily. Hand-picked apps and games from developers around the world.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/apps" className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90">Browse apps</Link>
            <Link to="/games" className="rounded-full border border-border bg-background/60 px-5 py-2.5 text-sm font-semibold backdrop-blur hover:bg-background">Explore games</Link>
            <Link to="/developer" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 inline-flex items-center gap-1.5">
              <Code2 className="h-4 w-4" /> Developer Hub
            </Link>
          </div>
        </div>
      </section>

      <Section title="Featured apps" subtitle="Editor picks" to="/apps" icon={LayoutGrid} category="app" />
      <Section title="Featured games" subtitle="Top games to play right now" to="/games" icon={Gamepad2} category="game" />
      <Section title="Trending apps" subtitle="Most installed this week" to="/trending" icon={TrendingUp} category="app" />
      <Section title="Trending games" subtitle="What gamers love right now" to="/trending" icon={TrendingUp} category="game" />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link to="/developer" className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 transition hover:shadow-md" style={{ backgroundImage: "var(--gradient-primary)" }}>
          <Code2 className="h-6 w-6 text-primary-foreground" />
          <h3 className="mt-3 font-display text-xl font-bold text-primary-foreground">Are you a developer?</h3>
          <p className="mt-1 text-sm text-primary-foreground/90">Upload your apps and games. Reach Nova's users in minutes.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-foreground">
            Publish on Nova <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
        <Link to="/ai-tools" className="group rounded-3xl border border-border/60 bg-card p-6 transition hover:shadow-md">
          <Sparkles className="h-6 w-6 text-primary" />
          <h3 className="mt-3 font-display text-xl font-bold">AI Tools (optional)</h3>
          <p className="mt-1 text-sm text-muted-foreground">Generate AI images and browse the AI Gallery. Limits depend on your role.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Open AI Tools <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </section>
    </div>
  );
}
