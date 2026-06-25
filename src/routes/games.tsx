import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { fetchApps } from "@/lib/store";
import { AppCard, AppCardSkeleton } from "@/components/AppCard";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "Games — NovaMind AI" },
      { name: "description", content: "Browse the best games on NovaMind AI." },
    ],
  }),
  component: GamesPage,
});

function GamesPage() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["apps", "game", q],
    queryFn: () => fetchApps("game", q),
  });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Games</h1>
      <p className="mt-1 text-muted-foreground">Action, puzzle, racing — pick your next favorite.</p>
      <div className="relative mt-5 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search games by name…"
          className="h-11 rounded-full pl-9"
          aria-label="Search games"
        />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <AppCardSkeleton key={i} />)
          : (data ?? []).map((app) => <AppCard key={app.id} app={app} />)}
      </div>
      {!isLoading && (data ?? []).length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">No games match your search.</p>
      )}
    </div>
  );
}
