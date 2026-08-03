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

const assistInput = z.object({
  name: z.string().trim().min(1).max(120),
  shortDescription: z.string().trim().min(3).max(400),
  platform: z.string().max(40).optional().nullable(),
  /** Nudge the model to produce something different from the last attempt. */
  regenerate: z.boolean().optional().default(false),
});

async function callAi(prompt: string, system: string, temperature = 0.6): Promise<string | null> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature,
      }),
    });
    if (res.status === 429) throw new Error("The AI assistant is busy right now. Try again in a moment.");
    if (res.status === 402) throw new Error("AI credits are exhausted. Add credits to keep using the assistant.");
    if (!res.ok) return null;
    const json: any = await res.json();
    const text: string = json?.choices?.[0]?.message?.content?.trim?.() ?? "";
    return text || null;
  } catch (e: any) {
    if (e?.message?.startsWith("The AI assistant is busy") || e?.message?.startsWith("AI credits")) throw e;
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

export type ListingSuggestions = {
  description: string;
  releaseNotes: string;
  features: string[];
  marketing: string;
  keywords: string[];
  tags: string[];
  category: "app" | "game";
  ageRating: "everyone" | "teen" | "mature";
  highlights: string[];
  searchMetadata: string;
  source: "ai" | "fallback";
};

function stripFence(t: string) {
  return t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

function fallbackSuggestions(name: string, short: string): ListingSuggestions {
  return {
    description: `${name}\n\n${short}\n\nKey features:\n• Simple and fast to use\n• Designed for everyday Android devices\n• Regular improvements and fixes\n\nInstall ${name} today and see for yourself.`,
    releaseNotes: "Initial release of " + name + ".",
    features: ["Simple and fast", "Works on everyday devices", "Regular updates"],
    marketing: `${name} — ${short}`,
    keywords: [name.toLowerCase(), "android", "app", "tools"],
    tags: [name.toLowerCase().split(" ")[0] ?? "app", "android", "tools"],
    category: "app",
    ageRating: "everyone",
    highlights: [short],
    searchMetadata: `${name}, ${short}`,
    source: "fallback",
  };
}

/**
 * AI Upload Assistant. Turns an app name + short description into a complete
 * set of *suggestions* for the listing. Nothing here is saved automatically —
 * the wizard shows each block for editing and explicit approval.
 */
export const generateListingSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => assistInput.parse(raw))
  .handler(async ({ data }): Promise<ListingSuggestions> => {
    const prompt = `An Android developer is publishing an application on an app marketplace.

App name: ${data.name}
Short description: ${data.shortDescription}
${data.platform ? `Application type: ${data.platform}` : ""}
${data.regenerate ? "Write a NOTICEABLY DIFFERENT alternative to any previous attempt: different angle, different wording, different structure." : ""}

Infer what the application does and return ONLY a JSON object with exactly these keys:
{
  "description": "full store description, plain text, a hook paragraph then a 'Key features' bullet list then a closing line",
  "releaseNotes": "short first-release notes, 1-3 lines",
  "features": ["4-6 short feature phrases"],
  "marketing": "one punchy marketing paragraph, max 300 characters",
  "keywords": ["8-12 lowercase search keywords"],
  "tags": ["5-10 lowercase store tags, 1-2 words each"],
  "category": "app" | "game",
  "ageRating": "everyone" | "teen" | "mature",
  "highlights": ["3-5 very short selling points, max 6 words each"],
  "searchMetadata": "one comma separated line of extra search terms"
}
Be factual, never invent awards, numbers, companies or partnerships. No markdown fences.`;

    const text = await callAi(
      prompt,
      "You are an expert Android app store listing writer. You always answer with valid JSON only.",
      data.regenerate ? 0.95 : 0.7,
    );
    if (!text) return fallbackSuggestions(data.name, data.shortDescription);
    try {
      const parsed = JSON.parse(stripFence(text));
      const arr = (v: unknown, max: number) =>
        Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, max) : [];
      const fb = fallbackSuggestions(data.name, data.shortDescription);
      return {
        description: String(parsed.description ?? fb.description).trim(),
        releaseNotes: String(parsed.releaseNotes ?? fb.releaseNotes).trim(),
        features: arr(parsed.features, 8).length ? arr(parsed.features, 8) : fb.features,
        marketing: String(parsed.marketing ?? fb.marketing).trim(),
        keywords: arr(parsed.keywords, 12).map((k) => k.toLowerCase()),
        tags: arr(parsed.tags, 10).map((t) => t.toLowerCase().replace(/^#/, "")),
        category: parsed.category === "game" ? "game" : "app",
        ageRating: ["everyone", "teen", "mature"].includes(parsed.ageRating) ? parsed.ageRating : "everyone",
        highlights: arr(parsed.highlights, 6),
        searchMetadata: String(parsed.searchMetadata ?? fb.searchMetadata).trim(),
        source: "ai",
      };
    } catch {
      return fallbackSuggestions(data.name, data.shortDescription);
    }
  });
