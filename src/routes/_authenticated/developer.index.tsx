import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Code2, Download, Clock, CheckCircle2, XCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { listMyDeveloperApps } from "@/lib/developer.functions";

export const Route = createFileRoute("/_authenticated/developer/")({
  head: () => ({ meta: [{ title: "Developer Hub — Nova" }] }),
  component: DeveloperHome,
});

const statusBadge: Record<string, { label: string; cls: string; Icon: any }> = {
  pending: { label: "Pending review", cls: "bg-amber-500/10 text-amber-600", Icon: Clock },
  approved: { label: "Approved", cls: "bg-blue-500/10 text-blue-600", Icon: CheckCircle2 },
  live: { label: "Live", cls: "bg-emerald-500/10 text-emerald-600", Icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "bg-destructive/10 text-destructive", Icon: XCircle },
};

function DeveloperHome() {
  const { user } = useAuth();
  const listFn = useServerFn(listMyDeveloperApps);
  
  const { data: apps, isLoading } = useQuery({
    queryKey: ["developer-apps"],
    queryFn: () => listFn({ data: undefined as never }),
    enabled: !!user, // Only fetch if authenticated
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Code2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold">Developer Hub</h1>
          <p className="text-sm text-muted-foreground">Publish apps and games to Nova.</p>
        </div>
        {user && (
          <Button asChild className="ml-auto rounded-full">
            <Link to="/developer/new"><Plus className="mr-1.5 h-4 w-4" /> Upload new app</Link>
          </Button>
        )}
      </div>

      <div className="mt-8">
        {!user ? (
          <div className="rounded-3xl border border-dashed border-border/60 bg-card/50 p-10 text-center">
            <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-primary/10 p-3">
              <LogIn className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-lg font-semibold">Sign in to publish apps</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create an account to start publishing your apps and games on Nova.
            </p>
            <Button asChild className="mt-6 rounded-full">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !apps || apps.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/60 bg-card/50 p-10 text-center">
            <h2 className="font-display text-lg font-semibold">You haven't published anything yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload your first app or game. A logo is required to publish.
            </p>
            <Button asChild className="mt-5 rounded-full">
              <Link to="/developer/new">Upload your first app</Link>
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {apps.map((a) => {
              const s = statusBadge[a.status as string] ?? statusBadge.pending;
              return (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
                  {a.icon_url ? (
                    <img src={a.icon_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-secondary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{a.name}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.cls}`}>
                        <s.Icon className="h-3 w-3" /> {s.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {a.category === "game" ? "Game" : "App"} · {a.platform ?? "—"} ·{" "}
                      <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" />{a.install_count}</span>
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="rounded-full">
                    <Link to="/developer/$appId/edit" params={{ appId: a.id }}>Edit</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
