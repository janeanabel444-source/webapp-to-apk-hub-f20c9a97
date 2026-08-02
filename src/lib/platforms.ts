/**
 * Extensible platform registry for Nova App Store.
 *
 * Add a new application type by appending an entry here — the upload wizard,
 * validation and store listing all read from this registry, so no other file
 * needs to change to support a new platform.
 */

export type PlatformId = "pwa" | "web" | "android" | "hybrid" | "ios";

export interface PlatformSpec {
  id: PlatformId;
  label: string;
  short: string;
  /** Long-form explanation shown in the wizard + help sheet. */
  description: string;
  bullets: string[];
  /** Requires an uploaded APK binary. */
  requiresApk: boolean;
  /** Requires a hosted application URL. */
  requiresUrl: boolean;
  /** Ask for Android-specific fields (min/target SDK, permissions…). */
  androidDetails: boolean;
  /** Can be integrated through the Nova Services SDK. */
  supportsSdk: boolean;
  /** Can be integrated through a Nova-generated link. */
  supportsLink: boolean;
  /** Disabled types are shown as "coming soon" and cannot be selected. */
  enabled: boolean;
}

export const PLATFORMS: PlatformSpec[] = [
  {
    id: "pwa",
    label: "Progressive Web App (PWA)",
    short: "PWA",
    description:
      "A Progressive Web App is a web application that behaves like an installable application. It runs from the web, can be installed on supported devices, and updates automatically whenever you deploy your website.",
    bullets: [
      "Runs from the web — no APK required",
      "Installable on supported devices",
      "Updates through your web application",
      "No Android-specific publishing information needed",
    ],
    requiresApk: false,
    requiresUrl: true,
    androidDetails: false,
    supportsSdk: false,
    supportsLink: true,
    enabled: true,
  },
  {
    id: "web",
    label: "Web Application",
    short: "Web",
    description:
      "A standard web application that users open in their browser. Nova lists it, handles discovery and reviews, and sends users straight to your hosted application.",
    bullets: [
      "Opens in the browser",
      "No installation step for users",
      "You keep full control of hosting and updates",
    ],
    requiresApk: false,
    requiresUrl: true,
    androidDetails: false,
    supportsSdk: false,
    supportsLink: true,
    enabled: true,
  },
  {
    id: "android",
    label: "Native Android APK",
    short: "Android",
    description:
      "A native Android application installed directly on Android devices. Upload the APK you have already built and signed — Nova does not convert websites into Android applications.",
    bullets: [
      "Upload an already-built, signed APK",
      "Installed directly on the device",
      "Android details are detected automatically from the APK",
      "Every binary is virus-scanned before publishing",
    ],
    requiresApk: true,
    requiresUrl: false,
    androidDetails: true,
    supportsSdk: true,
    supportsLink: false,
    enabled: true,
  },
  {
    id: "hybrid",
    label: "Hybrid Application",
    short: "Hybrid",
    description:
      "A hybrid application combines a web experience with a native shell. You can integrate with Nova through the Nova Services SDK, through a Nova-generated link, or through both.",
    bullets: [
      "Upload an APK, provide a hosted URL, or both",
      "Choose SDK integration, link integration, or both",
      "Android details are collected only when an APK is provided",
    ],
    requiresApk: false,
    requiresUrl: false,
    androidDetails: true,
    supportsSdk: true,
    supportsLink: true,
    enabled: true,
  },
  {
    id: "ios",
    label: "Native iOS Application",
    short: "iOS",
    description:
      "Native iOS publishing is being prepared. The publishing workflow is already architected for it and will be enabled once distribution is available.",
    bullets: ["Coming soon"],
    requiresApk: false,
    requiresUrl: false,
    androidDetails: false,
    supportsSdk: false,
    supportsLink: false,
    enabled: false,
  },
];

export function getPlatform(id: PlatformId): PlatformSpec {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0];
}

export type ReleaseChannel = "development" | "public";

export const RELEASE_CHANNELS: {
  id: ReleaseChannel;
  label: string;
  description: string;
  bullets: string[];
}[] = [
  {
    id: "development",
    label: "Development build",
    description: "For testing before a public release.",
    bullets: [
      "Hidden from the public marketplace",
      "Accessible only through a private testing link you share",
      "Does not appear in search results or categories",
      "Can be switched to a public release later — no new listing needed",
    ],
  },
  {
    id: "public",
    label: "Public release",
    description: "Release your application to everyone on Nova.",
    bullets: [
      "Visible throughout Nova App Store",
      "Searchable and listed in categories",
      "Has a public application page",
      "Can be downloaded by all users",
    ],
  },
];

export type IntegrationMethod = "sdk" | "link" | "both";
