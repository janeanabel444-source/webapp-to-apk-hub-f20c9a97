import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchMyLibrary } from "@/lib/store";
import { AppIcon } from "@/components/AppIcon";
import { InstallButton } from "@/components/InstallButton";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({ meta: [{ title: "My library — Nova App Store" }] }),
  component: Library,
});

function Library() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["library", user?.id],
    queryFn: () => fetchMyLibrary(user!.id),
    enabled: !!user,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold">My library</h1>
      <p className="mt-1 text-muted-foreground">Apps you've installed.</p>

      <div className="mt-6 space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (data ?? []).length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <p className="font-medium">Your library is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">Browse and install apps to see them here.</p>
            <Link to="/" className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Browse apps</Link>
          </div>
        )}
        {(data ?? []).map((row: any) => {
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
                <p className="truncate text-xs text-muted-foreground">{app.tagline}</p>
              </div>
              <InstallButton appId={app.id} initialInstalled={true} variant="compact" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
