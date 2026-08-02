/**
 * Automated pre-publish validation ("security review") for Nova App Store.
 *
 * Pure, dependency-free rules shared by the upload wizard (so developers see
 * problems before they submit) and by the server (so nothing bypasses them).
 * Add a platform to src/lib/platforms.ts and these rules adapt automatically.
 */
import { getPlatform, type PlatformId } from "@/lib/platforms";

export type IssueLevel = "error" | "warning";

export interface ReviewIssue {
  /** Wizard step id this issue belongs to, used to jump the developer there. */
  step: string;
  level: IssueLevel;
  /** What is wrong, in plain language. */
  message: string;
  /** How to resolve it. */
  fix: string;
}

export interface SubmissionForReview {
  platform: PlatformId;
  name: string;
  shortDescription?: string | null;
  description: string;
  category: string;
  tags?: string[];
  iconUrl?: string | null;
  screenshotCount?: number;
  appUrl?: string | null;
  hasBinary?: boolean;
  fileName?: string | null;
  fileSize?: number | null;
  version: string;
  releaseNotes?: string | null;
  privacyPolicyUrl?: string | null;
  developerEmail?: string | null;
  packageName?: string | null;
  permissions?: string[];
}

/** Permissions that deserve an explanation before a build goes public. */
export const SENSITIVE_PERMISSIONS: Record<string, string> = {
  "android.permission.READ_SMS": "reads the user's text messages",
  "android.permission.RECEIVE_SMS": "receives the user's text messages",
  "android.permission.SEND_SMS": "sends text messages",
  "android.permission.READ_CONTACTS": "reads the user's contacts",
  "android.permission.RECORD_AUDIO": "records audio from the microphone",
  "android.permission.CAMERA": "uses the camera",
  "android.permission.ACCESS_FINE_LOCATION": "reads precise location",
  "android.permission.READ_CALL_LOG": "reads the call history",
  "android.permission.REQUEST_INSTALL_PACKAGES": "installs other applications",
  "android.permission.SYSTEM_ALERT_WINDOW": "draws over other applications",
  "android.permission.READ_PHONE_STATE": "reads device and phone identifiers",
};

const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+$/i;
const SEMVER_RE = /^\d+(\.\d+){0,3}$/;
const PACKAGE_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const MAX_BINARY_BYTES = 75 * 1024 * 1024;

