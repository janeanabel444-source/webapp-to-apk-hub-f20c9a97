import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowLeft, Copy, Check, Download, Star, Globe, ShieldCheck, ShieldAlert, Package,
  Clock, FlaskConical, Pencil, Upload, ExternalLink, History,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getMyDeveloperApp } from "@/lib/developer.functions";
import { fetchAppVersions } from "@/lib/store";
import { getApkSignedUrl } from "@/lib/apk-download";
import { formatBytes } from "@/lib/apk-parser";
import { gameTypeLabel } from "@/lib/platforms";
import { REVIEW_STATES } from "@/lib/review";

export const Route = createFileRoute("/_authenticated/developer/$appId/")({
  head: () => ({
    meta: [
      { title: "App details — Developer Hub · Niza" },
      { name: "description", content: "Full listing details, store links, security review and version history for your Niza app." },
      { property: "og:title", content: "App details — Developer Hub · Niza" },
      { property: "og:description", content: "Full listing details, store links, security review and version history for your Niza app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeveloperAppInfoPage,
});

const toneCls: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  good: "bg-emerald-500/15 text-emerald-400",
  warn: "bg-orange-500/15 text-orange-400",
  bad: "bg-destructive/15 text-destructive",
};

function CopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium">{label}</p>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-full px-2 text-xs"
            onClick={() => {
              navigator.clipboard?.writeText(value);
              setDone(true);
              toast.success(`${label} copied`);
              setTimeout(() => setDone(false), 1600);
            }}
          >
            {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button asChild size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs">
            <a href={value} target="_blank" rel="noreferrer" aria-label={`Open ${label}`}>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>
      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-2xl border border-border/60 bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
        <span className="text-primary">{icon}</span> {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DeveloperAppInfoPage() {
  const { appId } = Route.useParams();
  const getFn = useServerFn(getMyDeveloperApp);
  const { data: app, isLoading } = useQuery({
    queryKey: ["developer-app", appId],
    queryFn: () => getFn({ data: { id: appId } }),
  });
  const { data: versions } = useQuery({
    queryKey: ["developer-app-versions", appId],
    queryFn: () => fetchAppVersions(appId),
  });
  const [downloading, setDownloading] = useState(false);

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Loading…</div>;
  if (!app) return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">App not found.</div>;

  const a = app as any;
  const st = REVIEW_STATES[a.status as string] ?? REVIEW_STATES.pending;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isDev = a.release_channel === "development";
  const isLive = a.status === "live" || a.status === "approved";
  const gameplay: string[] = Array.isArray(a.game_types) && a.game_types.length
    ? a.game_types
    : a.game_type
      ? [a.game_type]
      : [];
  const perms: string[] = a.permissions ?? [];

  const disclosures = [
    ["Contains ads", a.contains_ads],
    ["In-app purchases", a.has_iap],
    ["Multiplayer", a.is_multiplayer],
    ["Requires account", a.requires_account],
    ["In-app chat", a.has_chat],
    ["Online features", a.online_features],
    ["Offline mode", a.offline_mode],
    ["Controller support", a.controller_support],
    ["Cloud save", a.cloud_save],
  ].filter(([, on]) => on) as [string, boolean][];

  async function copyDownloadLink() {
    if (!a.file_path) return toast.error("No APK attached to this listing yet.");
    setDownloading(true);
    try {
      const url = await getApkSignedUrl(a.file_path);
      await navigator.clipboard?.writeText(url);
      toast.success("Temporary download link copied (valid 1 hour)");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create a download link");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link to="/developer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Developer Hub
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start gap-4 rounded-3xl border border-border/60 bg-card p-4">
        {a.icon_url ? (
          <img src={a.icon_url} alt={`${a.name} icon`} className="h-20 w-20 rounded-2xl object-cover" />
        ) : (
          <div className="h-20 w-20 rounded-2xl bg-secondary" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold">{a.name}</h1>
          <p className="text-sm text-muted-foreground">{a.short_description ?? a.tagline ?? "No short description"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${toneCls[st.tone]}`}>{st.label}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              {a.content_type === "game" ? "Game" : "Application"}
            </span>
            {isDev && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                <FlaskConical className="h-3 w-3" /> Private testing
              </span>
            )}
            {a.is_coming_soon && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">Coming soon</span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{st.description}</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto sm:flex-col">
          <Button asChild size="sm" className="flex-1 rounded-full">
            <Link to="/developer/$appId/update" params={{ appId }}><Upload className="mr-1.5 h-3.5 w-3.5" /> Update</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="flex-1 rounded-full">
            <Link to="/developer/$appId/edit" params={{ appId }}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit</Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Installs" value={<span className="inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" />{a.install_count ?? 0}</span>} />
        <Field label="Rating" value={<span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" />{Number(a.rating_avg ?? 0).toFixed(1)} ({a.rating_count ?? 0})</span>} />
        <Field label="Version" value={a.version ?? "1.0.0"} />
        <Field label="Size" value={a.apk_size ? formatBytes(a.apk_size) : "—"} />
      </div>

      {/* Links */}
      <Section title="Store links" icon={<Globe className="h-4 w-4" />}>
        <div className="space-y-2">
          {isLive && !isDev ? (
            <>
              <CopyRow label="Public store page" value={`${origin}/app/${a.slug}`} hint="Share this anywhere — it's your app's public listing." />
              <CopyRow label="Reviews & ratings" value={`${origin}/app/${a.slug}#reviews`} hint="Send this to players you'd like a review from." />
              <CopyRow label="Share link" value={`${origin}/app/${a.slug}?ref=share`} hint="Tracks installs that came from your own promotion." />
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
              Public links appear here once this listing is live on the marketplace.
            </p>
          )}
          {a.share_token && (
            <CopyRow label="Private testing link" value={`${origin}/testing/${a.share_token}`} hint="Works even while the app is unpublished. Only share with your testers." />
          )}
          <div className="rounded-xl border border-border/60 bg-background/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium">Direct download link</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Signed APK URL, valid for one hour.</p>
              </div>
              <Button size="sm" variant="outline" className="h-7 rounded-full px-3 text-xs" onClick={copyDownloadLink} disabled={downloading || !a.file_path}>
                {downloading ? "Creating…" : "Copy"}
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* Package details */}
      <Section title="Package details" icon={<Package className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Package name" value={a.package_name ?? "—"} />
          <Field label="Version code" value={a.version_code ?? "—"} />
          <Field label="Platform" value={a.platform ?? "—"} />
          <Field label="Category" value={a.game_category ?? a.subcategory ?? a.category} />
          <Field label="Min Android" value={a.min_android_version ?? "—"} />
          <Field label="Target Android" value={a.target_android_version ?? "—"} />
          <Field label="Content rating" value={a.content_rating ?? "—"} />
          <Field label="License" value={a.license === "paid" ? `Paid · ₦${((a.price_kobo ?? 0) / 100).toLocaleString()}` : "Free"} />
        </div>
        {a.content_type === "game" && gameplay.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Gameplay modes</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {gameplay.map((g) => (
                <span key={g} className="rounded-full bg-secondary px-2.5 py-1 text-xs">{gameTypeLabel(g)}</span>
              ))}
            </div>
          </div>
        )}
        {disclosures.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Disclosures</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {disclosures.map(([label]) => (
                <span key={label} className="rounded-full bg-secondary px-2.5 py-1 text-xs">{label}</span>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Security & review */}
      <Section title="Security scan & review" icon={isLive ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Review status" value={st.label} />
          <Field label="Last reviewed" value={a.reviewed_at ? new Date(a.reviewed_at).toLocaleString() : "Not yet reviewed"} />
        </div>
        {a.review_note && (
          <div className="mt-3 rounded-xl bg-orange-500/10 p-3 text-xs text-orange-300">
            <p className="font-medium">Reviewer feedback</p>
            <p className="mt-1 whitespace-pre-wrap">{a.review_note}</p>
          </div>
        )}
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Requested permissions ({perms.length})</p>
          {perms.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {perms.map((p) => (
                <span key={p} className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px]">{p.replace("android.permission.", "")}</span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No permissions detected in the uploaded package.</p>
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Privacy policy" value={a.privacy_policy_url ?? a.detected_privacy_url ?? "Not provided"} />
          <Field label="Privacy source" value={a.privacy_policy_source ?? "—"} />
        </div>
      </Section>

      {/* Version history */}
      <Section title="Version history" icon={<History className="h-4 w-4" />}>
        {!versions || versions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No releases recorded yet.</p>
        ) : (
          <ol className="space-y-2">
            {versions.map((v: any) => (
              <li key={v.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">v{v.version}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" /> {new Date(v.created_at).toLocaleDateString()}
                  </span>
                  {v.apk_size ? <span className="text-[11px] text-muted-foreground">{formatBytes(v.apk_size)}</span> : null}
                </div>
                {v.release_notes && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{v.release_notes}</p>}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
