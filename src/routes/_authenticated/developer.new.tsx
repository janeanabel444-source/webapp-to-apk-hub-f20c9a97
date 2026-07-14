import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, Package, Save,
  Shield, Sparkles, UploadCloud, X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { uploadToBucket } from "@/lib/upload";
import { createDeveloperApp, checkAppNameAvailable } from "@/lib/developer.functions";
import { generateAppDescription, generateAppKeywords } from "@/lib/app-listing-ai.functions";
import { generateReleaseNotes } from "@/lib/release-notes.functions";
import { parseApkFile, formatBytes, type ParsedApk } from "@/lib/apk-parser";

export const Route = createFileRoute("/_authenticated/developer/new")({
  head: () => ({
    meta: [
      { title: "Upload App — Nova Developer Hub" },
      { name: "description", content: "Publish your Android APK on Nova App Store — a guided, professional submission form." },
    ],
  }),
  component: NewAppPage,
});

type Category = "app" | "game";
type Platform = "web" | "pwa" | "android";
type Rating = "everyone" | "teen" | "mature";
type License = "free" | "paid";

interface DraftState {
  name: string;
  shortDescription: string;
  description: string;
  tagline: string;
  category: Category;
  subcategory: string;
  tags: string[];
  platform: Platform;
  appUrl: string;
  developerName: string;
  developerEmail: string;
  websiteUrl: string;
  privacyPolicyUrl: string;
  minAndroidVersion: string;
  targetAndroidVersion: string;
  languages: string[];
  contentRating: Rating;
  license: License;
  priceNaira: string;
  releaseNotes: string;
}

const DRAFT_KEY = "nova.developer.new-app.draft";
const ANDROID_VERSIONS = ["5.0", "6.0", "7.0", "8.0", "9.0", "10", "11", "12", "13", "14", "15"];
const LANGUAGES = ["English", "French", "Spanish", "Portuguese", "German", "Arabic", "Hindi", "Chinese", "Swahili", "Yoruba", "Igbo", "Hausa"];

const initialDraft: DraftState = {
  name: "",
  shortDescription: "",
  description: "",
  tagline: "",
  category: "app",
  subcategory: "",
  tags: [],
  platform: "android",
  appUrl: "",
  developerName: "",
  developerEmail: "",
  websiteUrl: "",
  privacyPolicyUrl: "",
  minAndroidVersion: "7.0",
  targetAndroidVersion: "14",
  languages: ["English"],
  contentRating: "everyone",
  license: "free",
  priceNaira: "",
  releaseNotes: "",
};

const STEPS = [
  { id: "basics", label: "Basics" },
  { id: "media", label: "Media" },
  { id: "apk", label: "APK" },
  { id: "details", label: "Details" },
  { id: "store", label: "Store info" },
  { id: "preview", label: "Preview" },
] as const;

function NewAppPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const create = useServerFn(createDeveloperApp);
  const checkName = useServerFn(checkAppNameAvailable);
  const aiDescribe = useServerFn(generateAppDescription);
  const aiKeywords = useServerFn(generateAppKeywords);
  const aiReleaseNotes = useServerFn(generateReleaseNotes);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<DraftState>(initialDraft);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
  const [appFile, setAppFile] = useState<File | null>(null);
  const [apkInfo, setApkInfo] = useState<ParsedApk | null>(null);
  const [parsing, setParsing] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [nameStatus, setNameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<"desc" | "kw" | "notes" | null>(null);
  const [autosaved, setAutosaved] = useState<Date | null>(null);

  const set = useCallback(<K extends keyof DraftState>(k: K, v: DraftState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  // Load draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setForm({ ...initialDraft, ...parsed });
      }
    } catch { /* ignore */ }
  }, []);

  // Autosave (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
        setAutosaved(new Date());
      } catch { /* ignore */ }
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [form]);

  // Debounced duplicate-name check
  useEffect(() => {
    const n = form.name.trim();
    if (n.length < 2) { setNameStatus("idle"); return; }
    setNameStatus("checking");
    const t = setTimeout(async () => {
      try {
        const res = await checkName({ data: { name: n } });
        setNameStatus(res.available ? "available" : "taken");
      } catch { setNameStatus("idle"); }
    }, 500);
    return () => clearTimeout(t);
  }, [form.name, checkName]);

  function pickLogo(f: File | null) {
    setLogo(f);
    setLogoPreview(f ? URL.createObjectURL(f) : null);
  }
  function pickBanner(f: File | null) {
    setBanner(f);
    setBannerPreview(f ? URL.createObjectURL(f) : null);
  }
  function pickScreenshots(files: FileList | null) {
    const arr = Array.from(files ?? []).slice(0, 8);
    setScreenshots(arr);
    setScreenshotPreviews(arr.map((f) => URL.createObjectURL(f)));
  }
  function removeScreenshot(i: number) {
    const next = screenshots.filter((_, idx) => idx !== i);
    setScreenshots(next);
    setScreenshotPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  async function pickAppFile(f: File | null) {
    setAppFile(f);
    setApkInfo(null);
    if (!f) return;
    if (form.platform === "android" && /\.apk$/i.test(f.name)) {
      setParsing(true);
      try {
        const info = await parseApkFile(f);
        setApkInfo(info);
      } finally { setParsing(false); }
    } else {
      setApkInfo({ packageName: null, versionName: null, versionCode: null, apkSize: f.size, permissions: [] });
    }
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (!t) return;
    if (form.tags.includes(t) || form.tags.length >= 12) { setTagInput(""); return; }
    set("tags", [...form.tags, t]);
    setTagInput("");
  }

  async function runAiDescription() {
    if (!form.name) { setErr("Add an app name first."); return; }
    setAiBusy("desc");
    try {
      const res = await aiDescribe({
        data: { name: form.name, category: form.category, tagline: form.tagline || null, hint: form.shortDescription || null },
      });
      set("description", res.text);
    } catch (e: any) { setErr(e?.message ?? "AI failed"); }
    finally { setAiBusy(null); }
  }
  async function runAiKeywords() {
    if (!form.name) { setErr("Add an app name first."); return; }
    setAiBusy("kw");
    try {
      const res = await aiKeywords({ data: { name: form.name, category: form.category, description: form.description || null } });
      const merged = Array.from(new Set([...form.tags, ...res.tags])).slice(0, 12);
      set("tags", merged);
    } catch (e: any) { setErr(e?.message ?? "AI failed"); }
    finally { setAiBusy(null); }
  }
  async function runAiReleaseNotes() {
    if (!form.name) { setErr("Add an app name first."); return; }
    setAiBusy("notes");
    try {
      const res = await aiReleaseNotes({
        data: {
          appName: form.name,
          previousVersion: null,
          newVersion: apkInfo?.versionName ?? "1.0.0",
          previousSize: null,
          newSize: apkInfo?.apkSize ?? null,
          permissionsAdded: apkInfo?.permissions ?? [],
          permissionsRemoved: [],
        },
      });
      set("releaseNotes", res.notes);
    } catch (e: any) { setErr(e?.message ?? "AI failed"); }
    finally { setAiBusy(null); }
  }

  const validation = useMemo(() => {
    const errors: Record<string, string> = {};
    if (form.name.trim().length < 2) errors.name = "App name is required (min 2 chars).";
    if (nameStatus === "taken") errors.name = "You already have an app with this name.";
    if (form.shortDescription.length > 80) errors.shortDescription = "Short description must be 80 chars or less.";
    if (form.description.trim().length < 10) errors.description = "Description must be at least 10 characters.";
    if (!logo) errors.logo = "App icon is required.";
    if (form.platform === "android" && !appFile) errors.appFile = "APK file is required for Android.";
    if (form.platform !== "android" && !form.appUrl && !appFile) errors.appFile = "Provide an app URL or upload a file.";
    if (form.developerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.developerEmail)) errors.developerEmail = "Invalid email.";
    if (form.license === "paid" && (!form.priceNaira || Number(form.priceNaira) <= 0)) errors.price = "Price required for paid apps.";
    return errors;
  }, [form, logo, appFile, nameStatus]);

  const stepValid = useMemo(() => {
    switch (STEPS[step].id) {
      case "basics":
        return !validation.name && !validation.shortDescription && !validation.description && form.name && form.description;
      case "media":
        return !validation.logo;
      case "apk":
        return !validation.appFile;
      case "details":
        return !validation.developerEmail;
      case "store":
        return !validation.price;
      case "preview":
        return Object.keys(validation).length === 0;
      default: return true;
    }
  }, [step, validation, form]);

  async function submit(asDraft: boolean) {
    setErr(null);
    if (!user) return;
    if (!asDraft && Object.keys(validation).length > 0) {
      setErr(Object.values(validation)[0]);
      return;
    }
    if (!logo && !asDraft) { setErr("App icon is required."); return; }
    setBusy(true);
    try {
      setProgress({ label: "Uploading icon…", pct: 10 });
      const logoUp = logo ? await uploadToBucket("app-logos", user.id, logo) : null;
      let bannerUrl: string | null = null;
      if (banner) {
        setProgress({ label: "Uploading feature banner…", pct: 20 });
        const b = await uploadToBucket("app-screenshots", user.id, banner);
        bannerUrl = b.url;
      }
      setProgress({ label: "Uploading screenshots…", pct: 35 });
      const shotUps = await Promise.all(
        screenshots.map((f) => uploadToBucket("app-screenshots", user.id, f)),
      );
      let filePath: string | null = null;
      if (appFile) {
        setProgress({ label: "Uploading APK…", pct: 60 });
        const fUp = await uploadToBucket("app-files", user.id, appFile);
        filePath = fUp.path;
      }
      setProgress({ label: asDraft ? "Saving draft…" : "Publishing…", pct: 90 });
      await create({
        data: {
          name: form.name.trim(),
          tagline: form.tagline.trim() || null,
          short_description: form.shortDescription.trim() || null,
          description: form.description.trim() || (asDraft ? "Draft in progress." : ""),
          category: form.category,
          subcategory: form.subcategory.trim() || null,
          platform: form.platform,
          icon_url: logoUp?.url ?? "",
          feature_banner_url: bannerUrl,
          app_url: form.platform === "android" ? null : (form.appUrl.trim() || null),
          website_url: form.websiteUrl.trim() || null,
          privacy_policy_url: form.privacyPolicyUrl.trim() || null,
          developer_name: form.developerName.trim() || null,
          developer_email: form.developerEmail.trim() || null,
          file_path: filePath,
          screenshots: shotUps.map((s) => s.url),
          tags: form.tags,
          languages: form.languages,
          min_android_version: form.minAndroidVersion || null,
          target_android_version: form.targetAndroidVersion || null,
          content_rating: form.contentRating,
          license: form.license,
          price_kobo: form.license === "paid" ? Math.round(Number(form.priceNaira || 0) * 100) : 0,
          is_draft: asDraft,
          package_name: apkInfo?.packageName ?? null,
          version_name: apkInfo?.versionName ?? null,
          version_code: apkInfo?.versionCode ?? null,
          apk_size: apkInfo?.apkSize ?? null,
          permissions: apkInfo?.permissions ?? [],
          release_notes: form.releaseNotes.trim() || null,
        },
      });
      setProgress({ label: "Done", pct: 100 });
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      navigate({ to: "/developer" });
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  function next() { setStep((s) => Math.min(s + 1, STEPS.length - 1)); }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Link to="/developer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Developer Hub
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Publish a new app</h1>
          <p className="text-sm text-muted-foreground">
            A guided submission — save a draft any time.
          </p>
        </div>
        {autosaved && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Save className="h-3 w-3" /> Auto-saved
          </span>
        )}
      </div>

      {/* Stepper */}
      <ol className="mt-6 flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={s.id} className="flex flex-1 min-w-fit items-center gap-1">
              <button
                type="button"
                onClick={() => setStep(i)}
                className={[
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition",
                  active ? "bg-primary text-primary-foreground"
                    : done ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <span className={[
                  "grid h-4 w-4 place-items-center rounded-full text-[10px]",
                  active ? "bg-primary-foreground/20"
                    : done ? "bg-foreground/10"
                    : "border border-border",
                ].join(" ")}>
                  {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border/60" />}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 rounded-3xl border border-border/60 bg-card p-5 sm:p-6">
        {/* BASICS */}
        {STEPS[step].id === "basics" && (
          <section className="space-y-5">
            <SectionHead title="Basic information" subtitle="How your app appears in search and on the store page." />

            <div>
              <Label htmlFor="name">App name <Req /></Label>
              <div className="relative mt-1">
                <Input id="name" required minLength={2} maxLength={80} value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className={nameStatus === "taken" ? "border-destructive pr-24" : "pr-24"} />
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11px]">
                  {nameStatus === "checking" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  {nameStatus === "available" && <span className="text-emerald-600">Available</span>}
                  {nameStatus === "taken" && <span className="text-destructive">Taken</span>}
                </span>
              </div>
              {validation.name && <FieldErr>{validation.name}</FieldErr>}
            </div>

            <div>
              <Label htmlFor="tagline">Tagline (optional)</Label>
              <Input id="tagline" maxLength={160} value={form.tagline}
                onChange={(e) => set("tagline", e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label htmlFor="short">Short description <span className="text-muted-foreground">({form.shortDescription.length}/80)</span></Label>
              <Input id="short" maxLength={80} value={form.shortDescription}
                onChange={(e) => set("shortDescription", e.target.value)}
                placeholder="One sentence pitch." className="mt-1" />
              {validation.shortDescription && <FieldErr>{validation.shortDescription}</FieldErr>}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Full description <Req /></Label>
                <Button type="button" size="sm" variant="ghost" onClick={runAiDescription}
                  disabled={aiBusy === "desc"} className="h-7 gap-1 text-xs">
                  {aiBusy === "desc" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  AI generate
                </Button>
              </div>
              <Textarea id="description" required minLength={10} maxLength={4000} rows={6}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className="mt-1 resize-none" />
              {validation.description && <FieldErr>{validation.description}</FieldErr>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category <Req /></Label>
                <select value={form.category} onChange={(e) => set("category", e.target.value as Category)}
                  className={selectCls}>
                  <option value="app">App</option>
                  <option value="game">Game</option>
                </select>
              </div>
              <div>
                <Label htmlFor="subcategory">Subcategory (optional)</Label>
                <Input id="subcategory" maxLength={60} value={form.subcategory}
                  onChange={(e) => set("subcategory", e.target.value)}
                  placeholder="e.g. Productivity" className="mt-1" />
              </div>
            </div>
          </section>
        )}

        {/* MEDIA */}
        {STEPS[step].id === "media" && (
          <section className="space-y-5">
            <SectionHead title="Icon, banner & screenshots" subtitle="Great visuals lift install rates dramatically." />

            <div>
              <Label>App icon <Req /></Label>
              <div className="mt-2 flex items-center gap-4">
                <label className="grid h-24 w-24 cursor-pointer place-items-center rounded-2xl border border-dashed border-border bg-background text-muted-foreground hover:bg-secondary">
                  {logoPreview
                    ? <img src={logoPreview} alt="icon" className="h-full w-full rounded-2xl object-cover" />
                    : <ImagePlus className="h-6 w-6" />}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0] ?? null)} />
                </label>
                <p className="text-xs text-muted-foreground">512×512 PNG recommended.</p>
              </div>
              {validation.logo && <FieldErr>{validation.logo}</FieldErr>}
            </div>

            <div>
              <Label>Feature banner (optional)</Label>
              <label className="mt-2 flex aspect-[1024/500] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-background text-muted-foreground hover:bg-secondary">
                {bannerPreview
                  ? <img src={bannerPreview} alt="banner" className="h-full w-full object-cover" />
                  : <span className="flex items-center gap-2 text-sm"><ImagePlus className="h-4 w-4" /> Upload 1024×500 banner</span>}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickBanner(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div>
              <Label>Screenshots (up to 8)</Label>
              <input type="file" multiple accept="image/*" className="mt-2 block w-full text-sm"
                onChange={(e) => pickScreenshots(e.target.files)} />
              {screenshotPreviews.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {screenshotPreviews.map((src, i) => (
                    <div key={i} className="relative aspect-[9/16] overflow-hidden rounded-lg border border-border/60">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => removeScreenshot(i)}
                        className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-background/80 text-foreground shadow">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* APK */}
        {STEPS[step].id === "apk" && (
          <section className="space-y-5">
            <SectionHead title="APK & version" subtitle="Upload your APK — we detect metadata automatically." />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Platform</Label>
                <select value={form.platform} onChange={(e) => set("platform", e.target.value as Platform)}
                  className={selectCls}>
                  <option value="android">Android (APK)</option>
                  <option value="web">Web</option>
                  <option value="pwa">PWA</option>
                </select>
              </div>
              {form.platform !== "android" && (
                <div>
                  <Label htmlFor="app_url">App URL</Label>
                  <Input id="app_url" type="url" placeholder="https://yourapp.com" value={form.appUrl}
                    onChange={(e) => set("appUrl", e.target.value)} className="mt-1" />
                </div>
              )}
            </div>

            <div>
              <Label>{form.platform === "android" ? "APK file" : "App file (optional)"}
                {form.platform === "android" && <Req />}
              </Label>
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-3 text-sm text-muted-foreground hover:bg-secondary">
                <UploadCloud className="h-4 w-4" />
                <span className="truncate">{appFile ? appFile.name : "Choose file"}</span>
                <input type="file" className="hidden"
                  accept={form.platform === "android" ? ".apk,application/vnd.android.package-archive" : ".apk,.zip,application/zip,application/vnd.android.package-archive"}
                  onChange={(e) => pickAppFile(e.target.files?.[0] ?? null)} />
              </label>
              {validation.appFile && <FieldErr>{validation.appFile}</FieldErr>}
              {parsing && (
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Reading APK metadata…
                </p>
              )}
              {apkInfo && !parsing && (
                <div className="mt-3 rounded-xl border border-border/60 bg-background/50 p-3 text-xs">
                  <div className="flex items-center gap-1 font-semibold text-foreground">
                    <Package className="h-3.5 w-3.5" /> Detected
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
                    <dt>Package</dt><dd className="truncate text-foreground">{apkInfo.packageName ?? "—"}</dd>
                    <dt>Version</dt><dd className="text-foreground">{apkInfo.versionName ?? "—"} ({apkInfo.versionCode ?? "—"})</dd>
                    <dt>Size</dt><dd className="text-foreground">{formatBytes(apkInfo.apkSize)}</dd>
                    <dt>Permissions</dt><dd className="text-foreground">{apkInfo.permissions.length}</dd>
                  </dl>
                  {apkInfo.permissions.length > 0 && (
                    <details className="mt-2">
                      <summary className="flex cursor-pointer items-center gap-1 text-muted-foreground">
                        <Shield className="h-3 w-3" /> View permissions
                      </summary>
                      <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-[11px] text-muted-foreground">
                        {apkInfo.permissions.map((p) => <li key={p} className="font-mono">{p}</li>)}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* DETAILS */}
        {STEPS[step].id === "details" && (
          <section className="space-y-5">
            <SectionHead title="App details" subtitle="Developer info and Android compatibility." />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="devName">Developer name</Label>
                <Input id="devName" maxLength={120} value={form.developerName}
                  onChange={(e) => set("developerName", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="devEmail">Developer email</Label>
                <Input id="devEmail" type="email" maxLength={255} value={form.developerEmail}
                  onChange={(e) => set("developerEmail", e.target.value)} className="mt-1" />
                {validation.developerEmail && <FieldErr>{validation.developerEmail}</FieldErr>}
              </div>
              <div>
                <Label htmlFor="website">Website (optional)</Label>
                <Input id="website" type="url" value={form.websiteUrl}
                  onChange={(e) => set("websiteUrl", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="privacy">Privacy policy URL (optional)</Label>
                <Input id="privacy" type="url" value={form.privacyPolicyUrl}
                  onChange={(e) => set("privacyPolicyUrl", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Minimum Android</Label>
                <select value={form.minAndroidVersion} onChange={(e) => set("minAndroidVersion", e.target.value)}
                  className={selectCls}>
                  {ANDROID_VERSIONS.map((v) => <option key={v} value={v}>Android {v}</option>)}
                </select>
              </div>
              <div>
                <Label>Target Android</Label>
                <select value={form.targetAndroidVersion} onChange={(e) => set("targetAndroidVersion", e.target.value)}
                  className={selectCls}>
                  {ANDROID_VERSIONS.map((v) => <option key={v} value={v}>Android {v}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label>Languages supported</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => {
                  const active = form.languages.includes(lang);
                  return (
                    <button key={lang} type="button"
                      onClick={() => set("languages", active ? form.languages.filter((l) => l !== lang) : [...form.languages, lang])}
                      className={[
                        "rounded-full border px-3 py-1 text-xs",
                        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >{lang}</button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* STORE INFO */}
        {STEPS[step].id === "store" && (
          <section className="space-y-5">
            <SectionHead title="Store information" subtitle="Release notes, tags, rating and license." />

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="tags">Tags / keywords ({form.tags.length}/12)</Label>
                <Button type="button" size="sm" variant="ghost" onClick={runAiKeywords}
                  disabled={aiBusy === "kw"} className="h-7 gap-1 text-xs">
                  {aiBusy === "kw" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  AI suggest
                </Button>
              </div>
              <div className="mt-1 flex gap-2">
                <Input id="tags" value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder="Type a tag and press Enter" />
                <Button type="button" variant="outline" onClick={addTag}>Add</Button>
              </div>
              {form.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {t}
                      <button type="button" onClick={() => set("tags", form.tags.filter((x) => x !== t))}
                        className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notes">What's new (release notes)</Label>
                <Button type="button" size="sm" variant="ghost" onClick={runAiReleaseNotes}
                  disabled={aiBusy === "notes"} className="h-7 gap-1 text-xs">
                  {aiBusy === "notes" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  AI generate
                </Button>
              </div>
              <Textarea id="notes" rows={5} maxLength={2000} value={form.releaseNotes}
                onChange={(e) => set("releaseNotes", e.target.value)}
                placeholder="Initial release — welcome!" className="mt-1 resize-none" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Content rating</Label>
                <select value={form.contentRating} onChange={(e) => set("contentRating", e.target.value as Rating)}
                  className={selectCls}>
                  <option value="everyone">Everyone</option>
                  <option value="teen">Teen</option>
                  <option value="mature">Mature</option>
                </select>
              </div>
              <div>
                <Label>License</Label>
                <select value={form.license} onChange={(e) => set("license", e.target.value as License)}
                  className={selectCls}>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              {form.license === "paid" && (
                <div>
                  <Label htmlFor="price">Price (₦)</Label>
                  <Input id="price" type="number" min={0} step="0.01" value={form.priceNaira}
                    onChange={(e) => set("priceNaira", e.target.value)} className="mt-1" />
                  {validation.price && <FieldErr>{validation.price}</FieldErr>}
                </div>
              )}
            </div>

            {apkInfo && apkInfo.permissions.length > 0 && (
              <div>
                <Label>Permissions detected from APK</Label>
                <div className="mt-2 flex flex-wrap gap-1.5 rounded-xl border border-border/60 bg-background/50 p-3">
                  {apkInfo.permissions.slice(0, 40).map((p) => (
                    <span key={p} className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                      {p.replace("android.permission.", "")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* PREVIEW */}
        {STEPS[step].id === "preview" && (
          <section className="space-y-5">
            <SectionHead title="Preview your listing" subtitle="This is how users will see your app." />
            <div className="overflow-hidden rounded-2xl border border-border/60">
              {bannerPreview && (
                <div className="aspect-[1024/500] w-full overflow-hidden">
                  <img src={bannerPreview} alt="banner" className="h-full w-full object-cover" />
                </div>
              )}
              <div className="flex gap-4 p-4">
                {logoPreview && (
                  <img src={logoPreview} alt="icon" className="h-20 w-20 rounded-2xl object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg font-bold truncate">{form.name || "App name"}</h3>
                  <p className="text-xs text-muted-foreground truncate">{form.developerName || "Developer"}</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{form.shortDescription || form.tagline}</p>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                    <span className="rounded bg-secondary px-1.5 py-0.5">{form.category}</span>
                    {form.contentRating && <span className="rounded bg-secondary px-1.5 py-0.5">{form.contentRating}</span>}
                    <span className="rounded bg-secondary px-1.5 py-0.5">{form.license === "paid" ? `₦${form.priceNaira || 0}` : "Free"}</span>
                    {apkInfo?.apkSize ? <span className="rounded bg-secondary px-1.5 py-0.5">{formatBytes(apkInfo.apkSize)}</span> : null}
                  </div>
                </div>
              </div>
              {screenshotPreviews.length > 0 && (
                <div className="flex gap-2 overflow-x-auto border-t border-border/60 p-3">
                  {screenshotPreviews.map((src, i) => (
                    <img key={i} src={src} alt="" className="h-40 w-auto rounded-lg object-cover" />
                  ))}
                </div>
              )}
              {form.description && (
                <div className="border-t border-border/60 p-4 text-sm whitespace-pre-wrap">
                  {form.description}
                </div>
              )}
              {form.releaseNotes && (
                <div className="border-t border-border/60 p-4 text-sm">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">What's new</p>
                  <p className="whitespace-pre-wrap text-sm">{form.releaseNotes}</p>
                </div>
              )}
            </div>

            {Object.keys(validation).length > 0 && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <p className="font-semibold">Please fix these before publishing:</p>
                <ul className="mt-1 list-disc pl-5">
                  {Object.entries(validation).map(([k, v]) => <li key={k}>{v}</li>)}
                </ul>
              </div>
            )}
          </section>
        )}

        {progress && (
          <div className="mt-5 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{progress.label}</span><span>{progress.pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} />
            </div>
          </div>
        )}

        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}

        {/* Nav */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" onClick={back} disabled={step === 0} className="rounded-full">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => submit(true)} disabled={busy}
              className="rounded-full">
              <Save className="mr-1 h-4 w-4" /> Save draft
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={next} disabled={!stepValid} className="rounded-full">
                Next <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={() => submit(false)}
                disabled={busy || Object.keys(validation).length > 0}
                className="rounded-full">
                {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publishing…</> : "Publish"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const selectCls =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </header>
  );
}
function Req() { return <span className="text-destructive"> *</span>; }
function FieldErr({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-destructive">{children}</p>;
}
