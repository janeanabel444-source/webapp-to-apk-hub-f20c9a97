import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

const appInput = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(160).optional().nullable(),
  short_description: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().min(10).max(4000),
  category: z.enum(["app", "game"]),
  subcategory: z.string().trim().max(60).optional().nullable(),
  platform: z.enum(["web", "pwa", "android"]),
  icon_url: z.string().url(),
  feature_banner_url: z.string().url().optional().nullable(),
  app_url: z.string().url().optional().nullable(),
  website_url: z.string().url().optional().nullable(),
  privacy_policy_url: z.string().url().optional().nullable(),
  developer_name: z.string().trim().max(120).optional().nullable(),
  developer_email: z.string().trim().email().max(255).optional().nullable(),
  file_path: z.string().min(1).optional().nullable(),
  screenshots: z.array(z.string().url()).max(8).default([]),
  tags: z.array(z.string().trim().min(1).max(32)).max(20).default([]),
  languages: z.array(z.string().trim().min(2).max(32)).max(30).default([]),
  min_android_version: z.string().trim().max(16).optional().nullable(),
  target_android_version: z.string().trim().max(16).optional().nullable(),
  content_rating: z.enum(["everyone", "teen", "mature"]).optional().nullable(),
  license: z.enum(["free", "paid"]).default("free"),
  price_kobo: z.number().int().nonnegative().default(0),
  is_draft: z.boolean().default(false),
  package_name: z.string().trim().max(255).optional().nullable(),
  version_name: z.string().trim().max(64).optional().nullable(),
  version_code: z.number().int().nonnegative().optional().nullable(),
  apk_size: z.number().int().nonnegative().optional().nullable(),
  permissions: z.array(z.string()).max(200).default([]),
  release_notes: z.string().trim().max(2000).optional().nullable(),
});


