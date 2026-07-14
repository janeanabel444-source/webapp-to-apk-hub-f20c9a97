import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const descInput = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(40),
  tagline: z.string().max(300).optional().nullable(),
  hint: z.string().max(1000).optional().nullable(),
});

const kwInput = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(40),
  description: z.string().max(4000).optional().nullable(),
});

async function callAi(prompt: string, system: string): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
      }),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const text: string = json?.choices?.[0]?.message?.content?.trim?.() ?? "";
    return text || null;
  } catch {
    return null;
  }
}

export const generateAppDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => descInput.parse(raw))
  .handler(async ({ data }) => {
    const prompt = `Write a compelling Android app store description for "${data.name}" in category "${data.category}".
${data.tagline ? `Tagline: ${data.tagline}\n` : ""}${data.hint ? `Notes: ${data.hint}\n` : ""}Structure:
1. A one-paragraph hook (2-3 sentences).
2. A "Key features" section with 4-6 bullet points.
3. A short closing line inviting the user to download.
Keep the tone friendly, confident, and factual. Do not invent specific numbers or partnerships. Return plain text.`;
    const text = await callAi(prompt, "You write concise, high-converting Android app store descriptions.");
    return { text: text ?? `${data.name} — a great new ${data.category} experience.\n\nKey features:\n• Fast and simple\n• Works offline\n• Regular updates\n\nDownload now to try it out.`, source: text ? "ai" : "fallback" };
  });

export const generateAppKeywords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => kwInput.parse(raw))
  .handler(async ({ data }) => {
    const prompt = `Suggest 10 short store search keywords/tags for the Android app "${data.name}" in category "${data.category}".
${data.description ? `Description: ${data.description.slice(0, 1200)}` : ""}
Return them as a single comma-separated line, lowercase, no hashtags, no numbering, each 1-3 words.`;
    const text = await callAi(prompt, "You suggest concise app store discovery keywords.");
    const raw = text ?? `${data.category}, mobile, android, free, tools, app, ${data.name.toLowerCase()}`;
    const tags = raw
      .replace(/\n/g, ",")
      .split(",")
      .map((t) => t.replace(/^[\s\-#*"']+|[\s"']+$/g, "").toLowerCase())
      .filter((t) => t.length >= 2 && t.length <= 32)
      .slice(0, 12);
    return { tags, source: text ? "ai" : "fallback" };
  });
