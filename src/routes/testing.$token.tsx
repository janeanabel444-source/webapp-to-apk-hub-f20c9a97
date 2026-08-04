import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Download, FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAppByShareToken } from "@/lib/developer.functions";
import { downloadApkWithProgress } from "@/lib/apk-download";
import { formatBytes } from "@/lib/apk-parser";

export const Route = createFileRoute("/testing/$token")({
  head: () => ({
    meta: [
      { title: "Private Testing Build — Niza App Store" },
      { name: "description", content: "A private Niza App Store development build shared for testing. Not listed in the public marketplace." },
      { property: "og:title", content: "Private Testing Build — Niza App Store" },
      { property: "og:description", content: "A private development build shared for testing on Niza App Store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TestingBuildPage,
});

function TestingBuildPage() {
  const { token } = Route.useParams();
  const fetchApp = useServerFn(getAppByShareToken);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: app, isLoading } = useQuery({
    queryKey: ["share-token-app", token],
    queryFn: () => fetchApp({ data: { token } }),
  });

  async function install() {
    if (!app?.file_path) return;
    setErr(null);
    setBusy(true);
    try {
      await downloadApkWithProgress(app.file_path, app.name, () => {});
    } catch (e: any) {
      setErr(e?.message ?? "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return <p className="mx-auto max-w-2xl px-4 py-16 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!app) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Testing link not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This private testing link is invalid or has been removed.
        </p>
        <Button asChild className="mt-6 rounded-full"><Link to="/">Go to Niza App Store</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">
        <FlaskConical className="h-3.5 w-3.5" /> Private development build
      </p>

      <div className="mt-5 flex items-center gap-4">
        {app.icon_url ? (
          <img src={app.icon_url} alt={`${app.name} icon`} className="h-20 w-20 rounded-2xl object-cover" />
        ) : (
          <div className="h-20 w-20 rounded-2xl bg-secondary" />
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold">{app.name}</h1>
          <p className="text-sm text-muted-foreground">{app.short_description ?? app.tagline}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            v{app.version}
            {app.apk_size ? ` · ${formatBytes(app.apk_size)}` : ""}
            {app.developer_name ? ` · ${app.developer_name}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {app.file_path && (
          <Button className="rounded-full" onClick={install} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            Download test build
          </Button>
        )}
        {app.app_url && (
          <Button asChild variant="outline" className="rounded-full">
            <a href={app.app_url} target="_blank" rel="noreferrer">Open application</a>
          </Button>
        )}
      </div>
      {err && <p className="mt-4 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}

      {Array.isArray(app.screenshots) && app.screenshots.length > 0 && (
        <div className="mt-7 flex gap-3 overflow-x-auto pb-2">
          {(app.screenshots as string[]).map((s, i) => (
            <img key={s} src={s} alt={`${app.name} screenshot ${i + 1}`} className="h-64 shrink-0 rounded-2xl object-cover" />
          ))}
        </div>
      )}

      <h2 className="mt-8 font-display text-lg font-semibold">About this build</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{app.description}</p>

      {app.latest_release_notes && (
        <>
          <h2 className="mt-6 font-display text-lg font-semibold">What's new</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{app.latest_release_notes}</p>
        </>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        This build is not listed in the Niza marketplace and does not appear in search or categories.
      </p>
    </div>
  );
}
