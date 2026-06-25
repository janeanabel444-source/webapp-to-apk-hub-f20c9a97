import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import type { App } from "@/lib/store";
import { categoryLabel, isDemoApp } from "@/lib/store";
import { AppIcon } from "@/components/AppIcon";

function formatCount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function AppCard({ app }: { app: App }) {
  const demo = isDemoApp(app);
  return (
    <Link
      to="/app/$slug"
      params={{ slug: app.slug }}
      className="group flex gap-3 rounded-2xl bg-card p-3 transition-all hover:bg-accent/40"
    >
      <AppIcon name={app.name} slug={app.slug} url={app.icon_url} size={64} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate font-semibold leading-tight">{app.name}</h3>
          {demo && (
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              Demo
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{app.tagline ?? categoryLabel(app.category)}</p>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
            {Number(app.rating_avg).toFixed(1)}
            <Star className="h-3 w-3 fill-foreground stroke-none" />
          </span>
          <span>·</span>
          <span>{formatCount(app.install_count)}</span>
        </div>
      </div>
    </Link>
  );
}

export function AppCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl p-3">
      <div className="h-16 w-16 animate-pulse rounded-2xl bg-muted" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
