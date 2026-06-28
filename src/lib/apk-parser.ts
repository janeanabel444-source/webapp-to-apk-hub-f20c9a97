// Client-only APK parsing. Runs in the browser before upload so we can show
// developers detected metadata + AI-suggested release notes. Falls back
// gracefully — every field is optional.
import AppInfoParser from "app-info-parser/src/apk";

export type ParsedApk = {
  packageName: string | null;
  versionName: string | null;
  versionCode: number | null;
  apkSize: number;
  permissions: string[];
};

export async function parseApkFile(file: File): Promise<ParsedApk> {
  const fallback: ParsedApk = {
    packageName: null,
    versionName: null,
    versionCode: null,
    apkSize: file.size,
    permissions: [],
  };
  if (!/\.apk$/i.test(file.name)) return fallback;
  try {
    const parser = new AppInfoParser(file);
    const info: any = await parser.parse();
    const perms: string[] = Array.isArray(info?.usesPermissions)
      ? info.usesPermissions.map((p: any) => p?.name ?? p).filter(Boolean)
      : Array.isArray(info?.permissions)
        ? info.permissions
        : [];
    return {
      packageName: info?.package ?? info?.packageName ?? null,
      versionName: info?.versionName ?? null,
      versionCode: typeof info?.versionCode === "number" ? info.versionCode : Number(info?.versionCode) || null,
      apkSize: file.size,
      permissions: perms.map((p) => String(p).trim()).filter(Boolean),
    };
  } catch (err) {
    console.warn("APK parse failed; falling back to file size only", err);
    return fallback;
  }
}

export function diffPermissions(prev: string[] | null | undefined, next: string[]) {
  const a = new Set(prev ?? []);
  const b = new Set(next);
  return {
    added: [...b].filter((x) => !a.has(x)),
    removed: [...a].filter((x) => !b.has(x)),
  };
}

export function formatBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