// Semver-like x.y.z validation (1–4 numeric segments, e.g. 1.0.1, 2.0.0, 1.2.3.4)
const SEMVER_RE = /^\d+(\.\d+){0,3}$/;
function parseVersion(v: string): number[] {
  return v.split(".").map((p) => parseInt(p.replace(/[^0-9]/g, ""), 10) || 0);
}
function compareVersions(a: string, b: string): number {
  const A = parseVersion(a);
  const B = parseVersion(b);
  const len = Math.max(A.length, B.length);
  for (let i = 0; i < len; i++) {
    const x = A[i] ?? 0;
    const y = B[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

/**
 * Scan an uploaded app binary with VirusTotal. Throws on malicious; returns
 * silently on clean/unknown. Shared by create + update so both paths are
 * protected against malware bypass.
 */
async function scanAppBinaryOrThrow(filePath: string) {
  const { scanStorageFileWithVirusTotal } = await import("@/lib/virustotal.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const scan = await scanStorageFileWithVirusTotal("app-files", filePath);
  if (scan.status === "malicious") {
    await supabaseAdmin.storage.from("app-files").remove([filePath]).catch(() => {});
    throw new Error(
      `This file was flagged by ${scan.positives} of ${scan.total} antivirus engines and cannot be published.`,
    );
  }
}

export const createDeveloperApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => appInput.parse(input))
  .handler(async ({ data, context }) => {
    const isDraft = data.is_draft === true;
    // Android apps are APK-only; non-Android still accept a URL or file.
    // Drafts skip these requirements so developers can save partial work.
    if (!isDraft) {
      if (data.platform === "android") {
        if (!data.file_path) throw new Error("Android apps require an APK upload.");
      } else if (!data.app_url && !data.file_path) {
        throw new Error("Provide an app URL or upload an app file.");
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Duplicate-name guard within a developer's own catalogue.
    const { data: dup } = await supabaseAdmin
      .from("apps")
      .select("id")
      .eq("developer_id", context.userId)
      .ilike("name", data.name)
      .maybeSingle();
    if (dup) throw new Error("You already have an app with this name.");

    if (data.file_path && !isDraft) {
      await scanAppBinaryOrThrow(data.file_path);
    }

    const base = slugify(data.name) || "app";
    const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const initialVersion = (data.version_name && data.version_name.trim()) || "1.0.0";
    const releaseNotes = (data.release_notes && data.release_notes.trim()) || "Initial release";
    const { data: row, error } = await supabaseAdmin
      .from("apps")
      .insert({
        developer_id: context.userId,
        slug,
        name: data.name,
        tagline: data.tagline ?? null,
        short_description: data.short_description ?? null,
        description: data.description,
        category: data.category,
        subcategory: data.subcategory ?? null,
        platform: data.platform,
        icon_url: data.icon_url,
        feature_banner_url: data.feature_banner_url ?? null,
        app_url: data.platform === "android" ? null : (data.app_url ?? null),
        website_url: data.website_url ?? null,
        privacy_policy_url: data.privacy_policy_url ?? null,
        developer_name: data.developer_name ?? null,
        developer_email: data.developer_email ?? null,
        file_path: data.file_path ?? null,
        screenshots: data.screenshots,
        tags: data.tags ?? [],
        languages: data.languages ?? [],
        min_android_version: data.min_android_version ?? null,
        target_android_version: data.target_android_version ?? null,
        content_rating: data.content_rating ?? null,
        license: data.license ?? "free",
        price_kobo: data.license === "paid" ? (data.price_kobo ?? 0) : 0,
        is_draft: isDraft,
        is_published: !isDraft,
        status: isDraft ? "draft" : "live",
        version: initialVersion,
        latest_release_notes: releaseNotes,
        last_updated_at: new Date().toISOString(),
        package_name: data.package_name ?? null,
        version_code: data.version_code ?? null,
        apk_size: data.apk_size ?? null,
        permissions: data.permissions ?? [],
      })
      .select("id, slug, status")
      .single();
    if (error) throw new Error(error.message);

    if (!isDraft) {
      await supabaseAdmin.from("app_versions").insert({
        app_id: row.id,
        version: initialVersion,
        release_notes: releaseNotes,
        file_path: data.file_path ?? null,
        package_name: data.package_name ?? null,
        version_code: data.version_code ?? null,
        apk_size: data.apk_size ?? null,
        permissions: data.permissions ?? [],
        permissions_added: data.permissions ?? [],
        permissions_removed: [],
      });
    }

    return row;
  });

/** Check if the current developer already uses this app name. */
export const checkAppNameAvailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().trim().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("apps")
      .select("id")
      .eq("developer_id", context.userId)
      .ilike("name", data.name)
      .maybeSingle();
    return { available: !existing };
  });



// Edits to metadata only. file_path changes here are also scanned (defense in
// depth) — primary version/binary updates should go through publishAppUpdate.
export const updateDeveloperApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    appInput.partial().extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { data: existing } = await supabaseAdmin
      .from("apps")
      .select("developer_id, status, file_path")
      .eq("id", id)
      .maybeSingle();
    if (!existing || existing.developer_id !== context.userId) {
      throw new Error("Not found");
    }
    // SECURITY: any binary swap must be re-scanned, even on a metadata edit.
    if (patch.file_path && patch.file_path !== existing.file_path) {
      await scanAppBinaryOrThrow(patch.file_path);
    }
    // Drop fields not on the apps table.
    const { version_name: _vn, release_notes: _rn, ...safePatch } =
      patch as typeof patch & { version_name?: unknown; release_notes?: unknown };
    void _vn; void _rn;
    const { error } = await supabaseAdmin
      .from("apps")
      .update({ ...safePatch, status: existing.status === "live" ? "live" : "pending" })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const updateInput = z.object({
  id: z.string().uuid(),
  version: z.string().trim().regex(SEMVER_RE, "Version must look like 1.0.1, 1.1.0, or 2.0.0"),
  release_notes: z.string().trim().min(3).max(2000),
  file_path: z.string().min(1).optional().nullable(),
  app_url: z.string().url().optional().nullable(),
  package_name: z.string().max(255).optional().nullable(),
  version_code: z.number().int().nonnegative().optional().nullable(),
  apk_size: z.number().int().nonnegative().optional().nullable(),
  permissions: z.array(z.string()).max(200).default([]),
});

/**
 * Publish a new version of an existing app. Replaces the live binary while
 * preserving installs/ratings/reviews/screenshots. Records a row in
 * app_versions for the history timeline.
 */
export const publishAppUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("apps")
      .select("id, developer_id, version, file_path, app_url, permissions")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing || existing.developer_id !== context.userId) {
      throw new Error("App not found");
    }

    if (compareVersions(data.version, existing.version ?? "0.0.0") <= 0) {
      throw new Error(
        `Version ${data.version} must be greater than the current version ${existing.version}.`,
      );
    }

    const newFilePath = data.file_path ?? existing.file_path;
    if (!newFilePath && !data.app_url && !existing.app_url) {
      throw new Error("Provide a new app file or an updated app URL.");
    }

    if (data.file_path && data.file_path !== existing.file_path) {
      await scanAppBinaryOrThrow(data.file_path);
    }

    const prevPerms: string[] = (existing.permissions as string[] | null) ?? [];
    const nextPerms = data.permissions ?? [];
    const prevSet = new Set(prevPerms);
    const nextSet = new Set(nextPerms);
    const permsAdded = [...nextSet].filter((p) => !prevSet.has(p));
    const permsRemoved = [...prevSet].filter((p) => !nextSet.has(p));

    const now = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from("apps")
      .update({
        version: data.version,
        latest_release_notes: data.release_notes,
        file_path: newFilePath,
        app_url: data.app_url ?? existing.app_url,
        last_updated_at: now,
        status: "live",
        is_published: true,
        package_name: data.package_name ?? undefined,
        version_code: data.version_code ?? undefined,
        apk_size: data.apk_size ?? undefined,
        permissions: nextPerms.length ? nextPerms : undefined,
      })
      .eq("id", data.id);
    if (updateErr) throw new Error(updateErr.message);

    const { error: histErr } = await supabaseAdmin.from("app_versions").insert({
      app_id: data.id,
      version: data.version,
      release_notes: data.release_notes,
      file_path: newFilePath,
      package_name: data.package_name ?? null,
      version_code: data.version_code ?? null,
      apk_size: data.apk_size ?? null,
      permissions: nextPerms,
      permissions_added: permsAdded,
      permissions_removed: permsRemoved,
    });
    if (histErr) throw new Error(histErr.message);

    return { ok: true, version: data.version };
  });

export const listMyDeveloperApps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("apps")
      .select("id, slug, name, category, platform, icon_url, status, install_count, version, last_updated_at, created_at, updated_at")
      .eq("developer_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyDeveloperApp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("apps")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.developer_id !== context.userId) throw new Error("Not found");
    return row;
  });

export const deleteDeveloperApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("apps")
      .select("developer_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing || existing.developer_id !== context.userId) throw new Error("Not found");
    const { error } = await supabaseAdmin.from("apps").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
