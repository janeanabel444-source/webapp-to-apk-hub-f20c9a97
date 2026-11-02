import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Trash2, ImagePlus, ChevronUp, ChevronDown, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getMyDeveloperApp, updateDeveloperApp, deleteDeveloperApp } from "@/lib/developer.functions";
import { uploadToBucket } from "@/lib/upload";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/developer/$appId/edit")({
  staticData: { sitemap: false },
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

  // Listing fields — everything except the APK binary is editable here.
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"app" | "game">("app");
  const [subcategory, setSubcategory] = useState("");
  const [gameCategory, setGameCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [appUrl, setAppUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [privacyUrl, setPrivacyUrl] = useState("");
  const [developerName, setDeveloperName] = useState("");
  const [developerEmail, setDeveloperEmail] = useState("");

  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!app) return;
    setName(app.name ?? "");
    setTagline(app.tagline ?? "");
    setShortDescription(app.short_description ?? "");
    setDescription(app.description ?? "");
    setCategory((app.category === "game" ? "game" : "app") as "app" | "game");
    setSubcategory(app.subcategory ?? "");
    setGameCategory(app.game_category ?? "");
    setTags((app.tags as string[] | null) ?? []);
    setIconUrl(app.icon_url ?? null);
    setBannerUrl(app.feature_banner_url ?? null);
    setScreenshots((app.screenshots as string[] | null) ?? []);
    setAppUrl(app.app_url ?? "");
    setWebsiteUrl(app.website_url ?? "");
    setPrivacyUrl(app.privacy_policy_url ?? "");
    setDeveloperName(app.developer_name ?? "");
    setDeveloperEmail(app.developer_email ?? "");
  }, [app]);

  const fullUrl = (v: string) => /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v.trim());

  async function onPickImage(kind: "icon" | "banner", files: FileList | null, onDone: (url: string) => void) {
    const file = files?.[0];
    if (!file) return;
    setErr(null);
    setUploadingMedia(true);
    try {
      const up = await uploadToBucket(kind === "icon" ? "app-logos" : "app-screenshots", app!.id as string, file);
      onDone(up.url);
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function onPickScreenshots(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    setUploadingMedia(true);
    try {
      const ups = await Promise.all(
        Array.from(files).slice(0, 8 - screenshots.length).map((f) => uploadToBucket("app-screenshots", app!.id as string, f)),
      );
      setScreenshots((prev) => [...prev, ...ups.map((u) => u.url)].slice(0, 8));
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally {
      setUploadingMedia(false);
    }
  }

  function moveShot(i: number, dir: -1 | 1) {
    setScreenshots((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function addTag() {
    const t = tagDraft.trim().slice(0, 32);
    if (!t || tags.includes(t) || tags.length >= 20) return;
    setTags([...tags, t]);
    setTagDraft("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    for (const [label, url] of [["App link", appUrl], ["Website", websiteUrl], ["Privacy policy", privacyUrl]] as const) {
      if (url.trim() && !fullUrl(url)) {
        setErr(`${label} must be a full link starting with https://`);
        return;
      }
    }
    if (developerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(developerEmail.trim())) {
      setErr("Developer email doesn't look valid.");
      return;
    }
    setBusy(true);
    try {
      await updateFn({
        data: {
          id: appId,
          name: name.trim(),
          tagline: tagline.trim() || null,
          short_description: shortDescription.trim() || null,
          description: description.trim(),
          category,
          subcategory: subcategory.trim() || null,
          game_category: category === "game" ? gameCategory.trim() || null : null,
          game_types: category === "game" ? ((app?.game_types as string[] | null) ?? []) : [],
          tags,
          icon_url: iconUrl ?? undefined,
          feature_banner_url: bannerUrl ?? undefined,
          screenshots,
          app_url: appUrl.trim() || null,
          website_url: websiteUrl.trim() || null,
          privacy_policy_url: privacyUrl.trim() || null,
          developer_name: developerName.trim() || null,
          developer_email: developerEmail.trim() || null,
        } as any,
      });
      await qc.invalidateQueries({ queryKey: ["developer-apps"] });
      await qc.invalidateQueries({ queryKey: ["developer-app", appId] });
      toast.success("Changes saved");
      navigate({ to: "/developer/$appId", params: { appId } });
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
      <p className="text-sm text-muted-foreground">
        Status: <span className="font-medium">{app.status}</span> · Update the listing below — the APK binary is changed through
        <Link to="/developer/$appId/update" params={{ appId }} className="ml-1 text-foreground underline">release an update</Link>.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-6 rounded-3xl border border-border/60 bg-card p-5">
        {/* ── Icon & banner ── */}
        <section className="space-y-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Promotional imagery</h2>
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <Label>App icon</Label>
              <div className="mt-1 flex items-center gap-2">
                {iconUrl ? (
                  <img src={iconUrl} alt="App icon" className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-xl bg-secondary text-xs text-muted-foreground">None</div>
                )}
                <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-secondary">
                  <ImagePlus className="h-3.5 w-3.5" /> {uploadingMedia ? "Uploading…" : "Change"}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void onPickImage("icon", e.target.files, setIconUrl)}
                  />
                </label>
              </div>
            </div>
          </div>
          <div>
            <Label>Feature banner (promotional image shown on store highlights)</Label>
            <div className="mt-1 flex items-center gap-2">
              {bannerUrl ? (
                <img src={bannerUrl} alt="Feature banner" className="h-24 w-full max-w-sm rounded-xl object-cover" />
              ) : (
                <div className="grid h-24 w-full max-w-sm place-items-center rounded-xl bg-secondary text-xs text-muted-foreground">No banner</div>
              )}
              <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-secondary">
                <ImagePlus className="h-3.5 w-3.5" /> {uploadingMedia ? "Uploading…" : bannerUrl ? "Replace" : "Add banner"}
                <input
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => void onPickImage("banner", e.target.files, setBannerUrl)}
                />
              </label>
              {bannerUrl && (
                <Button type="button" variant="ghost" size="icon" className="rounded-full" aria-label="Remove banner" onClick={() => setBannerUrl(null)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* ── Screenshots ── */}
        <section>
          <Label>Screenshots ({screenshots.length}/8)</Label>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {screenshots.map((url, i) => (
              <div key={url} className="group relative overflow-hidden rounded-xl border border-border/60">
                <img src={url} alt={`Screenshot ${i + 1}`} className="h-32 w-full object-cover" />
                <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-90">
                  <div className="flex gap-0.5">
                    <Button type="button" size="icon" variant="secondary" className="h-6 w-6 rounded-full" disabled={i === 0} onClick={() => moveShot(i, -1)} aria-label="Move earlier">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="secondary" className="h-6 w-6 rounded-full" disabled={i === screenshots.length - 1} onClick={() => moveShot(i, 1)} aria-label="Move later">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="h-6 w-6 rounded-full"
                    onClick={() => setScreenshots(screenshots.filter((s) => s !== url))}
                    aria-label="Remove screenshot"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {screenshots.length < 8 && (
              <label className="grid h-32 cursor-pointer place-items-center rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:bg-secondary">
                <span className="flex flex-col items-center gap-1"><ImagePlus className="h-5 w-5" /> Add screenshots</span>
                <input type="file" className="hidden" multiple accept="image/png,image/jpeg,image/webp" onChange={(e) => void onPickScreenshots(e.target.files)} />
              </label>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Use the arrows to reorder — the first screenshot is shown first on the store page.</p>
        </section>

        {/* ── Listing text ── */}
        <section className="space-y-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Listing details</h2>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="tagline">Tagline</Label>
            <Input id="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} className="mt-1" maxLength={160} />
          </div>
          <div>
            <Label htmlFor="short_description">Short description (shown on cards, max 80)</Label>
            <Input id="short_description" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} className="mt-1" maxLength={80} />
          </div>
          <div>
            <Label htmlFor="description">Full description</Label>
            <Textarea id="description" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 resize-none" maxLength={4000} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Type</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as "app" | "game")}>
                <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="app">Application</SelectItem>
                  <SelectItem value="game">Game</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="subcategory">Subcategory (e.g. Communication, Puzzle)</Label>
              <Input id="subcategory" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className="mt-1" maxLength={60} />
            </div>
            {category === "game" && (
              <div>
                <Label htmlFor="game_category">Game category (e.g. Arcade, Racing)</Label>
                <Input id="game_category" value={gameCategory} onChange={(e) => setGameCategory(e.target.value)} className="mt-1" maxLength={40} />
              </div>
            )}
          </div>
          <div>
            <Label>Tags</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">
                  {t}
                  <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a tag and press Enter"
                maxLength={32}
              />
              <Button type="button" variant="outline" onClick={addTag} disabled={!tagDraft.trim() || tags.length >= 20} className="rounded-full">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>
        </section>

        {/* ── Contact links ── */}
        <section className="space-y-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contact &amp; links</h2>
          <div>
            <Label htmlFor="app_url">App link (opens the app after install)</Label>
            <Input id="app_url" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} className="mt-1" placeholder="https://…" />
          </div>
          <div>
            <Label htmlFor="website_url">Website</Label>
            <Input id="website_url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="mt-1" placeholder="https://…" />
          </div>
          <div>
            <Label htmlFor="privacy_url">Privacy policy</Label>
            <Input id="privacy_url" value={privacyUrl} onChange={(e) => setPrivacyUrl(e.target.value)} className="mt-1" placeholder="https://…" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="dev_name">Developer name</Label>
              <Input id="dev_name" value={developerName} onChange={(e) => setDeveloperName(e.target.value)} className="mt-1" maxLength={120} />
            </div>
            <div>
              <Label htmlFor="dev_email">Contact email</Label>
              <Input id="dev_email" type="email" value={developerEmail} onChange={(e) => setDeveloperEmail(e.target.value)} className="mt-1" />
            </div>
          </div>
        </section>

        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex justify-between gap-2">
          <Button type="button" variant="outline" onClick={onDelete} className="rounded-full text-destructive">
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
          <Button type="submit" disabled={busy || uploadingMedia} className="rounded-full">
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
