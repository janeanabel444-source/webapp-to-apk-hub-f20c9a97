import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, ImagePlus, Loader2, UploadCloud, Package, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { uploadToBucket } from "@/lib/upload";
import { createDeveloperApp } from "@/lib/developer.functions";
import { parseApkFile, formatBytes, type ParsedApk } from "@/lib/apk-parser";

export const Route = createFileRoute("/_authenticated/developer/new")({
  head: () => ({ meta: [{ title: "Upload App — Developer Hub" }] }),
  component: NewAppPage,
});

function NewAppPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const create = useServerFn(createDeveloperApp);

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"app" | "game">("app");
  const [platform, setPlatform] = useState<"web" | "pwa" | "android">("android");
  const [appUrl, setAppUrl] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [appFile, setAppFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [apkInfo, setApkInfo] = useState<ParsedApk | null>(null);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function pickLogo(f: File | null) {
    setLogo(f);
    setLogoPreview(f ? URL.createObjectURL(f) : null);
  }

  async function pickAppFile(f: File | null) {
    setAppFile(f);
    setApkInfo(null);
    if (!f) return;
    if (platform === "android" && /\.apk$/i.test(f.name)) {
      setParsing(true);
      try {
        const info = await parseApkFile(f);
        setApkInfo(info);
      } finally {
        setParsing(false);
      }
    } else {
      setApkInfo({ packageName: null, versionName: null, versionCode: null, apkSize: f.size, permissions: [] });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!user) return;
    if (!logo) return setErr("App logo is required to publish.");
    if (platform === "android") {
      if (!appFile) return setErr("Android apps require an APK upload.");
    } else if (!appUrl && !appFile) {
      return setErr("Provide an app URL or upload an app file.");
    }
    setBusy(true);
    try {
      const logoUp = await uploadToBucket("app-logos", user.id, logo);
      const shotUps = await Promise.all(
        screenshots.map((f) => uploadToBucket("app-screenshots", user.id, f)),
      );
      let filePath: string | null = null;
      if (appFile) {
        const fUp = await uploadToBucket("app-files", user.id, appFile);
        filePath = fUp.path;
      }
      await create({
        data: {
          name: name.trim(),
          tagline: tagline.trim() || null,
          description: description.trim(),
          category,
          platform,
          icon_url: logoUp.url,
          app_url: platform === "android" ? null : (appUrl.trim() || null),
          file_path: filePath,
          screenshots: shotUps.map((s) => s.url),
          package_name: apkInfo?.packageName ?? null,
          version_name: apkInfo?.versionName ?? null,
          version_code: apkInfo?.versionCode ?? null,
          apk_size: apkInfo?.apkSize ?? null,
          permissions: apkInfo?.permissions ?? [],
        },
      });
      navigate({ to: "/developer" });
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/developer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Developer Hub
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Upload a new app</h1>
      <p className="text-sm text-muted-foreground">
        An app logo is required. Android submissions must include an APK file.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5 rounded-3xl border border-border/60 bg-card p-5">
        <div>
          <Label>App logo <span className="text-destructive">*</span></Label>
          <div className="mt-2 flex items-center gap-4">
            <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-2xl border border-dashed border-border bg-background text-muted-foreground hover:bg-secondary">
              {logoPreview ? (
                <img src={logoPreview} alt="logo" className="h-full w-full rounded-2xl object-cover" />
              ) : (
                <ImagePlus className="h-6 w-6" />
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0] ?? null)} />
            </label>
            <p className="text-xs text-muted-foreground">Square PNG/JPG recommended.</p>
          </div>
        </div>

        <div>
          <Label htmlFor="name">App name</Label>
          <Input id="name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
        </div>

        <div>
          <Label htmlFor="tagline">Tagline (optional)</Label>
          <Input id="tagline" maxLength={160} value={tagline} onChange={(e) => setTagline(e.target.value)} className="mt-1" />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" required minLength={10} maxLength={4000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Category</Label>
            <select value={category} onChange={(e) => setCategory(e.target.value as any)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="app">App</option>
              <option value="game">Game</option>
            </select>
          </div>
          <div>
            <Label>Platform</Label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as any)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="android">Android (APK)</option>
              <option value="web">Web</option>
              <option value="pwa">PWA</option>
            </select>
          </div>
        </div>

        {platform !== "android" && (
          <div>
            <Label htmlFor="app_url">App URL</Label>
            <Input id="app_url" type="url" placeholder="https://yourapp.com" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} className="mt-1" />
          </div>
        )}

        <div>
          <Label>{platform === "android" ? "APK file *" : "App file (optional)"}</Label>
          <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
            <UploadCloud className="h-4 w-4" />
            <span>{appFile ? appFile.name : platform === "android" ? "Upload .apk" : "Upload .apk / .zip"}</span>
            <input
              type="file"
              className="hidden"
              accept={platform === "android" ? ".apk,application/vnd.android.package-archive" : ".apk,.zip,application/zip,application/vnd.android.package-archive"}
              onChange={(e) => pickAppFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {parsing && (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Reading APK metadata…
            </p>
          )}
          {apkInfo && !parsing && (
            <div className="mt-2 rounded-xl border border-border/60 bg-background/50 p-3 text-xs">
              <div className="flex items-center gap-1 font-semibold text-foreground">
                <Package className="h-3.5 w-3.5" /> Detected
              </div>
              <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                <dt>Package</dt><dd className="truncate text-foreground">{apkInfo.packageName ?? "—"}</dd>
                <dt>Version</dt><dd className="text-foreground">{apkInfo.versionName ?? "—"} ({apkInfo.versionCode ?? "—"})</dd>
                <dt>Size</dt><dd className="text-foreground">{formatBytes(apkInfo.apkSize)}</dd>
                <dt>Permissions</dt><dd className="text-foreground">{apkInfo.permissions.length}</dd>
              </dl>
              {apkInfo.permissions.length > 0 && (
                <details className="mt-2">
                  <summary className="flex cursor-pointer items-center gap-1 text-muted-foreground"><Shield className="h-3 w-3" /> View permissions</summary>
                  <ul className="mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-[11px] text-muted-foreground">
                    {apkInfo.permissions.map((p) => <li key={p} className="font-mono">{p}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <div>
          <Label>Screenshots (optional, up to 8)</Label>
          <input type="file" multiple accept="image/*" className="mt-1 block w-full text-sm" onChange={(e) => setScreenshots(Array.from(e.target.files ?? []).slice(0, 8))} />
        </div>

        {err && <p className="text-sm text-destructive">{err}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/developer" })} className="rounded-full">Cancel</Button>
          <Button type="submit" disabled={busy} className="rounded-full">
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publishing…</> : "Publish"}
          </Button>
        </div>
      </form>
    </div>
  );
}