export function validateSubmission(s: SubmissionForReview): ReviewIssue[] {
  const spec = getPlatform(s.platform);
  const issues: ReviewIssue[] = [];
  const add = (step: string, level: IssueLevel, message: string, fix: string) =>
    issues.push({ step, level, message, fix });

  if (!spec.enabled) {
    add("platform", "error", `${spec.label} cannot be published yet.`, "Choose a supported application type.");
  }

  // ---- Required metadata ----
  const name = s.name.trim();
  if (name.length < 2) add("name", "error", "The application name is missing or too short.", "Enter a name of at least 2 characters.");
  if (/\b(free|best|top|#1|cracked|mod)\b/i.test(name)) {
    add("name", "warning", "The name contains promotional wording.", "Remove words like 'free', 'best' or 'mod' — they can hurt discovery and be reported as misleading.");
  }
  if (!s.shortDescription?.trim()) {
    add("short", "warning", "No short description was provided.", "Add a one-line summary — it is what users read in search results.");
  }
  const desc = s.description.trim();
  if (desc.length < 10) add("description", "error", "The full description is missing or too short.", "Describe what the application does in at least a few sentences.");
  else if (desc.length < 80) add("description", "warning", "The full description is very short.", "Expand it with a hook and a short feature list to improve installs.");
  if (!s.iconUrl) add("icon", "error", "No application icon was provided.", "Upload a square icon — it is required to publish.");
  if (!s.screenshotCount) add("media", "warning", "No screenshots were added.", "Add at least two screenshots; listings with screenshots convert far better.");
  if (!s.tags?.length) add("category", "warning", "No tags were added.", "Add 5–10 relevant tags so users can find your application.");

  // ---- Platform-specific package / hosting checks ----
  if (spec.requiresApk && !s.hasBinary) {
    add("apk", "error", `${spec.label} requires an application package.`, "Upload the already-built, signed APK for this application.");
  }
  if (s.hasBinary) {
    const ext = (s.fileName ?? "").split(".").pop()?.toLowerCase();
    if (s.fileName && ext !== "apk") {
      add("apk", "error", "The uploaded file is not an APK.", "Only .apk packages are accepted — .aab bundles and archives cannot be installed by users.");
    }
    if (typeof s.fileSize === "number") {
      if (s.fileSize <= 0) add("apk", "error", "The uploaded package is empty.", "Re-export your build and upload it again.");
      else if (s.fileSize < 15_000) add("apk", "error", "The uploaded package looks malformed — it is unusually small for an application.", "Check that you uploaded the release build and not a placeholder file.");
      else if (s.fileSize > MAX_BINARY_BYTES) add("apk", "error", "The package exceeds the 75MB upload limit.", "Reduce the package size or split large assets into a download.");
    }
    if (s.packageName && !PACKAGE_RE.test(s.packageName)) {
      add("apk", "warning", "The package identifier could not be read from the file.", "Confirm the APK is signed and not corrupted before publishing.");
    }
  }
  if (spec.requiresUrl && !URL_RE.test((s.appUrl ?? "").trim())) {
    add("url", "error", `${spec.label} requires a valid public application URL.`, "Enter the full https:// address where your application is hosted.");
  }
  if (s.appUrl?.trim() && !URL_RE.test(s.appUrl.trim())) {
    add("url", "error", "The application URL is not a valid address.", "Use a full URL starting with https://");
  }
  if (s.appUrl?.trim().startsWith("http://")) {
    add("url", "warning", "The application URL is not served over HTTPS.", "Serve your application over https:// — browsers block installs and many features on insecure origins.");
  }

  // ---- Permission analysis ----
  const sensitive = (s.permissions ?? []).filter((p) => SENSITIVE_PERMISSIONS[p]);
  if (sensitive.length) {
    add(
      "apk",
      "warning",
      `This build requests ${sensitive.length} sensitive permission${sensitive.length > 1 ? "s" : ""}: ${sensitive
        .map((p) => SENSITIVE_PERMISSIONS[p])
        .join(", ")}.`,
      "Explain in your description why each of these is needed — unexplained sensitive permissions are the most common reason applications are returned for changes.",
    );
  }
  if ((s.permissions?.length ?? 0) > 30) {
    add("apk", "warning", "This build requests an unusually large number of permissions.", "Remove permissions your application does not actually use.");
  }

  // ---- Release metadata ----
  if (!SEMVER_RE.test(s.version.trim())) {
    add("version", "error", "The version number is not valid.", "Use a numeric version such as 1.0.0.");
  }
  if ((s.releaseNotes ?? "").trim().length < 3) {
    add("version", "error", "Version notes are missing.", "Tell users what is in this release — the notes appear on your store page.");
  }
  if (s.privacyPolicyUrl?.trim() && !URL_RE.test(s.privacyPolicyUrl.trim())) {
    add("privacy", "error", "The privacy policy URL is not a valid address.", "Use a full URL starting with https://");
  }
  if (!s.privacyPolicyUrl?.trim() && (sensitive.length > 0 || !spec.requiresApk)) {
    add("privacy", "warning", "No privacy policy was provided.", "Applications that collect any personal data are expected to publish a privacy policy.");
  }
  if (s.developerEmail?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.developerEmail.trim())) {
    add("contact", "error", "The contact email is not valid.", "Enter an email address you can be reached at.");
  }
  if (!s.developerEmail?.trim()) {
    add("contact", "warning", "No contact email was provided.", "Add one so reviewers and users can reach you about this listing.");
  }

  return issues;
}

export function summarizeIssues(issues: ReviewIssue[]) {
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  return { errors, warnings, blocked: errors.length > 0 };
}

/** Human-readable review states surfaced to developers. */
export const REVIEW_STATES: Record<string, { label: string; description: string; tone: "pending" | "good" | "warn" | "bad" }> = {
  draft: { label: "Draft", description: "Saved but not submitted.", tone: "pending" },
  development: { label: "Development build", description: "Private — shared only through your testing link.", tone: "pending" },
  pending: { label: "In review", description: "Automated checks passed. A reviewer is looking at your submission.", tone: "pending" },
  changes_requested: { label: "Changes requested", description: "A reviewer found issues you need to fix, then resubmit.", tone: "warn" },
  approved: { label: "Approved", description: "Approved and going live.", tone: "good" },
  live: { label: "Live", description: "Published and available to everyone on Nova.", tone: "good" },
  rejected: { label: "Rejected", description: "This submission was rejected. See the reviewer's explanation.", tone: "bad" },
  suspended: { label: "Suspended", description: "Removed from the marketplace by an administrator.", tone: "bad" },
};
