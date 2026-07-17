import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchCollection } from "@/lib/store-extras";
import { AppCard } from "@/components/AppCard";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/collections/$slug")({
  loader: async ({ params }) => {
    const res = await fetchCollection(params.slug);
    if (!res) throw notFound();
    return res;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.collection.title} — Nova App Store` },
          { name: "description", content: loaderData.collection.description ?? "Curated collection on Nova." },
          { property: "og:title", content: `${loaderData.collection.title} — Nova` },
          { property: "og:description", content: loaderData.collection.description ?? "Curated collection on Nova." },
        ]
      : [],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold">Collection not found</h1>
      <Link to="/collections" className="mt-4 inline-block text-primary underline">Back to collections</Link>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold">Couldn't load this collection</h1>
      <button onClick={reset} className="mt-4 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground">Try again</button>
    </div>
  ),
  component: CollectionPage,
});

function CollectionPage() {
  const { slug } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["collection", slug],
    queryFn: () => fetchCollection(slug),
    initialData: Route.useLoaderData(),
  });

  if (!data) return null;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link to="/collections" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> All collections
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">{data.collection.title}</h1>
      {data.collection.description && (
        <p className="mt-1 text-muted-foreground">{data.collection.description}</p>
      )}
      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.apps.map((app) => <AppCard key={app.id} app={app} />)}
      </div>
      {data.apps.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">This collection is empty. Check back soon.</p>
      )}
    </div>
  );
}
