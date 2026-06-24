import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchApps } from "@/lib/store";
import { AppCard, AppCardSkeleton } from "@/components/AppCard";
import { TrendingUp } from "lucide-react";

export const Route = createFileRoute("/trending")({
  head: () => ({ meta: [{ title: "Trending — Nova App Store" }] }),
  component: TrendingPage,
});

function TrendingPage() {
  const apps = useQuery({ queryKey: ["apps", "app"], queryFn: () => fetchApps("app") });
  const games = useQuery({ queryKey: ["apps", "game"], queryFn: () => fetchApps("game") });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h1 className="font-display text-3xl font-bold">Trending</h1>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl font-bold">Trending apps</h2>
          <Link to="/apps" className="text-sm text-primary hover:underline">See all</Link>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {apps.isLoading
            ? Array.from({ length: 8 }).map((_, i) => <AppCardSkeleton key={i} />)
            : (apps.data ?? []).slice(0, 8).map((a) => <AppCard key={a.id} app={a} />)}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl font-bold">Trending games</h2>
          <Link to="/games" className="text-sm text-primary hover:underline">See all</Link>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {games.isLoading
            ? Array.from({ length: 8 }).map((_, i) => <AppCardSkeleton key={i} />)
            : (games.data ?? []).slice(0, 8).map((a) => <AppCard key={a.id} app={a} />)}
        </div>
      </section>
    </div>
  );
}
