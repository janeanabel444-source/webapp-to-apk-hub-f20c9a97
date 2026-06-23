import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Star, Download as DownloadIcon, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { fetchApp, fetchReviews, isInstalled, upsertReview, categoryLabel } from "@/lib/store";
import { AppIcon } from "@/components/AppIcon";
import { InstallButton } from "@/components/InstallButton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$slug")({
  loader: async ({ params }) => {
    const app = await fetchApp(params.slug);
    if (!app) throw notFound();
    return { app };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.app.name} — Nova App Store` },
          { name: "description", content: loaderData.app.tagline ?? loaderData.app.description ?? "" },
          { property: "og:title", content: `${loaderData.app.name} — Nova App Store` },
          { property: "og:description", content: loaderData.app.tagline ?? loaderData.app.description ?? "" },
        ]
      : [],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold">App not found</h1>
      <p className="mt-2 text-muted-foreground">It may have been removed.</p>
      <Link to="/" className="mt-6 inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Back home</Link>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold">Couldn't load this app</h1>
      <button onClick={reset} className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Try again</button>
    </div>
  ),
  component: AppDetail,
});

function StarRow({ value, onChange, size = 24 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          disabled={!onChange}
          aria-label={`${n} star`}
          className={onChange ? "transition hover:scale-110" : ""}
        >
          <Star
            style={{ width: size, height: size }}
            className={n <= value ? "fill-amber-400 stroke-amber-400" : "fill-none stroke-muted-foreground/50"}
          />
        </button>
      ))}
    </div>
  );
}

function AppDetail() {
  const { app } = Route.useLoaderData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: installState } = useQuery({
    queryKey: ["install-state", app.id, user?.id],
    queryFn: () => (user ? isInstalled(user.id, app.id) : Promise.resolve(false)),
    enabled: !!user,
  });

  const { data: reviews } = useQuery({
    queryKey: ["reviews", app.id],
    queryFn: () => fetchReviews(app.id),
  });

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const mine = reviews?.find((r) => r.user_id === user?.id);
    if (mine) {
      setRating(mine.rating);
      setBody(mine.body ?? "");
    }
  }, [reviews, user?.id]);

  async function submitReview() {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: window.location.pathname } });
      return;
    }
    if (rating < 1) {
      toast.error("Please choose a star rating");
      return;
    }
    setSubmitting(true);
    try {
      await upsertReview(user.id, app.id, rating, body.trim());
      toast.success("Review posted");
      qc.invalidateQueries({ queryKey: ["reviews", app.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't post review");
    } finally {
      setSubmitting(false);
    }
  }

  function formatCount(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>

      <header className="mt-4 flex flex-col gap-6 rounded-3xl border border-border/60 bg-card p-6 shadow-sm sm:flex-row sm:items-start sm:p-8">
        <AppIcon name={app.name} slug={app.slug} url={app.icon_url} size={112} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="rounded-full bg-secondary px-2.5 py-1">{categoryLabel(app.category)}</span>
            <span className="inline-flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-success" /> Reviewed by Nova</span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{app.name}</h1>
          {app.tagline && <p className="mt-1 text-muted-foreground">{app.tagline}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div>
              <div className="flex items-center gap-1 font-semibold">
                {Number(app.rating_avg).toFixed(1)}
                <Star className="h-4 w-4 fill-foreground stroke-none" />
              </div>
              <div className="text-xs text-muted-foreground">{app.rating_count} reviews</div>
            </div>
            <div>
              <div className="flex items-center gap-1 font-semibold">
                <DownloadIcon className="h-4 w-4" /> {formatCount(app.install_count)}
              </div>
              <div className="text-xs text-muted-foreground">Installs</div>
            </div>
          </div>

          <div className="mt-5">
            <InstallButton appId={app.id} initialInstalled={!!installState} />
          </div>
        </div>
      </header>

      {app.description && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold">About</h2>
          <p className="mt-2 whitespace-pre-line text-muted-foreground">{app.description}</p>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-xl font-bold">Ratings & reviews</h2>
        </div>

        <div className="mt-4 rounded-2xl border border-border/60 bg-card p-5">
          <p className="text-sm font-medium">{user ? "Rate this app" : "Sign in to rate this app"}</p>
          <div className="mt-2"><StarRow value={rating} onChange={user ? setRating : undefined} /></div>
          {user && (
            <>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share your thoughts (optional)"
                className="mt-3 min-h-20"
                maxLength={500}
              />
              <div className="mt-3 flex justify-end">
                <Button onClick={submitReview} disabled={submitting} className="rounded-full">Post review</Button>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 space-y-4">
          {(reviews ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No reviews yet — be the first.</p>
          )}
          {(reviews ?? []).map((r: any) => (
            <article key={r.id} className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-xs">
                    {(r.profile?.display_name ?? "U")[0]?.toUpperCase()}
                  </span>
                  {r.profile?.display_name ?? "Anonymous"}
                </div>
                <StarRow value={r.rating} size={14} />
              </div>
              {r.body && <p className="mt-2 text-sm text-muted-foreground">{r.body}</p>}
              {r.dev_reply && (
                <div className="mt-3 rounded-xl bg-secondary/60 p-3 text-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-primary">Developer</div>
                  <p className="mt-1 text-muted-foreground">{r.dev_reply}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
