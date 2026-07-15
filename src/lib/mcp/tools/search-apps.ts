import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForCaller, jsonResult, textResult } from "../supabase";

export default defineTool({
  name: "search_apps",
  title: "Search apps",
  description:
    "Search the Nova App Store catalog of published, live apps by name, tagline, short description, or tag. Optionally filter by category.",
  inputSchema: {
    query: z.string().trim().min(1).max(120).optional().describe("Free-text search term."),
    category: z.enum(["app", "game", "ai_video"]).optional().describe("Filter by app category."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return textResult("Not authenticated", true);
    const supabase = supabaseForCaller(ctx);
    let q = supabase
      .from("apps")
      .select("id, slug, name, tagline, short_description, category, icon_url, install_count, rating_avg, rating_count, version")
      .eq("is_published", true)
      .eq("status", "live")
      .order("install_count", { ascending: false })
      .limit(limit ?? 20);
    if (category) q = q.eq("category", category);
    if (query) {
      const s = query.trim();
      q = q.or(
        `name.ilike.%${s}%,tagline.ilike.%${s}%,short_description.ilike.%${s}%,tags.cs.{${s.toLowerCase()}}`,
      );
    }
    const { data, error } = await q;
    if (error) return textResult(error.message, true);
    return jsonResult({ apps: data ?? [] });
  },
});
