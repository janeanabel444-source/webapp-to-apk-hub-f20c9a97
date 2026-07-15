import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForCaller, jsonResult, textResult } from "../supabase";

export default defineTool({
  name: "list_my_developer_apps",
  title: "List my developer apps",
  description:
    "List apps the signed-in user has published or drafted as a developer on Nova App Store, including status and install count.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return textResult("Not authenticated", true);
    const supabase = supabaseForCaller(ctx);
    const { data, error } = await supabase
      .from("apps")
      .select("id, slug, name, category, status, is_published, is_draft, version, install_count, rating_avg, rating_count, created_at, updated_at")
      .eq("developer_id", ctx.getUserId())
      .order("updated_at", { ascending: false });
    if (error) return textResult(error.message, true);
    return jsonResult({ apps: data ?? [] });
  },
});
