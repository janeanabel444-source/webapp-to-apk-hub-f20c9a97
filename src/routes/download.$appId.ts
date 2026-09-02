import { createFileRoute } from "@tanstack/react-router";

/**
 * Permanent download endpoint: `/download/<app-id>`.
 *
 * Resolves the app's newest active release server-side, streams the APK
 * straight back to the caller (no redirect, no expiring Supabase URL) and
 * increments the download counter. Links stay valid across app updates.
 */
export const Route = createFileRoute("/download/$appId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const appId = String((params as { appId?: string })?.appId ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(appId)) {
          return new Response("Invalid app id", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: app } = await supabaseAdmin
          .from("apps")
          .select("id, name, slug, file_path, status, is_published, download_count")
          .eq("id", appId)
          .maybeSingle();

        if (!app) return new Response("App not found", { status: 404 });
        if (!app.is_published || (app.status !== "live" && app.status !== "approved")) {
          return new Response("This app is not available for download yet.", { status: 403 });
        }
        if (!app.file_path) {
          return new Response("This app has no downloadable file.", { status: 404 });
        }

        const fileName = `${app.name.replace(/[^a-z0-9.-]+/gi, "_")}.apk`;
        const { data: signed, error } = await supabaseAdmin.storage
          .from("app-files")
          .createSignedUrl(app.file_path, 60 * 5, { download: fileName });
        if (error || !signed) {
          return new Response("Download is temporarily unavailable.", { status: 502 });
        }

        const upstream = await fetch(signed.signedUrl);
        if (!upstream.ok || !upstream.body) {
          return new Response("Download is temporarily unavailable.", { status: 502 });
        }

        // Fire-and-forget counter bump — never block the stream on it.
        void supabaseAdmin
          .from("apps")
          .update({ download_count: (app.download_count ?? 0) + 1 })
          .eq("id", app.id);

        const headers = new Headers({
          "content-type": "application/vnd.android.package-archive",
          "content-disposition": `attachment; filename="${fileName}"`,
          "cache-control": "no-store",
        });
        const len = upstream.headers.get("content-length");
        if (len) headers.set("content-length", len);

        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
});
