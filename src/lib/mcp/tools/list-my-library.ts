import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForCaller, jsonResult, textResult } from "../supabase";

export default defineTool({
  name: "list_my_library",
  title: "List my installed apps",
  description:
    "List the apps the signed-in Nova user has installed, including the installed version and install date.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return textResult("Not authenticated", true);
    const supabase = supabaseForCaller(ctx);
    const { data, error } = await supabase
      .from("installs")
      .select("installed_at, installed_version, app:apps(id, slug, name, tagline, category, version, icon_url)")
      .eq("user_id", ctx.getUserId())
      .order("installed_at", { ascending: false });
    if (error) return textResult(error.message, true);
    return jsonResult({ library: data ?? [] });
  },
});
