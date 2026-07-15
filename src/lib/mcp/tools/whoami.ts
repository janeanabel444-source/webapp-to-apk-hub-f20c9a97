import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForCaller, jsonResult, textResult } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description:
    "Return the signed-in Nova App Store user's profile (display name, avatar, premium status).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return textResult("Not authenticated", true);
    const supabase = supabaseForCaller(ctx);
    const userId = ctx.getUserId();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, created_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) return textResult(error.message, true);
    return jsonResult({
      user_id: userId,
      email: ctx.getUserEmail?.() ?? null,
      profile: data,
    });
  },
});
