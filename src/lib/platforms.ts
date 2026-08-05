/**
 * Extensible publishing registry for Niza App Store.
 *
 * The upload wizard, validation and store listing all read from this registry,
 * so adding a new application type or game option only requires an entry here.
 *
 * Niza distributes installable Android packages only — websites are never
 * converted into applications, and hosted/URL-only publishing is not offered.
 */

export type PlatformId = "pwa" | "android" | "hybrid" | "ios";

export interface PlatformSpec {
  id: PlatformId;
  label: string;
  short: string;
  /** Long-form explanation shown in the wizard + help sheet. */
  description: string;
  bullets: string[];
  /** Requires an uploaded APK binary. */
  requiresApk: boolean;
  /** Ask for Android-specific fields (min/target SDK, permissions…). */
  androidDetails: boolean;
  /** Can be integrated through the Niza Services SDK. */
  supportsSdk: boolean;
  /** Can be integrated through a Niza-generated link. */
  supportsLink: boolean;
  /** Disabled types are shown as "coming soon" and cannot be selected. */
  enabled: boolean;
}

export const PLATFORMS: PlatformSpec[] = [
  {
    id: "pwa",
    label: "Progressive Web App (PWA APK)",
    short: "PWA APK",
    description:
      "A Progressive Web App that you have already packaged into an Android APK (for example with Bubblewrap or PWABuilder). Upload the finished APK — Niza does not convert websites into Android applications.",
    bullets: [
      "Upload the APK you generated from your PWA",
      "Installed directly on the device like any Android app",
      "Package details are detected automatically from the APK",
      "Every binary is virus-scanned before publishing",
    ],
    requiresApk: true,
    androidDetails: true,
    supportsSdk: true,
    supportsLink: true,
    enabled: true,
  },
  {
    id: "android",
    label: "Native Android APK",
    short: "Android",
    description:
      "A native Android application installed directly on Android devices. Upload the APK you have already built and signed.",
    bullets: [
      "Upload an already-built, signed APK",
      "Installed directly on the device",
      "Android details are detected automatically from the APK",
      "Every binary is virus-scanned before publishing",
    ],
    requiresApk: true,
    androidDetails: true,
    supportsSdk: true,
    supportsLink: true,
    enabled: true,
  },
  {
    id: "hybrid",
    label: "Hybrid Android APK",
    short: "Hybrid",
    description:
      "An application built with a cross-platform framework such as Flutter, React Native, Capacitor, Ionic or Cordova and packaged as an Android APK.",
    bullets: [
      "Upload the packaged Android APK",
      "Tell us which framework you used",
      "Choose SDK integration, link integration, or both",
      "Every binary is virus-scanned before publishing",
    ],
    requiresApk: true,
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
    androidDetails: false,
    supportsSdk: false,
    supportsLink: false,
    enabled: false,
  },
];

export function getPlatform(id: PlatformId | string): PlatformSpec {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[1]!;
}

/** Frameworks offered for hybrid Android packages. */
export const HYBRID_FRAMEWORKS = [
  "Flutter",
  "React Native",
  "Capacitor",
  "Ionic",
  "Cordova",
  "Other",
] as const;

/** Top-level upload category — the very first question in the wizard. */
export type UploadCategory = "app" | "game";

export const GAME_CATEGORIES = [
  "Action",
  "Adventure",
  "Arcade",
  "Board",
  "Card",
  "Casual",
  "Educational",
  "Music",
  "Puzzle",
  "Racing",
  "Role Playing",
  "Simulation",
  "Sports",
  "Strategy",
  "Trivia",
  "Word",
  "Other",
] as const;

/**
 * How a game is played. Multi-select — a game can be, for example, both
 * multiplayer and offline.
 */
export const GAME_TYPES = [
  { id: "single", label: "Single player", hint: "Playable solo from start to finish" },
  { id: "multiplayer", label: "Multiplayer", hint: "Play with or against other people" },
  { id: "online", label: "Online", hint: "Needs an internet connection for core features" },
  { id: "offline", label: "Offline", hint: "Fully playable without an internet connection" },
] as const;

export type GameTypeId = (typeof GAME_TYPES)[number]["id"];

/** Human label for a stored gameplay-mode id. */
export function gameTypeLabel(id: string) {
  return GAME_TYPES.find((t) => t.id === id)?.label ?? id;
}

export const GAME_ENGINES = ["Unity", "Unreal Engine", "Godot", "GameMaker", "Custom", "Other"] as const;

/** Optional game feature flags shown as toggles in the wizard. */
export const GAME_FLAGS = [
  { id: "contains_ads", label: "Contains ads" },
  { id: "has_iap", label: "In-app purchases" },
  { id: "is_multiplayer", label: "Multiplayer" },
  { id: "requires_account", label: "Requires a user account" },
  { id: "has_chat", label: "In-game chat" },
  { id: "online_features", label: "Online features" },
  { id: "offline_mode", label: "Offline mode" },
  { id: "controller_support", label: "Controller support" },
  { id: "cloud_save", label: "Cloud save" },
] as const;

export type GameFlagId = (typeof GAME_FLAGS)[number]["id"];

export const AGE_RATINGS = [
  { id: "everyone", label: "Everyone" },
  { id: "teen", label: "Teen" },
  { id: "mature", label: "Mature 17+" },
] as const;

export type ReleaseChannel = "development" | "public" | "coming_soon";

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
    description: "Release to everyone on Niza.",
    bullets: [
      "Visible throughout Niza App Store",
      "Searchable and listed in categories",
      "Has a public store page",
      "Can be downloaded by all users",
    ],
  },
  {
    id: "coming_soon",
    label: "Coming soon",
    description: "Publish the store page now, release the download later.",
    bullets: [
      "Store page is live immediately",
      "Install is replaced with Pre-register",
      "Users who pre-register are notified the moment you release",
      "Switch to a public release whenever you are ready",
    ],
  },
];

export type IntegrationMethod = "sdk" | "link" | "both";
