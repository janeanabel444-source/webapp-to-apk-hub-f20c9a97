import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForCaller, jsonResult, textResult } from "../supabase";

export default defineTool({
  name: "get_app",
  title: "Get app details",
  description:
    "Fetch full details for a single Nova App Store listing by slug, including description, developer info, permissions, and version.",
  inputSchema: {
    slug: z.string().trim().min(1).max(120).describe("The app's URL slug (e.g. 'my-cool-app')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }, ctx) => {
    if (!ctx.isAuthenticated()) return textResult("Not authenticated", true);
    const supabase = supabaseForCaller(ctx);
    const { data, error } = await supabase
      .from("apps")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) return textResult(error.message, true);
    if (!data) return textResult(`No app found with slug '${slug}'`, true);
    return jsonResult(data);
  },
});
