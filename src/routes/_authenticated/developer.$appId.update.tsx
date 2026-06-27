import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Loader2, UploadCloud, History } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { uploadToBucket } from "@/lib/upload";
import { getMyDeveloperApp, publishAppUpdate } from "@/lib/developer.functions";
import { fetchAppVersions, compareVersions } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/developer/$appId/update")({
  head: () => ({ meta: [{ title: "Release Update — Developer Hub" }] }),
  component: UpdateAppPage,
});

function UpdateAppPage() {
  const { appId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getMyDeveloperApp);
  const publishFn = useServerFn(publishAppUpdate);

  const { data: app } = useQuery({
    queryKey: ["developer-app", appId],
    queryFn: () => getFn({ data: { id: appId } }),
  });
  const { data: history } = useQuery({
    queryKey: ["app-versions", appId],
    queryFn: () => fetchAppVersions(appId),
  });

  const [version, setVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [appFile, setAppFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!user || !app) return;

    const v = version.trim();
    if (!/^\d+(\.\d+){0,3}$/.test(v)) {
      setErr("Version must look like 1.0.1, 1.1.0, or 2.0.0.");
      return;
    }
    if (compareVersions(v, app.version) <= 0) {
      setErr(`Version must be greater than the current version (${app.version}).`);
      return;
    }
    if (releaseNotes.trim().length < 3) {
      setErr("Please describe what changed in this release.");
      return;
    }

    setBusy(true);
    try {
      let filePath: string | null = null;
      if (appFile) {
        const up = await uploadToBucket("app-files", user.id, appFile);
        filePath = up.path;
      }
      await publishFn({
        data: {
          id: app.id,
          version: v,
          release_notes: releaseNotes.trim(),
          file_path: filePath,
        },
      });
      await qc.invalidateQueries({ queryKey: ["developer-apps"] });
      await qc.invalidateQueries({ queryKey: ["developer-app", appId] });
      await qc.invalidateQueries({ queryKey: ["app-versions", appId] });
      navigate({ to: "/developer" });
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!app) {
    return <div className="mx-auto max-w-2xl px-4 py-12 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/developer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Developer Hub
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Release an update for "{app.name}"</h1>
      <p className="text-sm text-muted-foreground">
        Current version: <span className="font-medium text-foreground">{app.version}</span>. Your
        listing, ratings, reviews, downloads, and screenshots will be preserved.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5 rounded-3xl border border-border/60 bg-card p-5">
        <div>
          <Label htmlFor="version">New version number</Label>
          <Input
            id="version"
            placeholder="e.g. 1.0.1"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="mt-1"
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Must be greater than {app.version}. Use semantic versioning (major.minor.patch).
          </p>
        </div>

        <div>
          <Label htmlFor="notes">Release notes — what changed?</Label>
          <Textarea
            id="notes"
            rows={5}
            placeholder="• Fixed a crash on launch&#10;• Added dark mode&#10;• Improved performance"
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
            className="mt-1 resize-none"
            maxLength={2000}
            required
          />
        </div>

        <div>
          <Label>New app file (optional — leave empty to keep the current binary)</Label>
          <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
            <UploadCloud className="h-4 w-4" />
            <span>{appFile ? appFile.name : "Upload new .apk / .zip"}</span>
            <input
              type="file"
              className="hidden"
              accept=".apk,.zip,application/zip,application/vnd.android.package-archive"
              onChange={(e) => setAppFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            New binaries are automatically scanned for malware before going live.
          </p>
        </div>

        {err && <p className="text-sm text-destructive">{err}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/developer" })} className="rounded-full">
            Cancel
          </Button>
          <Button type="submit" disabled={busy} className="rounded-full">
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publishing update…</> : "Publish update"}
          </Button>
        </div>
      </form>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <History className="h-4 w-4" /> Version history
        </h2>
        <ol className="mt-3 space-y-3">
          {(history ?? []).map((v) => (
            <li key={v.id} className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold">v{v.version}</span>
                <time className="text-xs text-muted-foreground">
                  {new Date(v.created_at).toLocaleDateString()}
                </time>
              </div>
              {v.release_notes && (
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{v.release_notes}</p>
              )}
            </li>
          ))}
          {(history ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">No history yet.</li>
          )}
        </ol>
      </section>
    </div>
  );
}
