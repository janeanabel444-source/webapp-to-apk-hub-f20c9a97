import { createFileRoute } from "@tanstack/react-router";
import { getRouterInstance } from "@tanstack/react-start";
import { isSitemapRouteIncluded, sitemapStaticPaths, sitemapPathForLocation, sitemapXML, type SitemapEntry } from "@/lib/sitemap";

const BASE_URL = "https://niza-app-store.lovable.app";

export const Route = createFileRoute("/sitemap.xml")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async () => {
        const router = await getRouterInstance();
        const entries: SitemapEntry[] = sitemapStaticPaths(router).map((path) => ({ path }));

        // Live apps — same public filters the store listings use.
        if (isSitemapRouteIncluded(router.routesById["/app/$slug"])) {
          const supabase = await publicSitemapClient();
          const pageSize = 1000;
          for (let offset = 0; ; ) {
            const { data, error } = await supabase
              .from("apps")
              .select("slug")
              .eq("is_published", true)
              .eq("status", "live")
              .order("id")
              .range(offset, offset + pageSize - 1);
            if (error) throw new Error(`Sitemap app query failed: ${error.message}`);
            if (!data || data.length === 0) break;
            for (const row of data) {
              if (!row.slug) continue;
              const location = router.buildLocation({
                to: "/app/$slug",
                params: { slug: row.slug },
                search: () => ({}),
                hash: "",
              });
              const path = sitemapPathForLocation(router, location, "/app/$slug");
              if (path) entries.push({ path });
            }
            offset += data.length;
          }
        }

        // Published collections.
        if (isSitemapRouteIncluded(router.routesById["/collections/$slug"])) {
          const supabase = await publicSitemapClient();
          const pageSize = 1000;
          for (let offset = 0; ; ) {
            const { data, error } = await supabase
              .from("collections")
              .select("slug")
              .eq("is_published", true)
              .order("id")
              .range(offset, offset + pageSize - 1);
            if (error) throw new Error(`Sitemap collection query failed: ${error.message}`);
            if (!data || data.length === 0) break;
            for (const row of data) {
              if (!row.slug) continue;
              const location = router.buildLocation({
                to: "/collections/$slug",
                params: { slug: row.slug },
                search: () => ({}),
                hash: "",
              });
              const path = sitemapPathForLocation(router, location, "/collections/$slug");
              if (path) entries.push({ path });
            }
            offset += data.length;
          }
        }

        if (entries.length === 0) {
          return new Response(
            'No pages are included in this sitemap. Check route decisions and ancestor exclusions. Setting "exclude-subtree" on the root excludes the entire site.',
            { status: 404, headers: { "Cache-Control": "no-store" } },
          );
        }
        return new Response(sitemapXML(BASE_URL, entries), {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});

/** Session-free publishable-key client; opaque sb_ keys are sent as apikey, not a bearer. */
async function publicSitemapClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabase = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === "Bearer " + key) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  return supabase;
}
