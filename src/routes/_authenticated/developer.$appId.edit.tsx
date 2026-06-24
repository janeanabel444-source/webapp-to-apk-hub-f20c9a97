import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getMyDeveloperApp, updateDeveloperApp, deleteDeveloperApp } from "@/lib/developer.functions";

export const Route = createFileRoute("/_authenticated/developer/$appId/edit")({
  head: () => ({ meta: [{ title: "Edit App — Developer Hub" }] }),
  component: EditAppPage,
});

function EditAppPage() {
  const { appId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getMyDeveloperApp);
  const updateFn = useServerFn(updateDeveloperApp);
  const deleteFn = useServerFn(deleteDeveloperApp);

  const { data: app } = useQuery({
    queryKey: ["developer-app", appId],
    queryFn: () => getFn({ data: { id: appId } }),
  });

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!app) return;
    setName(app.name);
    setTagline(app.tagline ?? "");
    setDescription(app.description ?? "");
    setAppUrl(app.app_url ?? "");
  }, [app]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await updateFn({
        data: {
          id: appId,
          name: name.trim(),
          tagline: tagline.trim() || null,
          description: description.trim(),
          app_url: appUrl.trim() || null,
        },
      });
      await qc.invalidateQueries({ queryKey: ["developer-apps"] });
      navigate({ to: "/developer" });
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm("Delete this app permanently?")) return;
    await deleteFn({ data: { id: appId } });
    await qc.invalidateQueries({ queryKey: ["developer-apps"] });
    navigate({ to: "/developer" });
  }

  if (!app) return <div className="mx-auto max-w-2xl px-4 py-12 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/developer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Developer Hub
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Edit "{app.name}"</h1>
      <p className="text-sm text-muted-foreground">Status: <span className="font-medium">{app.status}</span></p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-3xl border border-border/60 bg-card p-5">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="tagline">Tagline</Label>
          <Input id="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 resize-none" />
        </div>
        <div>
          <Label htmlFor="app_url">App URL</Label>
          <Input id="app_url" type="url" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} className="mt-1" />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex justify-between gap-2">
          <Button type="button" variant="outline" onClick={onDelete} className="rounded-full text-destructive">
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
          <Button type="submit" disabled={busy} className="rounded-full">
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
