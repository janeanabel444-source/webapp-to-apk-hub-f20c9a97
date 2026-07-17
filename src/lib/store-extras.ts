import { supabase } from "@/integrations/supabase/client";
import type { App } from "@/lib/store";

// ---------- Favorites ----------
export async function toggleFavorite(userId: string, appId: string, on: boolean) {
  if (on) {
    const { error } = await supabase.from("favorites" as any).insert({ user_id: userId, app_id: appId });
    if (error && !error.message.includes("duplicate")) throw error;
  } else {
    const { error } = await supabase.from("favorites" as any).delete().eq("user_id", userId).eq("app_id", appId);
    if (error) throw error;
  }
}

export async function isFavorite(userId: string, appId: string) {
  const { data } = await supabase.from("favorites" as any).select("id").eq("user_id", userId).eq("app_id", appId).maybeSingle();
  return !!data;
}

export async function fetchMyFavorites(userId: string): Promise<App[]> {
  const { data, error } = await supabase
    .from("favorites" as any)
    .select("created_at, app:apps(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => r.app).filter(Boolean);
}

// ---------- Recently Viewed ----------
export async function trackView(userId: string, appId: string) {
  await supabase
    .from("recently_viewed" as any)
    .upsert({ user_id: userId, app_id: appId, viewed_at: new Date().toISOString() }, { onConflict: "user_id,app_id" });
}

export async function fetchRecentlyViewed(userId: string, limit = 12): Promise<App[]> {
  const { data, error } = await supabase
    .from("recently_viewed" as any)
    .select("viewed_at, app:apps(*)")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => r.app).filter(Boolean);
}

// ---------- Similar apps ----------
export async function fetchSimilarApps(app: App, limit = 8): Promise<App[]> {
  const { data } = await supabase
    .from("apps")
    .select("*")
    .eq("is_published", true)
    .eq("status", "live")
    .eq("category", app.category)
    .neq("id", app.id)
    .order("install_count", { ascending: false })
    .limit(limit);
  return (data ?? []) as App[];
}

// ---------- Featured / trending / top charts / recently updated ----------
export async function fetchFeatured(category?: "app" | "game", limit = 8): Promise<App[]> {
  let q = supabase
    .from("apps")
    .select("*")
    .eq("is_published", true)
    .eq("status", "live")
    .eq("is_featured", true)
    .order("featured_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data } = await q.limit(limit);
  return (data ?? []) as App[];
}

export async function fetchTrending(category?: "app" | "game", limit = 12): Promise<App[]> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  let q = supabase
    .from("apps")
    .select("*")
    .eq("is_published", true)
    .eq("status", "live")
    .gte("last_updated_at", since)
    .order("download_count", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data } = await q.limit(limit);
  return (data ?? []) as App[];
}

export async function fetchTopCharts(category?: "app" | "game", limit = 20): Promise<App[]> {
  let q = supabase
    .from("apps")
    .select("*")
    .eq("is_published", true)
    .eq("status", "live")
    .order("install_count", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data } = await q.limit(limit);
  return (data ?? []) as App[];
}

export async function fetchRecentlyUpdated(limit = 12): Promise<App[]> {
  const { data } = await supabase
    .from("apps")
    .select("*")
    .eq("is_published", true)
    .eq("status", "live")
    .order("last_updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as App[];
}

// ---------- Collections ----------
export type Collection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  sort_order: number;
};

export async function fetchCollections(): Promise<Collection[]> {
  const { data, error } = await supabase
    .from("collections" as any)
    .select("id, slug, title, description, cover_url, sort_order")
    .eq("is_published", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as unknown as Collection[];
}

export async function fetchCollection(slug: string) {
  const { data: col } = await supabase
    .from("collections" as any)
    .select("id, slug, title, description, cover_url")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!col) return null;
  const { data: apps } = await supabase
    .from("collection_apps" as any)
    .select("sort_order, app:apps(*)")
    .eq("collection_id", (col as any).id)
    .order("sort_order");
  return {
    collection: col as any,
    apps: ((apps ?? []) as any[]).map((r) => r.app).filter(Boolean) as App[],
  };
}

// ---------- Reports ----------
export async function submitReport(
  userId: string,
  appId: string,
  reason: "malware" | "broken" | "inappropriate" | "copyright" | "spam" | "other",
  details: string,
) {
  const { error } = await supabase
    .from("reports" as any)
    .insert({ user_id: userId, app_id: appId, reason, details: details || null });
  if (error) throw error;
}

// ---------- Notifications ----------
export type Notif = {
  id: string;
  user_id: string;
  app_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export async function fetchNotifications(userId: string, limit = 30): Promise<Notif[]> {
  const { data } = await supabase
    .from("notifications" as any)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown) as Notif[];
}

export async function unreadNotificationCount(userId: string) {
  const { count } = await supabase
    .from("notifications" as any)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

export async function markNotificationsRead(userId: string) {
  await supabase
    .from("notifications" as any)
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}

// ---------- Download counter (RLS-safe RPC not exposed; safe UPDATE via row policy would need dedicated policy; fall back to install-derived counter) ----------
export async function incrementDownload(appId: string) {
  // Best-effort — server-side install trigger already updates install_count.
  // We piggyback: update download_count via a dedicated RPC would need public schema; skip for now.
  void appId;
}
