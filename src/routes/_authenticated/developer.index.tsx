import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Code2, Download, LogIn, Copy, RefreshCw, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { listMyDeveloperApps, resubmitForReview } from "@/lib/developer.functions";
import { REVIEW_STATES } from "@/lib/review";

export const Route = createFileRoute("/_authenticated/developer/")({
  head: () => ({ meta: [{ title: "Developer Hub — Niza" }] }),
  component: DeveloperHome,
});

const toneCls: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  good: "bg-emerald-500/10 text-emerald-600",
  warn: "bg-orange-500/10 text-orange-600",
  bad: "bg-destructive/10 text-destructive",
};


function DeveloperHome() {
  const { user } = useAuth();
  const listFn = useServerFn(listMyDeveloperApps);
  
  const { data: apps, isLoading } = useQuery({
    queryKey: ["developer-apps"],
    queryFn: () => listFn({ data: undefined as never }),
    enabled: !!user, // Only fetch if authenticated
  });

  const qc = useQueryClient();
  const resubmitFn = useServerFn(resubmitForReview);
  const resubmit = useMutation({
    mutationFn: (id: string) => resubmitFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Submitted for review");
      qc.invalidateQueries({ queryKey: ["developer-apps"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not resubmit"),
  });


  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Code2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold">Developer Hub</h1>
          <p className="text-sm text-muted-foreground">Publish apps and games to Niza.</p>
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
              Create an account to start publishing your apps and games on Niza.
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
          <ul className="grid grid-cols-1 gap-3">
            {apps.map((a) => {
              const st = REVIEW_STATES[a.status as string] ?? REVIEW_STATES.pending;
              const isDev = (a as any).release_channel === "development";
              const note = (a as any).review_note as string | null;
              return (
                <li key={a.id} className="rounded-2xl border border-border/60 bg-card p-3 transition hover:border-primary/40">
                  <div className="flex items-center gap-3">
                    <Link
                      to="/developer/$appId"
                      params={{ appId: a.id }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      {a.icon_url ? (
                        <img src={a.icon_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                      ) : (
                        <div className="h-14 w-14 rounded-xl bg-secondary" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{a.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${toneCls[st.tone]}`}>
                            {st.label}
                          </span>
                          {isDev && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              <FlaskConical className="h-3 w-3" /> Private
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{st.description}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {a.category === "game" ? "Game" : "App"} · {a.platform ?? "—"} ·{" "}
                          <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" />{a.install_count}</span>
                        </p>
                      </div>
                    </Link>
                    <div className="flex flex-col gap-1.5 sm:flex-row">
                      <Button asChild size="sm" className="rounded-full">
                        <Link to="/developer/$appId/update" params={{ appId: a.id }}>Update</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="rounded-full">
                        <Link to="/developer/$appId/edit" params={{ appId: a.id }}>Edit</Link>
                      </Button>
                    </div>
                  </div>

                  {note && (
                    <div className="mt-3 rounded-xl bg-orange-500/10 p-3 text-xs text-orange-700">
                      <p className="font-medium">Reviewer feedback</p>
                      <p className="mt-1 whitespace-pre-wrap">{note}</p>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2">
                    {["changes_requested", "rejected"].includes(a.status as string) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={resubmit.isPending}
                        onClick={() => resubmit.mutate(a.id)}
                      >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Resubmit for review
                      </Button>
                    )}
                    {isDev && (a as any).share_token && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full"
                        onClick={() => {
                          navigator.clipboard?.writeText(`${window.location.origin}/testing/${(a as any).share_token}`);
                          toast.success("Testing link copied");
                        }}
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy testing link
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

        )}
      </div>
    </div>
  );
}
