import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type App = Tables<"apps">;
export type Review = Tables<"reviews">;

export type Category = "app" | "game" | "ai_video";

export function categoryLabel(c: Category) {
  return c === "app" ? "App" : c === "game" ? "Game" : "AI Video";
}

/** A "demo" app is a seed/placeholder one without a real developer. */
export function isDemoApp(app: Pick<App, "developer_id">) {
  return !app.developer_id;
}

// Generate a colorful gradient for an app icon based on its slug
export function iconGradient(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue1 = h % 360;
  const hue2 = (hue1 + 60) % 360;
  return `linear-gradient(135deg, oklch(0.65 0.18 ${hue1}), oklch(0.55 0.2 ${hue2}))`;
}

export function iconInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export async function fetchApps(category?: Category, search?: string, language?: string) {
  // Only show approved, live, published apps publicly.
  let q = supabase
    .from("apps")
    .select("*")
    .eq("is_published", true)
    .eq("status", "live")
    .order("install_count", { ascending: false });
  if (category) q = q.eq("category", category);
  if (language) q = q.contains("languages", [language]);
  if (search && search.trim()) {
    const s = search.trim();
    // Match by name, tagline, short description, or tag.
    q = q.or(
      `name.ilike.%${s}%,tagline.ilike.%${s}%,short_description.ilike.%${s}%,tags.cs.{${s.toLowerCase()}}`,
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  // Sort so real (developer-uploaded) apps come first, demos last.
  return rows.slice().sort((a, b) => {
    const ad = isDemoApp(a) ? 1 : 0;
    const bd = isDemoApp(b) ? 1 : 0;
    return ad - bd;
  });
}


export async function fetchApp(slug: string) {
  const { data, error } = await supabase.from("apps").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchReviews(appId: string) {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("app_id", appId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return [];
  const userIds = Array.from(new Set(data.map((r) => r.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);
  const map = new Map((profiles ?? []).map((p) => [p.id, p]));
  return data.map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
}

export async function isInstalled(userId: string, appId: string) {
  const { data, error } = await supabase
    .from("installs")
    .select("id")
    .eq("user_id", userId)
    .eq("app_id", appId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function fetchInstallState(userId: string, appId: string) {
  const { data, error } = await supabase
    .from("installs")
    .select("id, installed_version")
    .eq("user_id", userId)
    .eq("app_id", appId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { installed: true, installedVersion: data.installed_version as string | null }
    : { installed: false, installedVersion: null };
}


export async function installApp(userId: string, appId: string) {
  // Capture the current app version so we can later detect "update available".
  const { data: app } = await supabase
    .from("apps")
    .select("version")
    .eq("id", appId)
    .maybeSingle();
  const { error } = await supabase
    .from("installs")
    .insert({ user_id: userId, app_id: appId, installed_version: app?.version ?? null });
  if (error && !error.message.includes("duplicate")) throw error;
}

/** Bump the user's installed_version to the app's current latest. */
export async function markInstalledAppUpdated(userId: string, appId: string) {
  const { data: app } = await supabase
    .from("apps")
    .select("version")
    .eq("id", appId)
    .maybeSingle();
  const { error } = await supabase
    .from("installs")
    .update({ installed_version: app?.version ?? null })
    .eq("user_id", userId)
    .eq("app_id", appId);
  if (error) throw error;
}

export async function uninstallApp(userId: string, appId: string) {
  const { error } = await supabase.from("installs").delete().eq("user_id", userId).eq("app_id", appId);
  if (error) throw error;
}

export async function fetchMyLibrary(userId: string) {
  const { data, error } = await supabase
    .from("installs")
    .select("installed_at, installed_version, app:apps(*)")
    .eq("user_id", userId)
    .order("installed_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAppVersions(appId: string) {
  const { data, error } = await supabase
    .from("app_versions")
    .select("id, version, release_notes, created_at")
    .eq("app_id", appId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Compare semver-ish strings: returns positive if a > b. */
export function compareVersions(a: string | null | undefined, b: string | null | undefined) {
  const pa = (a ?? "0").split(".").map((p) => parseInt(p.replace(/[^0-9]/g, ""), 10) || 0);
  const pb = (b ?? "0").split(".").map((p) => parseInt(p.replace(/[^0-9]/g, ""), 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

export async function upsertReview(userId: string, appId: string, rating: number, body: string) {
  const { error } = await supabase
    .from("reviews")
    .upsert({ user_id: userId, app_id: appId, rating, body }, { onConflict: "user_id,app_id" });
  if (error) throw error;
}

