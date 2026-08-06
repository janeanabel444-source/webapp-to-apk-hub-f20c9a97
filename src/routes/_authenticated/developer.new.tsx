import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, HelpCircle, ImagePlus, Loader2,
  Package, Rocket, Sparkles, UploadCloud, X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { uploadToBucket } from "@/lib/upload";
import { createDeveloperApp, checkAppNameAvailable } from "@/lib/developer.functions";
import { generateAppDescription, generateAppKeywords, generateListingSuggestions, type ListingSuggestions } from "@/lib/app-listing-ai.functions";
import { checkPackageVersion } from "@/lib/developer.functions";
import { AiSuggestionCard, AiChipSuggestion } from "@/components/AiSuggestionCard";
import { parseApkFileSafe, formatBytes, apiLevelToAndroidVersion, type ParsedApk } from "@/lib/apk-parser";
import {
  PLATFORMS, RELEASE_CHANNELS, getPlatform,
  HYBRID_FRAMEWORKS, GAME_CATEGORIES, GAME_TYPES, GAME_ENGINES, GAME_FLAGS, AGE_RATINGS,
  type PlatformId, type ReleaseChannel, type IntegrationMethod,
} from "@/lib/platforms";


export const Route = createFileRoute("/_authenticated/developer/new")({
  head: () => ({
    meta: [
      { title: "Publish Your Application — Niza Developer Hub" },
      { name: "description", content: "A guided, step-by-step publishing wizard for Progressive Web Apps, web apps, Android APKs and hybrid applications on Niza App Store." },
      { property: "og:title", content: "Publish Your Application — Niza Developer Hub" },
      { property: "og:description", content: "Publish your application on Niza App Store with a guided wizard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewAppPage,
});

type Category = "app" | "game";

interface DraftState {
  contentType: Category;
  platform: PlatformId;
  hybridFramework: string;
  integrationMethod: IntegrationMethod | "";
  releaseChannel: ReleaseChannel;
  name: string;
  shortDescription: string;
  description: string;
  category: Category;
  gameCategory: string;
  gameTypes: string[];
  gameEngine: string;
  gameFlags: Record<string, boolean>;
  contentRating: string;
  tags: string[];
  appUrl: string;
  minAndroidVersion: string;
  targetAndroidVersion: string;
  version: string;
  releaseNotes: string;
  privacyPolicyUrl: string;
  privacyPolicySource: "url" | "detected" | "skipped" | "";
  developerName: string;
  developerEmail: string;
  websiteUrl: string;
}

/** Applications and games keep completely separate, isolated drafts. */
const LEGACY_DRAFT_KEY = "niza.developer.wizard.draft.v2";
const draftKey = (t: Category) => `niza.developer.wizard.draft.v3.${t}`;
const ANDROID_VERSIONS = ["5.0", "6.0", "7.0", "8.0", "9.0", "10", "11", "12", "13", "14", "15"];

const initialDraft: DraftState = {
  contentType: "app",
  platform: "android",
  hybridFramework: "",
  integrationMethod: "",
  releaseChannel: "public",
  name: "",
  shortDescription: "",
  description: "",
  category: "app",
  gameCategory: "",
  gameTypes: [],
  gameEngine: "",
  gameFlags: {},
  contentRating: "everyone",
  tags: [],
  appUrl: "",
  minAndroidVersion: "7.0",
  targetAndroidVersion: "14",
  version: "1.0.0",
  releaseNotes: "Initial release",
  privacyPolicyUrl: "",
  privacyPolicySource: "",
  developerName: "",
  developerEmail: "",
  websiteUrl: "",
};


const HELP: Record<string, { title: string; body: string[] }> = {
  uploadCategory: {
    title: "Application or game?",
    body: [
      "Niza keeps applications and games apart — they have different store pages, categories and questions.",
      "Choose Application for tools, utilities, business and lifestyle software.",
      "Choose Game for anything played for entertainment; you'll be asked about genre, players and game features.",
    ],
  },
  gameCategory: {
    title: "Game genre",
    body: [
      "Pick the genre players would look under when searching for your game.",
      "Best practice: choose the closest match rather than the broadest one — discovery works better.",
    ],
  },
  gameType: {
    title: "How your game is played",
    body: [
      "Select every mode that applies — single player, multiplayer, online, offline. A game can be more than one.",
      "This shows on your store page so players know what to expect before installing.",
    ],
  },
  gameFlags: {
    title: "Game features and disclosures",
    body: [
      "These disclosures appear on your store page and feed Niza's automated review.",
      "Be accurate: undisclosed ads, purchases or chat features can hold your release for manual review.",
    ],
  },
  framework: {
    title: "Hybrid framework",
    body: [
      "Tell us which framework your hybrid package was built with so Niza can check the right things.",
      "Your APK is still required — Niza never converts a website into an Android application.",
    ],
  },
  platform: {
    title: "Choosing an application type",
    body: [
      "Niza distributes installable Android packages. Every application type here requires an APK you have already built and signed.",
      "Niza does not convert websites into Android applications. If you only have a website, build a PWA APK first, then upload it.",
      "Common mistake: expecting to publish a hosted URL — hosted-only publishing is not supported.",
    ],
  },

  integration: {
    title: "SDK vs link integration",
    body: [
      "Hybrid applications can talk to Niza through the Niza Services SDK, through a Niza-generated link, or through both.",
      "SDK integration unlocks in-app features such as native install and update handling.",
      "Link integration is the fastest way to publish — Niza generates the links your app needs.",
      "If your app supports both, choose Both; you are never forced to pick one.",
    ],
  },
  name: {
    title: "Your application name",
    body: [
      "This is the name users see everywhere in Niza — search, categories and your store page.",
      "Best practice: keep it short, memorable and free of keyword stuffing.",
      "Common mistake: adding 'free', 'best' or version numbers to the name.",
      "You can't publish two applications with the same name under one developer account.",
    ],
  },
  short: {
    title: "Short description",
    body: [
      "The one-line summary shown in listings and search results — up to 80 characters.",
      "Best practice: describe what the app does, not how great it is.",
      "Common mistake: repeating the app name instead of explaining the value.",
    ],
  },
  description: {
    title: "Full description",
    body: [
      "The full story of your app on its store page. Users read this before installing.",
      "Best practice: open with a short hook, then list key features as bullets.",
      "Press Enhance to let the AI assistant draft or improve it — you always keep the final say.",
    ],
  },
  category: {
    title: "Category & tags",
    body: [
      "Categories and tags power discovery — browsing, filters and search all depend on them.",
      "Best practice: pick the single most accurate category and 5–10 relevant tags.",
      "Common mistake: adding unrelated popular tags; this hurts ranking and can be reported.",
    ],
  },
  icon: {
    title: "Application icon",
    body: [
      "The icon is mandatory — it represents your app across the entire store.",
      "Best practice: a square PNG at 512×512, simple, high contrast, no small text.",
      "Common mistake: uploading a screenshot or a logo with lots of white space.",
    ],
  },
  media: {
    title: "Screenshots & promotional image",
    body: [
      "Screenshots are the single biggest driver of installs. Up to 8 are supported.",
      "Best practice: show real screens in order of importance; portrait works best on phones.",
      "The promotional image is the wide banner used on featured placements — optional but recommended.",
    ],
  },
  apk: {
    title: "Uploading your APK",
    body: [
      "Upload the already-built, signed APK. Niza reads the package name, version, size and permissions automatically.",
      "Every binary is scanned for malware before it can be published.",
      "Common mistake: uploading an .aab bundle or a .zip — only .apk files are accepted.",
    ],
  },
  url: {
    title: "Application URL",
    body: [
      "The hosted address users are sent to. It must be a public HTTPS URL.",
      "For a PWA this should be the installable start URL that serves your manifest.",
      "Common mistake: pointing at a staging URL or a page behind a login.",
    ],
  },
  android: {
    title: "Android compatibility",
    body: [
      "Minimum Android version determines who can install your app; target version tells Android which behaviours you support.",
      "Best practice: target the newest version you have tested against.",
    ],
  },
  version: {
    title: "Version & release notes",
    body: [
      "Versions must look like 1.0.0. Later updates must use a higher number.",
      "Release notes explain what changed — users see them on the store page and in update notifications.",
    ],
  },
  privacy: {
    title: "Privacy policy",
    body: [
      "If your app collects any personal data, a privacy policy URL is required by most platforms and expected by users.",
      "Best practice: host it publicly on your own domain and keep it reachable without a login.",
    ],
  },
  contact: {
    title: "Contact information",
    body: [
      "Users and Niza reviewers use this to reach you about your listing.",
      "Your email is used for review outcomes and support requests; it is not shown publicly.",
    ],
  },
  release: {
    title: "Release type",
    body: [
      "A Development build stays out of the marketplace and is reachable only through a private testing link you share.",
      "A Public release is visible, searchable and downloadable by everyone.",
      "You can switch a development build to a public release later — no new listing required.",
    ],
  },
  review: {
    title: "Final review",
    body: [
      "Check everything before submitting. Use Back and Edit to change any answer — nothing is lost.",
      "After submission your app goes through automated validation and review before it goes live.",
    ],
  },
};

function NewAppPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const create = useServerFn(createDeveloperApp);
  const checkName = useServerFn(checkAppNameAvailable);
  const aiDescribe = useServerFn(generateAppDescription);
  const aiKeywords = useServerFn(generateAppKeywords);

  const [phase, setPhase] = useState<"intro" | "wizard" | "done">("intro");
  const [form, setForm] = useState<DraftState>(initialDraft);
  const [stepIndex, setStepIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [showHelp, setShowHelp] = useState(false);

  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [shotPreviews, setShotPreviews] = useState<string[]>([]);
  const [appFile, setAppFile] = useState<File | null>(null);
  const [apkInfo, setApkInfo] = useState<ParsedApk | null>(null);
  const [parsing, setParsing] = useState(false);
  const [apkError, setApkError] = useState<string | null>(null);
  const [versionWarning, setVersionWarning] = useState<string | null>(null);
  /** Privacy policy address found inside the uploaded package, if any. */
  const [detectedPrivacyUrl, setDetectedPrivacyUrl] = useState<string | null>(null);


  // ---- AI Upload Assistant ----
  const aiAssist = useServerFn(generateListingSuggestions);
  const checkVersion = useServerFn(checkPackageVersion);
  const [suggestions, setSuggestions] = useState<ListingSuggestions | null>(null);
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistError, setAssistError] = useState<string | null>(null);
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  /** Short description the approved content was generated from. */
  const [approvedFor, setApprovedFor] = useState<string | null>(null);
  const [staleDismissed, setStaleDismissed] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);


  const [tagInput, setTagInput] = useState("");
  const [nameStatus, setNameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [aiBusy, setAiBusy] = useState<"desc" | "kw" | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [autosaved, setAutosaved] = useState<Date | null>(null);
  const [result, setResult] = useState<{ id: string; slug: string; shareToken: string; dev: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const spec = getPlatform(form.platform);

  const set = useCallback(<K extends keyof DraftState>(k: K, v: DraftState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  // Restore draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setForm({ ...initialDraft, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);

  // Autosave every answer
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
        setAutosaved(new Date());
      } catch { /* ignore */ }
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [form]);

  // Duplicate name check
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

  // ---- Dynamic step list: category first, then the path for that category ----
  const isGame = form.contentType === "game";
  const steps = useMemo(() => {
    const s: string[] = ["uploadCategory"];
    if (isGame) {
      s.push("gameCategory", "gameType");
    } else {
      s.push("platform");
      if (form.platform === "hybrid") s.push("framework");
    }
    s.push("name", "short", "description", "category", "icon", "media", "apk");
    if (isGame) s.push("gameFlags");
    s.push("android", "version", "privacy", "contact");
    if (!isGame && spec.supportsSdk && spec.supportsLink) s.push("integration");
    s.push("release", "review");
    return s;
  }, [isGame, form.platform, spec]);


  // Keep the pointer in range if earlier answers removed later steps.
  useEffect(() => {
    setStepIndex((i) => Math.min(i, steps.length - 1));
  }, [steps.length]);

  const stepId = steps[stepIndex] ?? "uploadCategory";
  const help = HELP[stepId];


  function pickLogo(f: File | null) {
    setLogo(f);
    setLogoPreview(f ? URL.createObjectURL(f) : null);
  }
  function pickBanner(f: File | null) {
    setBanner(f);
    setBannerPreview(f ? URL.createObjectURL(f) : null);
  }
  function pickShots(files: FileList | null) {
    const arr = Array.from(files ?? []).slice(0, 8);
    setScreenshots(arr);
    setShotPreviews(arr.map((f) => URL.createObjectURL(f)));
  }
  function removeShot(i: number) {
    const next = screenshots.filter((_, idx) => idx !== i);
    setScreenshots(next);
    setShotPreviews(next.map((f) => URL.createObjectURL(f)));
  }
  async function pickAppFile(f: File | null) {
    setAppFile(f);
    setApkInfo(null);
    setApkError(null);
    setVersionWarning(null);
    if (!f) return;
    setParsing(true);
    // Never leaves the developer stuck: parseApkFileSafe always settles.
    const { info, error } = await parseApkFileSafe(f);
    setApkInfo(info);
    setApkError(error);
    setParsing(false);

    if (info.versionName) set("version", info.versionName);
    if (info.appName && !form.name.trim()) set("name", info.appName);
    const min = apiLevelToAndroidVersion(info.minSdk);
    if (min && ANDROID_VERSIONS.includes(min)) set("minAndroidVersion", min);
    const target = apiLevelToAndroidVersion(info.targetSdk);
    if (target && ANDROID_VERSIONS.includes(target)) set("targetAndroidVersion", target);

    // Automatic version comparison against anything already on Niza.
    if (info.packageName) {
      try {
        const res: any = await checkVersion({
          data: {
            packageName: info.packageName,
            versionName: info.versionName ?? null,
            versionCode: info.versionCode ?? null,
          },
        });
        setVersionWarning(res?.warning ?? null);
      } catch { /* non-blocking */ }
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
    if (!form.name.trim()) { setErr("Add an application name first."); return; }
    setAiBusy("desc");
    setErr(null);
    try {
      const res = await aiDescribe({
        data: {
          name: form.name,
          category: form.category,
          tagline: form.shortDescription || null,
          hint: form.description || null,
        },
      });
      set("description", res.text);
    } catch (e: any) { setErr(e?.message ?? "The AI assistant is unavailable right now."); }
    finally { setAiBusy(null); }
  }
  async function runAiKeywords() {
    if (!form.name.trim()) { setErr("Add an application name first."); return; }
    setAiBusy("kw");
    try {
      const res = await aiKeywords({ data: { name: form.name, category: form.category, description: form.description || null } });
      set("tags", Array.from(new Set([...form.tags, ...res.tags])).slice(0, 12));
    } catch (e: any) { setErr(e?.message ?? "The AI assistant is unavailable right now."); }
    finally { setAiBusy(null); }
  }

  /**
   * AI Upload Assistant: turns the app name + one-line description into a full
   * draft listing the developer can review, edit, approve or regenerate.
   */
  async function runAssistant() {
    if (!form.name.trim() || !form.shortDescription.trim()) {
      setAssistError("Add an application name and a one-line description first.");
      return;
    }
    setAssistBusy(true);
    setAssistError(null);
    try {
      const res = (await aiAssist({
        data: {
          name: form.name.trim(),
          shortDescription: form.shortDescription.trim(),
          platform: form.platform,
          category: form.category,
        },
      })) as ListingSuggestions;
      setSuggestions(res);
      setApproved({});
      setApprovedFor(form.shortDescription.trim());
      setStaleDismissed(false);
    } catch (e: any) {
      setAssistError(e?.message ?? "The AI assistant is unavailable right now.");
    } finally {
      setAssistBusy(false);
    }
  }

  /** Approved AI content no longer matches the short description it came from. */
  const suggestionsStale =
    !!suggestions &&
    !staleDismissed &&
    approvedFor !== null &&
    approvedFor !== form.shortDescription.trim();

  function approve(key: string, apply: () => void) {
    apply();
    setApproved((p) => ({ ...p, [key]: true }));
  }


  const emailOk = !form.developerEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.developerEmail);
  const urlOk = /^https?:\/\/.+\..+/.test(form.appUrl.trim());

  const stepValid = useMemo(() => {
    switch (stepId) {
      case "uploadCategory": return !!form.contentType;
      case "platform": return spec.enabled;
      case "framework": return !!form.hybridFramework;
      case "gameCategory": return !!form.gameCategory;
      case "gameType": return form.gameTypes.length > 0;
      case "gameFlags": return true;
      case "integration": return !spec.supportsSdk || !spec.supportsLink || form.integrationMethod !== "";
      case "name": return form.name.trim().length >= 2 && nameStatus !== "taken" && nameStatus !== "checking";
      case "short": return form.shortDescription.trim().length > 0 && form.shortDescription.length <= 80;
      case "description": return form.description.trim().length >= 10;
      case "category": return !!form.category;
      case "icon": return !!logo;
      case "media": return true;
      // Niza distributes installable packages only — an APK is always required.
      case "apk": return !!appFile && !parsing;
      case "android": return true;
      case "version": return /^\d+(\.\d+){0,3}$/.test(form.version.trim()) && form.releaseNotes.trim().length >= 3;
      // Skip is only allowed when the URL field is empty.
      case "privacy":
        return form.privacyPolicyUrl.trim()
          ? /^https?:\/\/.+\..+/.test(form.privacyPolicyUrl.trim())
          : form.privacyPolicySource === "skipped" || form.privacyPolicySource === "detected";
      case "contact": return emailOk;
      case "release": return !!form.releaseChannel;
      case "review": return true;
      default: return true;
    }
  }, [stepId, spec, form, nameStatus, logo, appFile, parsing, emailOk]);


  function next() {
    if (!stepValid) return;
    setDir(1);
    setShowHelp(false);
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function back() {
    setDir(-1);
    setShowHelp(false);
    setStepIndex((i) => Math.max(i - 1, 0));
  }
  function goTo(id: string) {
    const i = steps.indexOf(id);
    if (i >= 0) { setDir(-1); setShowHelp(false); setStepIndex(i); }
  }

  async function submit() {
    setErr(null);
    if (!user || !logo) { setErr("An application icon is required."); return; }
    setBusy(true);
    try {
      setProgress({ label: "Uploading icon…", pct: 10 });
      const logoUp = await uploadToBucket("app-logos", user.id, logo);
      let bannerUrl: string | null = null;
      if (banner) {
        setProgress({ label: "Uploading promotional image…", pct: 25 });
        bannerUrl = (await uploadToBucket("app-screenshots", user.id, banner)).url;
      }
      setProgress({ label: "Uploading screenshots…", pct: 40 });
      const shots = await Promise.all(screenshots.map((f) => uploadToBucket("app-screenshots", user.id, f)));
      let filePath: string | null = null;
      if (appFile) {
        setProgress({ label: "Uploading application file…", pct: 65 });
        filePath = (await uploadToBucket("app-files", user.id, appFile)).path;
      }
      setProgress({ label: "Running security checks & publishing…", pct: 88 });
      const row: any = await create({
        data: {
          name: form.name.trim(),
          short_description: form.shortDescription.trim() || null,
          description: form.description.trim(),
          category: form.category,
          platform: form.platform,
          integration_method: (form.integrationMethod || null) as any,
          release_channel: form.releaseChannel,
          content_type: form.contentType,
          game_category: isGame ? form.gameCategory || null : null,
          game_type: isGame ? form.gameTypes[0] ?? null : null,
          game_types: isGame ? form.gameTypes : [],
          game_engine: isGame ? form.gameEngine || null : form.hybridFramework || null,
          contains_ads: !!form.gameFlags["contains_ads"],
          has_iap: !!form.gameFlags["has_iap"],
          is_multiplayer: !!form.gameFlags["is_multiplayer"] || (isGame && form.gameTypes.includes("multiplayer")),
          requires_account: !!form.gameFlags["requires_account"],
          has_chat: !!form.gameFlags["has_chat"],
          online_features: !!form.gameFlags["online_features"] || (isGame && form.gameTypes.includes("online")),
          offline_mode: !!form.gameFlags["offline_mode"] || (isGame && form.gameTypes.includes("offline")),
          controller_support: !!form.gameFlags["controller_support"],
          cloud_save: !!form.gameFlags["cloud_save"],
          privacy_policy_source: (form.privacyPolicySource || null) as any,
          detected_privacy_url: detectedPrivacyUrl,
          content_rating: form.contentRating || null,
          icon_url: logoUp.url,
          feature_banner_url: bannerUrl,
          app_url: null,
          website_url: form.websiteUrl.trim() || null,
          privacy_policy_url: form.privacyPolicyUrl.trim() || null,
          developer_name: form.developerName.trim() || null,
          developer_email: form.developerEmail.trim() || null,
          file_path: filePath,
          screenshots: shots.map((s) => s.url),
          tags: form.tags,
          languages: ["English"],
          min_android_version: form.minAndroidVersion,
          target_android_version: form.targetAndroidVersion,

          license: "free",
          price_kobo: 0,
          is_draft: false,
          package_name: apkInfo?.packageName ?? null,
          version_name: form.version.trim(),
          version_code: apkInfo?.versionCode ?? null,
          apk_size: apkInfo?.apkSize ?? null,
          permissions: apkInfo?.permissions ?? [],
          release_notes: form.releaseNotes.trim(),
        },
      });
      localStorage.removeItem(DRAFT_KEY);
      setResult({
        id: row.id,
        slug: row.slug,
        shareToken: row.share_token,
        dev: form.releaseChannel === "development",
      });
      setPhase("done");
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong while publishing.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  // ---------------- Intro ----------------
  if (phase === "intro") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="wizard-forward rounded-3xl border border-border/60 bg-card p-6 sm:p-9">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Rocket className="h-6 w-6" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold sm:text-3xl">Publish Your Application</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Welcome to Niza App Store. This publishing wizard will guide you through every step
            required to publish your application.
          </p>
          <p className="mt-5 text-sm font-medium">You will provide:</p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {["Application information", "Application type", "Images and media", "Store listing details", "Privacy information", "Release settings", "Final review"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-primary" /> {t}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button className="rounded-full" onClick={() => setPhase("wizard")}>
              Continue <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/developer">Cancel</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Success ----------------
  if (phase === "done" && result) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const shareUrl = `${origin}/testing/${result.shareToken}`;
    const links: { label: string; url: string; hint: string }[] = result.dev
      ? [{ label: "Private testing link", url: shareUrl, hint: "Only people with this link can install the build." }]
      : [
          { label: "Public store page", url: `${origin}/app/${result.slug}`, hint: "Your app's listing on Niza." },
          { label: "Download link", url: `${origin}/app/${result.slug}#install`, hint: "Opens the listing with the install button in view." },
          { label: "Review link", url: `${origin}/app/${result.slug}#reviews`, hint: "Ask players to rate and review here." },
          { label: "Share link", url: `${origin}/app/${result.slug}?ref=share`, hint: "Use in your own promotion." },
          { label: "Private testing link", url: shareUrl, hint: "Still works for your testers." },
        ];
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="wizard-forward rounded-3xl border border-border/60 bg-card p-6 text-center sm:p-9">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold">
            {result.dev ? "Development build created" : "Submitted for review"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {result.dev
              ? "Your build is private. Share the testing link below with your testers — it will not appear in search or categories."
              : "Your application has been submitted. It will appear across Niza once it clears review."}
          </p>

          <div className="mt-6 space-y-2 text-left">
            <p className="text-xs font-medium text-muted-foreground">Your links — copy and verify each one</p>
            {links.map((l) => (
              <div key={l.label} className="rounded-2xl border border-border/60 bg-secondary/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium">{l.label}</p>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 rounded-full px-2"
                      onClick={() => {
                        navigator.clipboard?.writeText(l.url);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1800);
                      }}
                      aria-label={`Copy ${l.label}`}
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <a href={l.url} target="_blank" rel="noreferrer" className="rounded-full p-1.5 text-muted-foreground hover:text-foreground" aria-label={`Open ${l.label}`}>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
                <code className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">{l.url}</code>
                <p className="mt-0.5 text-[11px] text-muted-foreground/80">{l.hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button className="rounded-full" onClick={() => navigate({ to: "/developer/$appId", params: { appId: result.id } })}>
              View app details
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => navigate({ to: "/developer" })}>
              Developer Hub
            </Button>
            {!result.dev && (
              <Button asChild variant="ghost" className="rounded-full">
                <Link to="/app/$slug" params={{ slug: result.slug }}>View store page</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Wizard ----------------
  const pct = Math.round(((stepIndex + 1) / steps.length) * 100);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <UploadCloud className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            Step {stepIndex + 1} of {steps.length}
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {help && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            aria-label="Help"
            onClick={() => setShowHelp((v) => !v)}
          >
            <HelpCircle className="h-4.5 w-4.5" />
          </Button>
        )}
      </div>

      {showHelp && help && (
        <div className="wizard-forward mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <p className="text-sm font-semibold">{help.title}</p>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            {help.body.map((b) => <li key={b}>• {b}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-6 overflow-hidden">
        <div key={stepId} className={dir === 1 ? "wizard-forward" : "wizard-back"}>
          {renderStep()}
        </div>
      </div>

      {err && (
        <p className="mt-5 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{err}</p>
      )}

      {progress && (
        <div className="mt-5">
          <p className="text-xs text-muted-foreground">{progress.label}</p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center gap-3">
        {stepIndex > 0 && (
          <Button variant="outline" className="rounded-full" onClick={back} disabled={busy}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
        )}
        <div className="ml-auto flex items-center gap-3">
          {autosaved && (
            <span className="hidden text-xs text-muted-foreground sm:inline">Saved automatically</span>
          )}
          {stepId === "review" ? (
            <Button className="rounded-full" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Rocket className="mr-1.5 h-4 w-4" />}
              Submit for Review
            </Button>
          ) : (
            <Button className="rounded-full" onClick={next} disabled={!stepValid}>
              Next <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  // ---------------- Step renderer ----------------
  function question(title: string, hint?: string) {
    return (
      <div className="mb-5">
        <h2 className="font-display text-xl font-bold sm:text-2xl">{title}</h2>
        {hint && <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p>}
      </div>
    );
  }

  function renderStep() {
    switch (stepId) {
      case "platform":
        return (
          <div>
            {question("What type of application are you publishing?", "Each type has its own publishing workflow — you'll only be asked what applies.")}
            <div className="space-y-2.5">
              {PLATFORMS.map((p) => {
                const active = form.platform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!p.enabled}
                    onClick={() => { set("platform", p.id); set("integrationMethod", ""); }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      active ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-primary/40"
                    } ${p.enabled ? "" : "cursor-not-allowed opacity-55"}`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{p.label}</p>
                      {!p.enabled && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Coming soon
                        </span>
                      )}
                      {active && <Check className="ml-auto h-4 w-4 text-primary" />}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{p.description}</p>
                    <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                      {p.bullets.map((b) => <li key={b}>• {b}</li>)}
                    </ul>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case "integration":
        return (
          <div>
            {question("How should your hybrid app integrate with Niza?", "Pick one, or both if your application supports both methods.")}
            <div className="space-y-2.5">
              {([
                { id: "sdk", label: "Niza Services SDK", desc: "Integrate natively for install, update and account features." },
                { id: "link", label: "Link-based integration", desc: "Niza generates the links your application needs — nothing to embed." },
                { id: "both", label: "Both methods", desc: "Configure the SDK and use Niza-generated links together." },
              ] as const).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => set("integrationMethod", o.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    form.integrationMethod === o.id ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{o.label}</p>
                    {form.integrationMethod === o.id && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{o.desc}</p>
                </button>
              ))}
            </div>
          </div>
        );

      case "name":
        return (
          <div>
            {question("What is your application name?", "This is the name users will see across Niza App Store.")}
            <Input
              autoFocus
              value={form.name}
              maxLength={80}
              placeholder="e.g. Niza Notes"
              onChange={(e) => set("name", e.target.value)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {nameStatus === "checking" && "Checking availability…"}
              {nameStatus === "available" && "This name is available."}
              {nameStatus === "taken" && <span className="text-destructive">You already have an application with this name.</span>}
            </p>
          </div>
        );

      case "short":
        return (
          <div>
            {question("How would you describe it in one line?", "Shown in search results and listings. Max 80 characters.")}
            <Input
              autoFocus
              value={form.shortDescription}
              maxLength={80}
              placeholder="e.g. Fast, private notes that sync everywhere"
              onChange={(e) => set("shortDescription", e.target.value)}
            />
            <p className="mt-2 text-xs text-muted-foreground">{form.shortDescription.length}/80</p>
          </div>
        );

      case "description":
        return (
          <div>
            {question("Tell users what your application does.", "This is your full store description. The AI assistant can draft the whole listing from your one-line description.")}
            <Textarea
              rows={10}
              value={form.description}
              maxLength={4000}
              placeholder="Describe your app, its main features and who it is for…"
              onChange={(e) => set("description", e.target.value)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={runAiDescription} disabled={aiBusy === "desc"}>
                {aiBusy === "desc" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                Enhance
              </Button>
              <Button type="button" size="sm" className="rounded-full" onClick={runAssistant} disabled={assistBusy}>
                {assistBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                {suggestions ? "Regenerate full listing" : "Generate full listing with AI"}
              </Button>
              <span className="text-xs text-muted-foreground">You always keep the final say on the wording.</span>
            </div>
            {assistError && <p className="mt-3 text-xs text-destructive">{assistError}</p>}

            {suggestionsStale && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                <span className="flex-1">
                  Your one-line description changed since these suggestions were generated. Update them?
                </span>
                <Button type="button" size="sm" className="rounded-full" onClick={runAssistant} disabled={assistBusy}>
                  Update suggestions
                </Button>
                <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => setStaleDismissed(true)}>
                  Keep mine
                </Button>
              </div>
            )}

            {suggestions && (
              <div className="mt-5 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Review each suggestion below. Edit anything you like, then Approve to apply it to your listing.
                  {suggestions.source === "fallback" && " (AI was unavailable, so these are basic starter drafts.)"}
                </p>
                <AiSuggestionCard
                  title="Long store description"
                  value={suggestions.description}
                  rows={10}
                  busy={assistBusy}
                  approved={approved["description"]}
                  onApprove={(t) => approve("description", () => set("description", t))}
                  onRegenerate={runAssistant}
                />
                <AiSuggestionCard
                  title="Release notes"
                  value={suggestions.releaseNotes}
                  rows={4}
                  busy={assistBusy}
                  approved={approved["notes"]}
                  onApprove={(t) => approve("notes", () => set("releaseNotes", t))}
                  onRegenerate={runAssistant}
                />
                <AiSuggestionCard
                  title="Key features"
                  hint="One per line."
                  value={suggestions.features.join("\n")}
                  rows={4}
                  busy={assistBusy}
                  approved={approved["features"]}
                  onApprove={(t) =>
                    approve("features", () =>
                      set("description", `${form.description.trim()}\n\nKey features:\n${t
                        .split("\n")
                        .filter(Boolean)
                        .map((l) => `• ${l.replace(/^[•\-*]\s*/, "")}`)
                        .join("\n")}`),
                    )
                  }
                  onRegenerate={runAssistant}
                />
                <AiSuggestionCard
                  title="Marketing tagline"
                  value={suggestions.marketing}
                  rows={2}
                  busy={assistBusy}
                  approved={approved["tagline"]}
                  onApprove={(t) => approve("tagline", () => set("shortDescription", t.slice(0, 80)))}
                  onRegenerate={runAssistant}
                />
                <AiChipSuggestion
                  title="Suggested tags & keywords"
                  items={Array.from(new Set([...suggestions.tags, ...suggestions.keywords]))}
                  selected={selectedTags}
                  busy={assistBusy}
                  approved={approved["tags"]}
                  onToggle={(item) =>
                    setSelectedTags((p) => (p.includes(item) ? p.filter((t) => t !== item) : [...p, item]))
                  }
                  onApprove={() =>
                    approve("tags", () => set("tags", Array.from(new Set([...form.tags, ...selectedTags])).slice(0, 12)))
                  }
                  onRegenerate={runAssistant}
                />
                <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4 text-xs">
                  <p className="font-medium">Suggested category</p>
                  <p className="mt-1 text-muted-foreground">
                    Category: <span className="text-foreground">{suggestions.category}</span> · Age rating:{" "}
                    <span className="text-foreground">{suggestions.ageRating}</span>
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3 rounded-full"
                    disabled={approved["meta"]}
                    onClick={() => approve("meta", () => set("category", suggestions.category))}
                  >
                    {approved["meta"] ? "Approved" : "Approve"}
                  </Button>
                </div>

              </div>
            )}
          </div>
        );


      case "category":
        return (
          <div>
            {question("Which category fits best?", "Categories and tags power browsing and search.")}
            <div className="flex gap-2.5">
              {(["app", "game"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("category", c)}
                  className={`flex-1 rounded-2xl border p-4 text-center transition ${
                    form.category === c ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-primary/40"
                  }`}
                >
                  <p className="font-medium">{c === "app" ? "App" : "Game"}</p>
                </button>
              ))}
            </div>
            <Label className="mt-6 block text-sm">Tags</Label>
            <div className="mt-2 flex gap-2">
              <Input
                value={tagInput}
                placeholder="Add a tag and press Enter"
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              />
              <Button type="button" variant="outline" className="rounded-full" onClick={runAiKeywords} disabled={aiBusy === "kw"}>
                {aiBusy === "kw" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </Button>
            </div>
            {form.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {form.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">
                    {t}
                    <button type="button" onClick={() => set("tags", form.tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );

      case "icon":
        return (
          <div>
            {question("Upload your application icon.", "Required. A square PNG at 512×512 works best.")}
            <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-border/70 bg-card p-4">
              {logoPreview ? (
                <img src={logoPreview} alt="Icon preview" className="h-20 w-20 rounded-2xl object-cover" />
              ) : (
                <span className="grid h-20 w-20 place-items-center rounded-2xl bg-secondary text-muted-foreground">
                  <ImagePlus className="h-6 w-6" />
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                {logo ? logo.name : "Choose an image (PNG, JPG or WEBP, max 2MB)"}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        );

      case "media":
        return (
          <div>
            {question("Add screenshots and a promotional image.", "Optional, but screenshots strongly increase installs. Up to 8.")}
            <label className="block cursor-pointer rounded-2xl border border-dashed border-border/70 bg-card p-4 text-sm text-muted-foreground">
              {screenshots.length ? `${screenshots.length} screenshot(s) selected` : "Choose screenshots"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => pickShots(e.target.files)} />
            </label>
            {shotPreviews.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {shotPreviews.map((src, i) => (
                  <div key={src} className="relative shrink-0">
                    <img src={src} alt={`Screenshot ${i + 1}`} className="h-32 rounded-xl object-cover" />
                    <button
                      type="button"
                      onClick={() => removeShot(i)}
                      aria-label="Remove screenshot"
                      className="absolute right-1 top-1 rounded-full bg-background/90 p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="mt-4 block cursor-pointer rounded-2xl border border-dashed border-border/70 bg-card p-4 text-sm text-muted-foreground">
              {banner ? banner.name : "Choose a promotional image (wide banner, optional)"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickBanner(e.target.files?.[0] ?? null)} />
            </label>
            {bannerPreview && <img src={bannerPreview} alt="Promotional banner preview" className="mt-3 w-full rounded-2xl object-cover" />}
          </div>
        );

      case "apk":
        return (
          <div>
            {question(
              spec.requiresApk ? "Upload your Android APK." : "Do you have an APK to upload?",
              spec.requiresApk
                ? "Upload the already-built, signed APK. Niza detects the details automatically."
                : "Optional for hybrid applications — you can publish with a URL instead.",
            )}
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border/70 bg-card p-4 text-sm text-muted-foreground">
              <Package className="h-5 w-5 shrink-0" />
              {appFile ? appFile.name : "Choose an .apk file (max 75MB)"}
              <input type="file" accept=".apk" className="hidden" onChange={(e) => pickAppFile(e.target.files?.[0] ?? null)} />
            </label>
            {parsing && <p className="mt-3 text-xs text-muted-foreground">Reading APK details…</p>}
            {apkError && !parsing && <p className="mt-3 text-xs text-amber-500">{apkError}</p>}
            {versionWarning && !parsing && (
              <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">{versionWarning}</p>
            )}
            {apkInfo && !parsing && (
              <dl className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-secondary/30 p-4 text-xs">
                <div><dt className="text-muted-foreground">App name</dt><dd className="truncate">{apkInfo.appName ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Package</dt><dd className="truncate">{apkInfo.packageName ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Version</dt><dd>{apkInfo.versionName ?? "—"}{apkInfo.versionCode ? ` (${apkInfo.versionCode})` : ""}</dd></div>
                <div><dt className="text-muted-foreground">Size</dt><dd>{formatBytes(apkInfo.apkSize)}</dd></div>
                <div><dt className="text-muted-foreground">Min SDK</dt><dd>{apkInfo.minSdk ? `${apkInfo.minSdk} (Android ${apiLevelToAndroidVersion(apkInfo.minSdk)})` : "—"}</dd></div>
                <div><dt className="text-muted-foreground">Target SDK</dt><dd>{apkInfo.targetSdk ? `${apkInfo.targetSdk} (Android ${apiLevelToAndroidVersion(apkInfo.targetSdk)})` : "—"}</dd></div>
                <div><dt className="text-muted-foreground">Architectures</dt><dd className="truncate">{apkInfo.abis.length ? apkInfo.abis.join(", ") : "Universal"}</dd></div>
                <div><dt className="text-muted-foreground">Signed</dt><dd>{apkInfo.certificate?.schemes?.length ? `Yes (${apkInfo.certificate.schemes.join(", ")})` : "Not detected"}</dd></div>
                <div className="col-span-2"><dt className="text-muted-foreground">Permissions</dt><dd>{apkInfo.permissions.length}</dd></div>
              </dl>
            )}

          </div>
        );

      case "uploadCategory":
        return (
          <div>
            {question("What are you uploading?", "Applications and games are published through different workflows.")}
            <div className="space-y-2.5">
              {([
                { id: "app", label: "Application", desc: "Tools, utilities, business, lifestyle and productivity software." },
                { id: "game", label: "Game", desc: "Anything played for entertainment — you'll be asked about genre and players." },
              ] as const).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { set("contentType", o.id); set("category", o.id); }}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    form.contentType === o.id ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{o.label}</p>
                    {form.contentType === o.id && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{o.desc}</p>
                </button>
              ))}
            </div>
          </div>
        );

      case "framework":
        return (
          <div>
            {question("Which framework is your hybrid package built with?", "An APK is still required — Niza never converts a website into an application.")}
            <div className="grid grid-cols-2 gap-2.5">
              {HYBRID_FRAMEWORKS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => set("hybridFramework", f)}
                  className={`rounded-xl border p-3 text-left text-sm transition ${
                    form.hybridFramework === f ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-primary/40"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        );

      case "gameCategory":
        return (
          <div>
            {question("What genre is your game?", "Players browse and search by genre — pick the closest match.")}
            <div className="grid grid-cols-2 gap-2.5">
              {GAME_CATEGORIES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => set("gameCategory", g)}
                  className={`rounded-xl border p-3 text-left text-sm transition ${
                    form.gameCategory === g ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-primary/40"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        );

      case "gameType":
        return (
          <div>
            {question("How is your game played?", "Select every mode that applies — you can pick more than one.")}
            <div className="space-y-2.5">
              {GAME_TYPES.map((t) => {
                const on = form.gameTypes.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set(
                        "gameTypes",
                        on ? form.gameTypes.filter((x) => x !== t.id) : [...form.gameTypes, t.id],
                      )
                    }
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left text-sm transition ${
                      on ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-primary/40"
                    }`}
                  >
                    <span>
                      <span className="font-medium">{t.label}</span>
                      <span className="block text-xs text-muted-foreground">{t.hint}</span>
                    </span>
                    {on && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
            <Label className="mt-5 block text-sm">Game engine (optional)</Label>
            <select
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              value={form.gameEngine}
              onChange={(e) => set("gameEngine", e.target.value)}
            >
              <option value="">Not specified</option>
              {GAME_ENGINES.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        );

      case "gameFlags":
        return (
          <div>
            {question("Tell players what's inside", "These disclosures show on your store page and feed Niza's automated review.")}
            <div className="space-y-2">
              {GAME_FLAGS.map((f) => {
                const on = !!form.gameFlags[f.id];
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => set("gameFlags", { ...form.gameFlags, [f.id]: !on })}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm transition ${
                      on ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-primary/40"
                    }`}
                  >
                    {f.label}
                    {on && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
            <Label className="mt-5 block text-sm">Age rating</Label>
            <select
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              value={form.contentRating}
              onChange={(e) => set("contentRating", e.target.value)}
            >
              {AGE_RATINGS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        );


      case "android":
        return (
          <div>
            {question("Which Android versions does it support?", "Used to tell users whether their device is compatible.")}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Minimum</Label>
                <select
                  className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  value={form.minAndroidVersion}
                  onChange={(e) => set("minAndroidVersion", e.target.value)}
                >
                  {ANDROID_VERSIONS.map((v) => <option key={v} value={v}>Android {v}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-sm">Target</Label>
                <select
                  className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  value={form.targetAndroidVersion}
                  onChange={(e) => set("targetAndroidVersion", e.target.value)}
                >
                  {ANDROID_VERSIONS.map((v) => <option key={v} value={v}>Android {v}</option>)}
                </select>
              </div>
            </div>
          </div>
        );

      case "version":
        return (
          <div>
            {question("What version are you releasing?", "Use a number like 1.0.0, then tell users what's in it.")}
            <Input value={form.version} placeholder="1.0.0" onChange={(e) => set("version", e.target.value)} />
            {!/^\d+(\.\d+){0,3}$/.test(form.version.trim()) && (
              <p className="mt-2 text-xs text-destructive">Version must look like 1.0.0</p>
            )}
            <Label className="mt-5 block text-sm">Version notes</Label>
            <Textarea
              rows={5}
              className="mt-1.5"
              value={form.releaseNotes}
              onChange={(e) => set("releaseNotes", e.target.value)}
              placeholder="What's new in this version?"
            />
          </div>
        );

      case "privacy":
        return (
          <div>
            {question("Where can users read your privacy policy?", "Required if your application collects any personal data.")}
            <Input
              inputMode="url"
              value={form.privacyPolicyUrl}
              placeholder="https://yourapp.com/privacy"
              onChange={(e) => { set("privacyPolicyUrl", e.target.value); set("privacyPolicySource", e.target.value.trim() ? "url" : ""); }}
            />
            {detectedPrivacyUrl && (
              <p className="mt-2 text-xs text-muted-foreground">
                A privacy policy was detected inside your package: <span className="text-foreground">{detectedPrivacyUrl}</span>
              </p>
            )}
            {/* Skip is only offered while the URL field is empty. */}
            {!form.privacyPolicyUrl.trim() && (
              <button
                type="button"
                onClick={() => set("privacyPolicySource", form.privacyPolicySource === "skipped" ? "" : "skipped")}
                className={`mt-3 rounded-full border px-4 py-2 text-xs transition ${
                  form.privacyPolicySource === "skipped" ? "border-primary bg-primary/5 text-primary" : "border-border/60 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {form.privacyPolicySource === "skipped" ? "Skipped — my app collects no personal data" : "Skip — my app collects no personal data"}
              </button>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              If your package requests permissions that can collect personal data, Niza will still require a policy before publishing.
            </p>
          </div>
        );


      case "contact":
        return (
          <div>
            {question("How can users and Niza reach you?", "Your email is used for review outcomes and support — it is not shown publicly.")}
            <Label className="text-sm">Developer or studio name</Label>
            <Input className="mt-1.5" value={form.developerName} onChange={(e) => set("developerName", e.target.value)} placeholder="Niza Labs" />
            <Label className="mt-4 block text-sm">Contact email</Label>
            <Input className="mt-1.5" type="email" value={form.developerEmail} onChange={(e) => set("developerEmail", e.target.value)} placeholder="you@example.com" />
            {!emailOk && <p className="mt-2 text-xs text-destructive">Enter a valid email address.</p>}
            <Label className="mt-4 block text-sm">Website (optional)</Label>
            <Input className="mt-1.5" inputMode="url" value={form.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://yourapp.com" />
          </div>
        );

      case "release":
        return (
          <div>
            {question("How should this release be published?", "You can switch a development build to a public release later.")}
            <div className="space-y-2.5">
              {RELEASE_CHANNELS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => set("releaseChannel", c.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    form.releaseChannel === c.id ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{c.label}</p>
                    {form.releaseChannel === c.id && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                  <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                    {c.bullets.map((b) => <li key={b}>• {b}</li>)}
                  </ul>
                </button>
              ))}
            </div>
          </div>
        );

      case "review":
      default:
        return (
          <div>
            {question("Review everything before submitting.", "Use Back and Edit on any row — nothing you entered is lost.")}
            <div className="rounded-3xl border border-border/60 bg-card p-4">
              <div className="flex items-center gap-3">
                {logoPreview ? (
                  <img src={logoPreview} alt="Application icon" className="h-16 w-16 rounded-2xl object-cover" />
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-secondary text-muted-foreground"><ImagePlus className="h-5 w-5" /></span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold">{form.name || "Untitled"}</p>
                  <p className="truncate text-xs text-muted-foreground">{form.shortDescription}</p>
                </div>
                <Button size="sm" variant="ghost" className="ml-auto rounded-full" onClick={() => goTo("name")}>Edit</Button>
              </div>

              {shotPreviews.length > 0 && (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {shotPreviews.map((s, i) => (
                    <img key={s} src={s} alt={`Screenshot ${i + 1}`} className="h-28 shrink-0 rounded-xl object-cover" />
                  ))}
                </div>
              )}

              <dl className="mt-4 space-y-2 text-sm">
                {[
                  ["Application type", spec.label, "platform"],
                  ...(form.integrationMethod ? [["Integration", form.integrationMethod === "both" ? "SDK + link" : form.integrationMethod === "sdk" ? "Niza Services SDK" : "Link-based", "integration"]] : []),
                  ["Category", form.category === "game" ? "Game" : "App", "category"],
                  ["Tags", form.tags.join(", ") || "—", "category"],
                  ["Version", `${form.version} — ${form.releaseNotes.slice(0, 60)}`, "version"],
                  ...(steps.includes("apk") ? [["APK", appFile ? `${appFile.name} (${formatBytes(apkInfo?.apkSize ?? appFile.size)})` : "None", "apk"]] : []),
                  ...(steps.includes("url") ? [["Application URL", form.appUrl || "—", "url"]] : []),
                  ...(steps.includes("android") ? [["Android", `Min ${form.minAndroidVersion} · Target ${form.targetAndroidVersion}`, "android"]] : []),
                  ["Privacy policy", form.privacyPolicyUrl || "Not provided", "privacy"],
                  ["Contact", [form.developerName, form.developerEmail].filter(Boolean).join(" · ") || "—", "contact"],
                  ["Promotional image", banner ? "Provided" : "None", "media"],
                  ["Release type", form.releaseChannel === "development" ? "Development build (private link)" : "Public release", "release"],
                ].map(([label, value, target]) => (
                  <div key={label as string} className="flex items-start gap-3 border-t border-border/50 pt-2">
                    <dt className="w-32 shrink-0 text-xs text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 flex-1 break-words text-xs">{value as string}</dd>
                    <button type="button" className="text-xs text-primary" onClick={() => goTo(target as string)}>Edit</button>
                  </div>
                ))}
              </dl>

              <div className="mt-4 border-t border-border/50 pt-3">
                <p className="text-xs text-muted-foreground">Full description</p>
                <p className="mt-1 whitespace-pre-wrap text-xs">{form.description}</p>
              </div>
            </div>
          </div>
        );
    }
  }
}
