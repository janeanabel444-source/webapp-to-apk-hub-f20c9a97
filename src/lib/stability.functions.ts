import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Generate an image with Stability AI, save to storage, and record in ai_images.
 * Premium-only. Returns a data URL for immediate display + the persisted row id.
 */
export const generateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt: string; aspectRatio?: string }) =>
    z
      .object({
        prompt: z.string().trim().min(2).max(2000),
        aspectRatio: z
          .enum(["1:1", "16:9", "9:16", "3:2", "2:3", "4:5", "5:4", "21:9", "9:21"])
          .optional()
          .default("1:1"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Role-based daily quota (admin = unlimited, jasper_ai/premium = 20/day, else 0)
    const { consumeAiQuota } = await import("@/lib/ai-quota.functions");
    await consumeAiQuota(context.userId);

    const key = process.env.STABILITY_AI_API_KEY;
    if (!key) throw new Error("Image generation is not configured.");

    const form = new FormData();
    form.append("prompt", data.prompt);
    form.append("aspect_ratio", data.aspectRatio ?? "1:1");
    form.append("output_format", "png");

    const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Stability AI error (${res.status}): ${text.slice(0, 300)}`);
    }
    const body = (await res.json()) as { image: string };
    if (!body.image) throw new Error("No image returned");

    // Upload to private storage bucket using admin client
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Uint8Array.from(atob(body.image), (c) => c.charCodeAt(0));
    const path = `${context.userId}/${Date.now()}-${crypto.randomUUID()}.png`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("ai-images")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    // Signed URL (1 year) for immediate use
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("ai-images")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (sErr || !signed) throw new Error(`Could not sign URL: ${sErr?.message ?? "unknown"}`);

    // Persist row
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
      dataUrl: `data:image/png;base64,${body.image}`,
    };
  });
