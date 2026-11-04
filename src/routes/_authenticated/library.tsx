import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchMyLibrary, compareVersions, isDemoApp } from "@/lib/store";
import { AppIcon } from "@/components/AppIcon";
import { InstallButton } from "@/components/InstallButton";
import { appDownloadUrl } from "@/lib/links";

export const Route = createFileRoute("/_authenticated/library")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "My library — Niza App Store" },
    { name: "description", content: "Manage your installed Niza apps and games." },
    { property: "og:title", content: "My library — Niza App Store" },
    { property: "og:description", content: "Manage your installed Niza apps and games." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Library,
});

function Library() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["library", user?.id],
    queryFn: () => user ? fetchMyLibrary(user.id) : Promise.resolve([]),
    enabled: !!user,
  });

  const rows = data ?? [];
  /** Installed apps whose listing offers a newer version than the recorded install. */
  const updates = rows.filter(
    (r) => r.app && !!r.installed_version && compareVersions(r.app.version, r.installed_version) > 0,
  );
  const updateIds = new Set(updates.map((r) => r.app!.id));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold">My library</h1>
      <p className="mt-1 text-muted-foreground">Apps you've installed.</p>

      {updates.length > 0 && (
        <div className="mt-4 rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <p className="font-semibold text-primary">Updates available ({updates.length})</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Newer versions are ready for{" "}
            {updates.map((r, i) => (
              <span key={r.app!.id}>
                {i > 0 && ", "}
                <Link to="/app/$slug" params={{ slug: r.app!.slug }} className="font-medium text-primary underline-offset-2 hover:underline">
                  {r.app!.name}
                </Link>
              </span>
            ))}
            . Tap Update on the highlighted apps below.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (data ?? []).length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <p className="font-medium">Your library is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">Browse and install apps to see them here.</p>
            <Link to="/" className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Browse apps</Link>
          </div>
        )}
        {(data ?? []).map((row) => {
          const app = row.app;
          if (!app) return null;
          return (
            <div key={app.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
              <Link to="/app/$slug" params={{ slug: app.slug }}>
                <AppIcon name={app.name} slug={app.slug} url={app.icon_url} size={56} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to="/app/$slug" params={{ slug: app.slug }} className="block truncate font-semibold hover:underline">
                  {app.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  v{row.installed_version ?? app.version}
                  {app.tagline ? ` · ${app.tagline}` : ""}
                </p>
                {updateIds.has(app.id) && (
                  <span className="mt-1 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    Update available · v{app.version}
                  </span>
                )}
              </div>
              <InstallButton
                appId={app.id}
                appName={app.name}
                packageName={app.package_name}
                filePath={app.file_path}
                appUrl={app.app_url}
                downloadUrl={appDownloadUrl(app.id)}
                isDemo={isDemoApp(app)}
                license={app.license === "paid" ? "paid" : "free"}
                priceKobo={app.price_kobo}
                initialInstalled={true}
                variant="compact"
                showUninstall
                installedVersion={row.installed_version}
                latestVersion={app.version}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
