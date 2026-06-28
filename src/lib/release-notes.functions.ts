import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  appName: z.string().min(1).max(120),
  previousVersion: z.string().nullable().optional(),
  newVersion: z.string().min(1).max(32),
  previousSize: z.number().nullable().optional(),
  newSize: z.number().nullable().optional(),
  permissionsAdded: z.array(z.string()).default([]),
  permissionsRemoved: z.array(z.string()).default([]),
});

function bytes(n: number | null | undefined) {
  if (!n || n <= 0) return null;
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

function fallbackNotes(d: z.infer<typeof input>): string {
  const lines: string[] = [];
  if (d.previousVersion) {
    lines.push(`• Updated from version ${d.previousVersion} to ${d.newVersion}`);
  } else {
    lines.push(`• Version ${d.newVersion} released`);
  }
  const ps = bytes(d.previousSize);
  const ns = bytes(d.newSize);
  if (ps && ns && d.previousSize !== d.newSize) {
    lines.push(`• Download size changed from ${ps} to ${ns}`);
  } else if (ns) {
    lines.push(`• Download size: ${ns}`);
  }
  if (d.permissionsAdded.length) {
    lines.push(`• New permissions: ${d.permissionsAdded.join(", ")}`);
  }
  if (d.permissionsRemoved.length) {
    lines.push(`• Removed permissions: ${d.permissionsRemoved.join(", ")}`);
  }
  if (lines.length <= 1) lines.push("• Bug fixes and improvements");
  return lines.join("\n");
}

/**
 * Generate AI-suggested release notes from APK diff metadata. Falls back to
 * a deterministic template if the AI gateway is unavailable or rate-limits.
 */
export const generateReleaseNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data }) => {
    const fb = fallbackNotes(data);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { notes: fb, source: "fallback" as const };

    const ps = bytes(data.previousSize);
    const ns = bytes(data.newSize);
    const prompt = `Write concise, user-friendly Android app release notes for "${data.appName}".
Use a short bulleted list (3-6 bullets, no headers).
${data.previousVersion ? `Previous version: ${data.previousVersion}` : "First release."}
New version: ${data.newVersion}
${ps && ns ? `APK size: ${ps} -> ${ns}` : ns ? `APK size: ${ns}` : ""}
${data.permissionsAdded.length ? `New permissions: ${data.permissionsAdded.join(", ")}` : ""}
${data.permissionsRemoved.length ? `Removed permissions: ${data.permissionsRemoved.join(", ")}` : ""}
Tone: friendly, factual. Do not invent features. If little info is available, mention "bug fixes and stability improvements".`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Lovable-API-Key": apiKey,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You write short Android release notes." },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
        }),
      });
      if (!res.ok) return { notes: fb, source: "fallback" as const };
      const json: any = await res.json();
      const text: string = json?.choices?.[0]?.message?.content?.trim?.() ?? "";
      if (!text) return { notes: fb, source: "fallback" as const };
      return { notes: text, source: "ai" as const };
    } catch {
      return { notes: fb, source: "fallback" as const };
    }
  });
