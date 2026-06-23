import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Generate an image with Stability AI. Premium-only.
 * Returns a base64 PNG data URL.
 */
export const generateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt: string; aspectRatio?: string }) =>
    z
      .object({
        prompt: z.string().min(2).max(2000),
        aspectRatio: z
          .enum(["1:1", "16:9", "9:16", "3:2", "2:3", "4:5", "5:4", "21:9", "9:21"])
          .optional()
          .default("1:1"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Gate: premium only
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("is_premium")
      .eq("id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile?.is_premium) {
      throw new Error("PREMIUM_REQUIRED");
    }

    const key = process.env.STABILITY_AI_API_KEY;
    if (!key) throw new Error("Image generation is not configured.");

    const form = new FormData();
    form.append("prompt", data.prompt);
    form.append("aspect_ratio", data.aspectRatio ?? "1:1");
    form.append("output_format", "png");

    const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Stability AI error (${res.status}): ${text.slice(0, 300)}`);
    }
    const body = (await res.json()) as { image: string; finish_reason: string };
    if (!body.image) throw new Error("No image returned");

    return { dataUrl: `data:image/png;base64,${body.image}` };
  });
