import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 15 * 60_000;

function secret() {
  return process.env.NIZA_ADS_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.LOVABLE_API_KEY;
}

export function createAdEventToken(campaignId: string, publisherAppId: string, placement: string) {
  const key = secret();
  if (!key) throw new Error("Ad reporting is not configured.");
  const issuedAt = Date.now();
  const payload = `${campaignId}.${publisherAppId}.${placement}.${issuedAt}`;
  const signature = createHmac("sha256", key).update(payload).digest("hex");
  return `${issuedAt}.${signature}`;
}

export function verifyAdEventToken(
  token: string,
  campaignId: string,
  publisherAppId: string,
  placement: string,
) {
  const key = secret();
  if (!key) return false;
  const [issuedAtText, signature] = token.split(".");
  const issuedAt = Number(issuedAtText);
  if (!issuedAtText || !signature || !Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > TOKEN_TTL_MS || issuedAt > Date.now() + 30_000) return false;
  const expected = createHmac("sha256", key)
    .update(`${campaignId}.${publisherAppId}.${placement}.${issuedAt}`)
    .digest("hex");
  try {
    return signature.length === expected.length && timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}