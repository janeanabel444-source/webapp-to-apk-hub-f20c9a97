import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KIND = "boost_app";

/** Should we show the "Boost your app" prompt for this app right now? */
export const getBoostPrompt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ appId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("developer_prompts")
      .select("id, status, snoozed_until")
      .eq("user_id", context.userId)
      .eq("app_id", data.appId)
      .eq("kind", KIND)
      .maybeSingle();
    if (!row) return { show: true };
    if (row.status === "dismissed") return { show: false };
    if (row.snoozed_until && new Date(row.snoozed_until).getTime() > Date.now()) {
      return { show: false };
    }
    return { show: true };
  });

/** Remind me later (default 3 days) or dismiss the prompt permanently. */
export const setBoostPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      appId: z.string().uuid(),
      action: z.enum(["snooze", "dismiss"]),
      days: z.number().int().min(1).max(30).default(3),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const snoozedUntil =
      data.action === "snooze"
        ? new Date(Date.now() + data.days * 24 * 60 * 60 * 1000).toISOString()
        : null;
    const { error } = await context.supabase.from("developer_prompts").upsert(
      {
        user_id: context.userId,
        app_id: data.appId,
        kind: KIND,
        status: data.action === "dismiss" ? "dismissed" : "snoozed",
        snoozed_until: snoozedUntil,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,app_id,kind" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
