import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, Star, Download as DownloadIcon, Shield, History, Sparkles,
  Mail, Globe, FileText, Languages as LangIcon, AlertTriangle, Info,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  fetchApp, fetchReviews, fetchInstallState, upsertReview,
  categoryLabel, isDemoApp, fetchAppVersions, compareVersions,
} from "@/lib/store";
import { trackView, fetchSimilarApps } from "@/lib/store-extras";
import { formatBytes } from "@/lib/apk-parser";
import { detectAndroidVersion, compareAndroid } from "@/lib/android-compat";
import { AppIcon } from "@/components/AppIcon";
import { AppCard } from "@/components/AppCard";
import { InstallButton } from "@/components/InstallButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ReportAppDialog } from "@/components/ReportAppDialog";
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
          { name: "description", content: (loaderData.app as any).short_description ?? loaderData.app.tagline ?? loaderData.app.description ?? "" },
          { property: "og:title", content: `${loaderData.app.name} — Nova App Store` },
          { property: "og:description", content: (loaderData.app as any).short_description ?? loaderData.app.tagline ?? loaderData.app.description ?? "" },
          ...(loaderData.app.icon_url ? [{ property: "og:image", content: loaderData.app.icon_url }] : []),
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
        <button key={n} type="button" onClick={() => onChange?.(n)} disabled={!onChange}
          aria-label={`${n} star`} className={onChange ? "transition hover:scale-110" : ""}>
          <Star style={{ width: size, height: size }}
            className={n <= value ? "fill-amber-400 stroke-amber-400" : "fill-none stroke-muted-foreground/50"} />
        </button>
      ))}
    </div>
  );
}

