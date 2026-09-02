import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Developer reply to a review. Only the verified owner of the app the review
 * belongs to may reply, and only one reply per review (editable).
 */
export const replyToReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      reviewId: z.string().uuid(),
      reply: z.string().trim().min(1).max(1000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: review } = await supabaseAdmin
      .from("reviews")
      .select("id, app_id, app:apps(developer_id)")
      .eq("id", data.reviewId)
      .maybeSingle();
    if (!review) throw new Error("Review not found.");
    if ((review as any).app?.developer_id !== context.userId) {
      throw new Error("Only the app's developer can reply to this review.");
    }
    const { error } = await supabaseAdmin
      .from("reviews")
      .update({ dev_reply: data.reply, dev_replied_at: new Date().toISOString() })
      .eq("id", data.reviewId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMyReviewReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ reviewId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: review } = await supabaseAdmin
      .from("reviews")
      .select("id, app:apps(developer_id)")
      .eq("id", data.reviewId)
      .maybeSingle();
    if (!review || (review as any).app?.developer_id !== context.userId) {
      throw new Error("Only the app's developer can remove this reply.");
    }
    await supabaseAdmin
      .from("reviews")
      .update({ dev_reply: null, dev_replied_at: null })
      .eq("id", data.reviewId);
    return { ok: true };
  });
