import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Loader2, UploadCloud, History, Sparkles, Package } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { uploadToBucket } from "@/lib/upload";
import { getMyDeveloperApp, publishAppUpdate } from "@/lib/developer.functions";
import { generateReleaseNotes } from "@/lib/release-notes.functions";
import { fetchAppVersions, compareVersions } from "@/lib/store";
import { parseApkFile, diffPermissions, formatBytes, type ParsedApk } from "@/lib/apk-parser";
import { toast } from "sonner";

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
  const genNotes = useServerFn(generateReleaseNotes);

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
  const [apkInfo, setApkInfo] = useState<ParsedApk | null>(null);
  const [parsing, setParsing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPickFile(f: File | null) {
    setAppFile(f);
    setApkInfo(null);
    if (!f || !app) return;
    setParsing(true);
    try {
      const info = await parseApkFile(f);
      setApkInfo(info);
      if (info.versionName && !version) setVersion(info.versionName);
      // Auto-suggest release notes from diff
      const diff = diffPermissions(app.permissions as string[] | null, info.permissions);
      setGenerating(true);
      try {
        const res = await genNotes({
          data: {
            appName: app.name,
            previousVersion: app.version ?? null,
            newVersion: info.versionName ?? version ?? "next",
            previousSize: app.apk_size ?? null,
            newSize: info.apkSize,
            permissionsAdded: diff.added,
            permissionsRemoved: diff.removed,
          },
        });
        if (!releaseNotes) setReleaseNotes(res.notes);
        if (res.source === "ai") toast.success("AI release notes drafted — edit before publishing");
        else toast.message("Release notes drafted from APK diff");
      } finally {
        setGenerating(false);
      }
    } finally {
      setParsing(false);
    }
  }

  async function regenerate() {
    if (!app) return;
    setGenerating(true);
    try {
      const diff = diffPermissions(app.permissions as string[] | null, apkInfo?.permissions ?? []);
      const res = await genNotes({
        data: {
          appName: app.name,
          previousVersion: app.version ?? null,
          newVersion: version || apkInfo?.versionName || "next",
          previousSize: app.apk_size ?? null,
          newSize: apkInfo?.apkSize ?? null,
          permissionsAdded: diff.added,
          permissionsRemoved: diff.removed,
        },
      });
      setReleaseNotes(res.notes);
    } finally {
      setGenerating(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!user || !app) return;
    const v = version.trim();
    if (!/^\d+(\.\d+){0,3}$/.test(v)) return setErr("Version must look like 1.0.1.");
    if (compareVersions(v, app.version) <= 0) return setErr(`Version must be greater than ${app.version}.`);
    if (releaseNotes.trim().length < 3) return setErr("Please describe what changed.");

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
          package_name: apkInfo?.packageName ?? null,
          version_code: apkInfo?.versionCode ?? null,
          apk_size: apkInfo?.apkSize ?? null,
          permissions: apkInfo?.permissions ?? [],
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

  if (!app) return <div className="mx-auto max-w-2xl px-4 py-12 text-sm text-muted-foreground">Loading…</div>;

  const diff = apkInfo ? diffPermissions(app.permissions as string[] | null, apkInfo.permissions) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/developer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Developer Hub
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Release an update for "{app.name}"</h1>
      <p className="text-sm text-muted-foreground">
        Current version: <span className="font-medium text-foreground">{app.version}</span>. Ratings, reviews, downloads and screenshots are preserved.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5 rounded-3xl border border-border/60 bg-card p-5">
        <div>
          <Label>New APK (recommended — auto-detects version + diff)</Label>
          <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
            <UploadCloud className="h-4 w-4" />
            <span>{appFile ? appFile.name : "Upload new .apk"}</span>
            <input type="file" className="hidden" accept=".apk,application/vnd.android.package-archive" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
          </label>
          {parsing && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Reading APK…</p>}
          {apkInfo && !parsing && (
            <div className="mt-2 rounded-xl border border-border/60 bg-background/50 p-3 text-xs">
              <div className="flex items-center gap-1 font-semibold"><Package className="h-3.5 w-3.5" /> Detected</div>
              <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                <dt>Package</dt><dd className="truncate text-foreground">{apkInfo.packageName ?? "—"}</dd>
                <dt>Version</dt><dd className="text-foreground">{apkInfo.versionName ?? "—"} ({apkInfo.versionCode ?? "—"})</dd>
                <dt>Size</dt><dd className="text-foreground">{formatBytes(app.apk_size)} → {formatBytes(apkInfo.apkSize)}</dd>
                <dt>Permissions</dt><dd className="text-foreground">+{diff?.added.length ?? 0} / −{diff?.removed.length ?? 0}</dd>
              </dl>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="version">New version number</Label>
          <Input id="version" placeholder="e.g. 1.0.1" value={version} onChange={(e) => setVersion(e.target.value)} className="mt-1" required />
          <p className="mt-1 text-xs text-muted-foreground">Must be greater than {app.version}.</p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notes">Release notes</Label>
            <Button type="button" variant="ghost" size="sm" onClick={regenerate} disabled={generating || !apkInfo} className="h-7 gap-1 px-2 text-xs">
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Regenerate with AI
            </Button>
          </div>
          <Textarea
            id="notes"
            rows={6}
            placeholder="Upload an APK above to auto-draft release notes, or write your own."
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
            className="mt-1 resize-none"
            maxLength={2000}
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">Edit, replace, or accept the AI-drafted notes before publishing.</p>
        </div>

        {err && <p className="text-sm text-destructive">{err}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/developer" })} className="rounded-full">Cancel</Button>
          <Button type="submit" disabled={busy} className="rounded-full">
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publishing…</> : "Publish update"}
          </Button>
        </div>
      </form>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><History className="h-4 w-4" /> Version history</h2>
        <ol className="mt-3 space-y-3">
          {(history ?? []).map((v) => (
            <li key={v.id} className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold">v{v.version}</span>
                <time className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</time>
              </div>
              {v.release_notes && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{v.release_notes}</p>}
            </li>
          ))}
          {(history ?? []).length === 0 && <li className="text-sm text-muted-foreground">No history yet.</li>}
        </ol>
      </section>
    </div>
  );
}