function AppDetail() {
  const { app } = Route.useLoaderData();
  const a = app as any;
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: installState } = useQuery({
    queryKey: ["install-state", app.id, user?.id],
    queryFn: () => user ? fetchInstallState(user.id, app.id) : Promise.resolve({ installed: false, installedVersion: null }),
    enabled: !!user,
  });

  const { data: versions } = useQuery({
    queryKey: ["app-versions", app.id],
    queryFn: () => fetchAppVersions(app.id),
  });

  const updateAvailable =
    !!installState?.installed && !!installState.installedVersion && !!app.version &&
    compareVersions(app.version, installState.installedVersion) > 0;

  const { data: reviews } = useQuery({
    queryKey: ["reviews", app.id],
    queryFn: () => fetchReviews(app.id),
  });

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAllPerms, setShowAllPerms] = useState(false);
  const [activeShot, setActiveShot] = useState<number | null>(null);

  useEffect(() => {
    const mine = reviews?.find((r) => r.user_id === user?.id);
    if (mine) { setRating(mine.rating); setBody(mine.body ?? ""); }
  }, [reviews, user?.id]);

  // Track view for logged-in users (Recently viewed)
  useEffect(() => {
    if (user) trackView(user.id, app.id).catch(() => {});
  }, [user, app.id]);

  const { data: similar } = useQuery({
    queryKey: ["similar", app.id],
    queryFn: () => fetchSimilarApps(app as any, 8),
  });

  // Android compatibility check (best-effort from UA).
  const compat = useMemo(() => {
    const min = a.min_android_version as string | null;
    if (!min) return { supported: true, deviceVersion: null as number | null };
    const dv = detectAndroidVersion();
    if (dv == null) return { supported: true, deviceVersion: null };
    return { supported: compareAndroid(String(dv), min) >= 0, deviceVersion: dv };
  }, [a.min_android_version]);

  async function submitReview() {
    if (!user) { navigate({ to: "/auth", search: { redirect: window.location.pathname } }); return; }
    if (rating < 1) { toast.error("Please choose a star rating"); return; }
    setSubmitting(true);
    try {
      await upsertReview(user.id, app.id, rating, body.trim());
      toast.success("Review posted");
      qc.invalidateQueries({ queryKey: ["reviews", app.id] });
    } catch (e: any) { toast.error(e.message ?? "Couldn't post review"); }
    finally { setSubmitting(false); }
  }

  function formatCount(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  }

  const permissions: string[] = (a.permissions ?? []) as string[];
  const shots: string[] = (app.screenshots ?? []) as string[];
  const tags: string[] = (a.tags ?? []) as string[];
  const languages: string[] = (a.languages ?? []) as string[];
  const ratingLabel = a.content_rating
    ? a.content_rating === "everyone" ? "Everyone" : a.content_rating === "teen" ? "Teen" : "Mature 17+"
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 sm:px-6">
      {/* Feature banner */}
      {a.feature_banner_url && (
        <div className="-mx-4 mb-4 aspect-[1024/500] w-[calc(100%+2rem)] overflow-hidden sm:-mx-6 sm:mb-6 sm:w-[calc(100%+3rem)] sm:rounded-b-3xl">
          <img src={a.feature_banner_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className={a.feature_banner_url ? "pt-2" : "pt-6"}>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
      </div>

      {/* Hero */}
      <header className="mt-4 flex flex-col gap-6 rounded-3xl border border-border/60 bg-card p-6 shadow-sm sm:flex-row sm:items-start sm:p-8">
        <AppIcon name={app.name} slug={app.slug} url={app.icon_url} size={112} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="rounded-full bg-secondary px-2.5 py-1">{categoryLabel(app.category)}</span>
            {a.subcategory && <span className="rounded-full bg-secondary px-2.5 py-1">{a.subcategory}</span>}
            {ratingLabel && <span className="rounded-full bg-secondary px-2.5 py-1">{ratingLabel}</span>}
            <span className="inline-flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-success" /> Reviewed by Nova</span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{app.name}</h1>
          {a.developer_name && (
            <p className="mt-0.5 text-sm text-primary">{a.developer_name}</p>
          )}
          {(a.short_description ?? app.tagline) && (
            <p className="mt-1 text-muted-foreground">{a.short_description ?? app.tagline}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div>
              <div className="flex items-center gap-1 font-semibold">
                {Number(app.rating_avg).toFixed(1)}<Star className="h-4 w-4 fill-foreground stroke-none" />
              </div>
              <div className="text-xs text-muted-foreground">{app.rating_count} reviews</div>
            </div>
            <div>
              <div className="flex items-center gap-1 font-semibold">
                <DownloadIcon className="h-4 w-4" /> {formatCount(app.install_count)}
              </div>
              <div className="text-xs text-muted-foreground">Installs</div>
            </div>
            {a.apk_size ? (
              <div>
                <div className="font-semibold">{formatBytes(a.apk_size)}</div>
                <div className="text-xs text-muted-foreground">Download size</div>
              </div>
            ) : null}
            {ratingLabel && (
              <div>
                <div className="font-semibold">{ratingLabel}</div>
                <div className="text-xs text-muted-foreground">Content rating</div>
              </div>
            )}
          </div>

          <div className="mt-5">
            <InstallButton
              appId={app.id}
              appName={app.name}
              filePath={app.file_path}
              appUrl={app.app_url}
              apkSize={a.apk_size}
              license={a.license ?? "free"}
              priceKobo={a.price_kobo ?? 0}
              initialInstalled={!!installState?.installed}
              isDemo={isDemoApp(app)}
              installedVersion={installState?.installedVersion}
              latestVersion={app.version}
            />
            {isDemoApp(app) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Demo app for preview purposes only.
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Version <span className="font-medium text-foreground">{app.version ?? "1.0.0"}</span></span>
              {app.last_updated_at && <span>Updated {new Date(app.last_updated_at).toLocaleDateString()}</span>}
              {app.created_at && <span>Released {new Date(app.created_at).toLocaleDateString()}</span>}
              {updateAvailable && installState?.installedVersion && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                  <Sparkles className="h-3 w-3" /> Update available · v{installState.installedVersion} → v{app.version}
                </span>
              )}
            </div>
          </div>

          {/* Compatibility warning */}
          {!compat.supported && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                Your device is on Android {compat.deviceVersion}. This app requires Android {a.min_android_version}+.
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Screenshots */}
      {shots.length > 0 && (
        <section className="mt-8">
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {shots.map((src, i) => (
              <button key={i} type="button" onClick={() => setActiveShot(i)}
                className="shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-card focus:outline-none focus:ring-2 focus:ring-primary">
                <img src={src} alt="" className="h-64 w-auto object-cover sm:h-80" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* About */}
      {app.description && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold">About this app</h2>
          <p className="mt-2 whitespace-pre-line text-muted-foreground">{app.description}</p>
          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">#{t}</span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* What's new */}
      <section className="mt-10">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <History className="h-4 w-4" /> What's new
        </h2>
        {app.latest_release_notes ? (
          <div className="mt-3 rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold">v{app.version}</span>
              {app.last_updated_at && (
                <time className="text-xs text-muted-foreground">{new Date(app.last_updated_at).toLocaleDateString()}</time>
              )}
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{app.latest_release_notes}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No release notes yet.</p>
        )}

        {(versions ?? []).length > 1 && (
          <details className="group mt-4">
            <summary className="cursor-pointer text-sm font-medium text-primary hover:underline">
              Version history ({(versions ?? []).length} versions)
            </summary>
            <ol className="mt-3 space-y-3">
              {(versions ?? []).slice(1).map((v: any) => (
                <li key={v.id} className="rounded-2xl border border-border/60 bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold">v{v.version}</span>
                    <time className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</time>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {v.apk_size ? <span>Size {formatBytes(v.apk_size)}</span> : null}
                    {v.permissions_added?.length ? <span className="text-emerald-600">+{v.permissions_added.length} permissions</span> : null}
                    {v.permissions_removed?.length ? <span className="text-destructive">-{v.permissions_removed.length} permissions</span> : null}
                  </div>
                  {v.release_notes && (
                    <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{v.release_notes}</p>
                  )}
                </li>
              ))}
            </ol>
          </details>
        )}
      </section>

      {/* Permissions */}
      {permissions.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <Shield className="h-4 w-4" /> Permissions
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Reviewed automatically from the APK. Verify before installing.
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {(showAllPerms ? permissions : permissions.slice(0, 8)).map((p) => (
              <li key={p} className="rounded-lg bg-secondary/60 px-2.5 py-1.5 text-[12px] font-mono text-muted-foreground">
                {p.replace("android.permission.", "")}
              </li>
            ))}
          </ul>
          {permissions.length > 8 && (
            <button type="button" onClick={() => setShowAllPerms((s) => !s)}
              className="mt-2 text-sm font-medium text-primary hover:underline">
              {showAllPerms ? "Show fewer" : `Show all ${permissions.length}`}
            </button>
          )}
        </section>
      )}

      {/* Compatibility & technical info */}
      <section className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="flex items-center gap-2 font-display text-sm font-bold">
            <Info className="h-4 w-4" /> Compatibility
          </h3>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row k="Requires Android" v={a.min_android_version ? `${a.min_android_version}+` : "—"} />
            <Row k="Target Android" v={a.target_android_version ?? "—"} />
            <Row k="Package" v={a.package_name ?? "—"} mono />
            <Row k="Version code" v={a.version_code ?? "—"} />
          </dl>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="flex items-center gap-2 font-display text-sm font-bold">
            <LangIcon className="h-4 w-4" /> Languages
          </h3>
          {languages.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {languages.map((l) => (
                <span key={l} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{l}</span>
              ))}
            </div>
          ) : <p className="mt-2 text-sm text-muted-foreground">Not specified.</p>}
        </div>
      </section>

      {/* Developer info */}
      {(a.developer_name || a.developer_email || a.website_url || a.privacy_policy_url) && (
        <section className="mt-10 rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="font-display text-xl font-bold">Developer</h2>
          {a.developer_name && <p className="mt-2 text-sm font-medium">{a.developer_name}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {a.developer_email && (
              <a href={`mailto:${a.developer_email}?subject=${encodeURIComponent(`About ${app.name}`)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-secondary">
                <Mail className="h-3.5 w-3.5" /> Contact developer
              </a>
            )}
            {a.website_url && (
              <a href={a.website_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-secondary">
                <Globe className="h-3.5 w-3.5" /> Website
              </a>
            )}
            {a.privacy_policy_url && (
              <a href={a.privacy_policy_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-secondary">
                <FileText className="h-3.5 w-3.5" /> Privacy policy
              </a>
            )}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-xl font-bold">Ratings & reviews</h2>
        </div>
        <div className="mt-4 rounded-2xl border border-border/60 bg-card p-5">
          <p className="text-sm font-medium">{user ? "Rate this app" : "Sign in to rate this app"}</p>
          <div className="mt-2"><StarRow value={rating} onChange={user ? setRating : undefined} /></div>
          {user && (
            <>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="Share your thoughts (optional)" className="mt-3 min-h-20" maxLength={500} />
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

      {/* Lightbox */}
      {activeShot !== null && shots[activeShot] && (
        <div onClick={() => setActiveShot(null)}
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
          <img src={shots[activeShot]} alt="" className="max-h-full max-w-full rounded-2xl" />
        </div>
      )}
      {/* Similar apps */}
      {(similar ?? []).length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">Similar apps</h2>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(similar ?? []).map((s) => <AppCard key={s.id} app={s} />)}
          </div>
        </section>
      )}

      {/* Actions footer */}
      <section className="mt-10 flex flex-wrap items-center gap-2">
        <FavoriteButton appId={app.id} />
        <ReportAppDialog appId={app.id} />
      </section>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className={"truncate text-sm text-foreground" + (mono ? " font-mono text-xs" : "")}>{v}</dd>
    </div>
  );
}
