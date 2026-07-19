import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Generate an image via Lovable AI Gateway (Gemini 3 Pro Image), save it to
 * storage, and record it in ai_images. Enforces the shared quota system:
 *  - Admin → unlimited
 *  - Premium / promo → per-role daily quota
 *  - Free with bonus credits → spends a bonus credit (ads/promo)
 *  - Otherwise → AI_QUOTA_NONE
 *
 * Keeps the same return shape (id, createdAt, url, dataUrl) so the AI image
 * page UI does not change.
 */
export const generateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt: string; aspectRatio?: string }) =>
    z
      .object({
        prompt: z.string().trim().min(2).max(2000),
        aspectRatio: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Enforce role/bonus-credit quota BEFORE spending an AI Gateway call.
    const { consumeAiQuota } = await import("@/lib/ai-quota.functions");
    await consumeAiQuota(context.userId);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI image generation is not configured on this project.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image",
        messages: [{ role: "user", content: data.prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI is busy — please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted on this project. Please add credits.");
      throw new Error(`AI image generation failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const body = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = body?.data?.[0]?.b64_json;
    if (!b64) throw new Error("AI returned no image. Try a more descriptive prompt.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${context.userId}/${Date.now()}-${crypto.randomUUID()}.png`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("ai-images")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("ai-images")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (sErr || !signed) throw new Error(`Could not sign URL: ${sErr?.message ?? "unknown"}`);

    const { data: row, error: iErr } = await supabaseAdmin
      .from("ai_images")
      .insert({
        user_id: context.userId,
        prompt: data.prompt,
        storage_path: path,
        image_url: signed.signedUrl,
      })
      .select("id, created_at")
      .single();
    if (iErr) throw new Error(`Insert failed: ${iErr.message}`);

    return {
      id: row.id,
      createdAt: row.created_at,
      url: signed.signedUrl,
      dataUrl: `data:image/png;base64,${b64}`,
    };
  });
