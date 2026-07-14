/** Best-effort Android version detection from user agent. */
export function detectAndroidVersion(): number | null {
  if (typeof navigator === "undefined") return null;
  const m = navigator.userAgent.match(/Android\s+(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return isNaN(v) ? null : v;
}

export function compareAndroid(a: string | null | undefined, b: string | number | null | undefined): number {
  const pa = parseFloat(String(a ?? "0"));
  const pb = parseFloat(String(b ?? "0"));
  if (isNaN(pa) || isNaN(pb)) return 0;
  return pa - pb;
}
