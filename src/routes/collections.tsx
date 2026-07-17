import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchCollections } from "@/lib/store-extras";
import { Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/collections")({
  head: () => ({
    meta: [
      { title: "Collections — Nova App Store" },
      { name: "description", content: "Curated collections of the best apps and games on Nova." },
      { property: "og:title", content: "Collections — Nova App Store" },
      { property: "og:description", content: "Curated collections of the best apps and games on Nova." },
    ],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Collections</h1>
          <p className="text-sm text-muted-foreground">Hand-picked lists from the Nova team.</p>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((c) => (
            <Link
              key={c.id}
              to="/collections/$slug"
              params={{ slug: c.slug }}
              className="group rounded-2xl border border-border/60 bg-card p-5 transition hover:shadow-md"
              style={{ backgroundImage: c.cover_url ? `linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${c.cover_url})` : "var(--gradient-hero)", backgroundSize: "cover" }}
            >
              <h3 className="font-display text-lg font-bold">{c.title}</h3>
              {c.description && <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>}
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Open <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
