import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import {
  isCurrentUserAdmin, adminListReports, adminUpdateReport,
  adminToggleFeatured, adminSetAppStatus, adminListApps,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Shield, Flag, Star, Ban } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Nova" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const isAdminFn = useServerFn(isCurrentUserAdmin);
  const reportsFn = useServerFn(adminListReports);
  const appsFn = useServerFn(adminListApps);
  const updateReportFn = useServerFn(adminUpdateReport);
  const toggleFeaturedFn = useServerFn(adminToggleFeatured);
  const setStatusFn = useServerFn(adminSetAppStatus);

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: () => isAdminFn({ data: undefined as never }),
  });

  useEffect(() => {
    if (!roleLoading && role && !role.admin) {
      toast.error("Admin access required");
      navigate({ to: "/" });
    }
  }, [role, roleLoading, navigate]);

  const { data: reports } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => reportsFn({ data: undefined as never }),
    enabled: !!role?.admin,
  });

  const { data: apps } = useQuery({
    queryKey: ["admin-apps"],
    queryFn: () => appsFn({ data: undefined as never }),
    enabled: !!role?.admin,
  });

  const setReportStatus = useMutation({
    mutationFn: (v: { id: string; status: "open" | "reviewing" | "resolved" | "dismissed" }) => updateReportFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reports"] }),
  });

  const toggleFeatured = useMutation({
    mutationFn: (v: { appId: string; featured: boolean }) => toggleFeaturedFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-apps"] }),
  });

  const setAppStatus = useMutation({
    mutationFn: (v: { appId: string; status: "live" | "suspended" | "pending" | "rejected" | "draft" }) => setStatusFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-apps"] }),
  });

  if (!role?.admin) return <div className="p-8 text-center text-sm text-muted-foreground">Checking permissions…</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Shield className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Moderate apps, reports and featured picks.</p>
        </div>
      </div>

      {/* Reports */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Flag className="h-4 w-4" /> App reports ({(reports ?? []).length})
        </h2>
        <ul className="mt-3 space-y-2">
          {(reports ?? []).map((r: any) => (
            <li key={r.id} className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link to="/app/$slug" params={{ slug: r.app?.slug ?? "" }} className="font-medium hover:underline">
                    {r.app?.name ?? "Unknown app"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    <span className="rounded bg-secondary px-1.5 py-0.5">{r.reason}</span>{" "}
                    · status <span className="font-medium">{r.status}</span>
                    · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  {r.details && <p className="mt-2 text-sm text-muted-foreground">{r.details}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setReportStatus.mutate({ id: r.id, status: "reviewing" })}>Reviewing</Button>
                  <Button size="sm" variant="outline" onClick={() => setReportStatus.mutate({ id: r.id, status: "resolved" })}>Resolve</Button>
                  <Button size="sm" variant="ghost" onClick={() => setReportStatus.mutate({ id: r.id, status: "dismissed" })}>Dismiss</Button>
                </div>
              </div>
            </li>
          ))}
          {(!reports || reports.length === 0) && (
            <li className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-6 text-center text-sm text-muted-foreground">
              No reports yet.
            </li>
          )}
        </ul>
      </section>

      {/* Apps */}
      <section className="mt-10">
        <h2 className="font-display text-lg font-bold">All apps ({(apps ?? []).length})</h2>
        <ul className="mt-3 space-y-2">
          {(apps ?? []).map((a: any) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
              {a.icon_url ? (
                <img src={a.icon_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-secondary" />
              )}
              <div className="min-w-0 flex-1">
                <Link to="/app/$slug" params={{ slug: a.slug }} className="font-medium hover:underline">{a.name}</Link>
                <p className="text-xs text-muted-foreground">
                  {a.category} · status <span className="font-medium">{a.status}</span>
                  {a.is_featured && <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">Featured</span>}
                  · installs {a.install_count} · downloads {a.download_count}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant={a.is_featured ? "default" : "outline"} onClick={() => toggleFeatured.mutate({ appId: a.id, featured: !a.is_featured })}>
                  <Star className="mr-1 h-3.5 w-3.5" /> {a.is_featured ? "Unfeature" : "Feature"}
                </Button>
                {a.status !== "live" ? (
                  <Button size="sm" variant="outline" onClick={() => setAppStatus.mutate({ appId: a.id, status: "live" })}>Approve</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setAppStatus.mutate({ appId: a.id, status: "suspended" })}>
                    <Ban className="mr-1 h-3.5 w-3.5" /> Suspend
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
