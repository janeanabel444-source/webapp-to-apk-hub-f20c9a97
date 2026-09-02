/**
 * Stable, permanent link helpers for Niza App Store.
 *
 * Every link below is content-addressed by app id / slug — never by a
 * signed storage URL — so links keep working across app updates.
 */

export const FALLBACK_ORIGIN = "https://webapp-to-apk-hub.lovable.app";

export function siteOrigin() {
  if (typeof window === "undefined") return FALLBACK_ORIGIN;
  return window.location.origin;
}

/** Public store listing for an app or game. */
export function appPageUrl(slug: string, origin = siteOrigin()) {
  return `${origin}/app/${slug}`;
}

/**
 * Permanent download link. Always streams the newest active APK release,
 * with no redirect, extra page or expiring storage URL.
 */
export function appDownloadUrl(appId: string, origin = siteOrigin()) {
  return `${origin}/download/${appId}`;
}

/** Opens the listing with the review composer focused. */
export function appReviewUrl(slug: string, origin = siteOrigin()) {
  return `${origin}/app/${slug}?review=1`;
}

/** Share link (adds an attribution marker for the developer's own promos). */
export function appShareUrl(slug: string, origin = siteOrigin()) {
  return `${origin}/app/${slug}?ref=share`;
}

/** Developer's private management page for an app. */
export function developerAppUrl(appId: string, origin = siteOrigin()) {
  return `${origin}/developer/${appId}`;
}

/** Ad attribution link — records the click, then opens the listing. */
export function adCampaignUrl(campaignId: string, origin = siteOrigin()) {
  return `${origin}/ad/${campaignId}`;
}
