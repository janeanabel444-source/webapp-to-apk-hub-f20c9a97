import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminListCampaigns, adminModerateCampaign } from "@/lib/ads.functions";

type Action = "approve" | "reject" | "pause" | "resume" | "delete";

export function AdminCampaigns() {
  const listFn = useServerFn(adminListCampaigns);
  const modFn = useServerFn(adminModerateCampaign);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-campaigns"], queryFn: () => listFn() });
  const mod = useMutation({
    mutationFn: (v: { campaignId: string; action: Action }) => modFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-campaigns"] }),
    onError: (e: any) => toast.error(e?.message ?? "Action failed"),
  });
  const rows = (data ?? []) as any[];
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <Megaphone className="h-4 w-4" /> Ad campaigns ({rows.length})
      </h2>
      <ul className="mt-3 space-y-2">
        {rows.length === 0 && <li className="text-sm text-muted-foreground">No campaigns yet.</li>}
        {rows.map((c) => (
          <li key={c.id} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name} <span className="text-xs text-muted-foreground">· {c.app?.name}</span></p>
                <p className="text-xs text-muted-foreground">
                  {c.status} · ₦{(c.spent_kobo / 100).toLocaleString()} / ₦{(c.total_budget_kobo / 100).toLocaleString()} ·{" "}
                  {c.impressions_count} views · {c.clicks_count} clicks · {c.downloads_count} downloads
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {c.status === "pending_review" && (
                  <>
                    <Button size="sm" onClick={() => mod.mutate({ campaignId: c.id, action: "approve" })}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => mod.mutate({ campaignId: c.id, action: "reject" })}>Reject</Button>
                  </>
                )}
                {c.status === "active" && <Button size="sm" variant="outline" onClick={() => mod.mutate({ campaignId: c.id, action: "pause" })}>Pause</Button>}
                {c.status === "paused" && <Button size="sm" variant="outline" onClick={() => mod.mutate({ campaignId: c.id, action: "resume" })}>Resume</Button>}
                <Button size="sm" variant="ghost" onClick={() => confirm("Delete this campaign?") && mod.mutate({ campaignId: c.id, action: "delete" })}>Delete</Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
