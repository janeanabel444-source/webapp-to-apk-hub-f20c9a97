import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchMyFavorites } from "@/lib/store-extras";
import { AppCard } from "@/components/AppCard";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({ meta: [{ title: "Favorites — Nova" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-favorites"],
    queryFn: () => fetchMyFavorites(user!.id),
    enabled: !!user,
  });
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Heart className="h-5 w-5 fill-red-500 stroke-red-500" /> Favorites
      </h1>
      {data && data.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((app) => <AppCard key={app.id} app={app} />)}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-border/60 bg-card/50 p-10 text-center">
          <p className="text-sm text-muted-foreground">No favorites yet. Tap the heart on any app to save it here.</p>
          <Link to="/apps" className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Browse apps</Link>
        </div>
      )}
    </div>
  );
}
