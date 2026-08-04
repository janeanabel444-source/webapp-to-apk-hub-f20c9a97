# Niza App Store — rebrand, split app/game publishing, privacy & install fixes

Nothing existing gets removed except web/URL-only publishing, which you asked to drop. All current features (ads, AI tools, premium, admin, reviews, MCP) stay intact.

## 1. Rebrand to Niza App Store

- Replace every user-visible "Nova" with "Niza": header, footer, landing/welcome page, auth, store pages, developer hub, admin dashboard, upload wizard, notifications, share/testing links, contact page, PWA manifest, service worker, page titles and meta descriptions.
- Rename the Android wrapper interface from `NovaAndroid` to `NizaAndroid` (your choice — the current wrapper build will need a rebuild to regain install/open features).
- "Nova Services SDK" / "Nova Review Link" become "Niza Services SDK" / "Niza Review Link".

## 2. Upload wizard: category first, then type

New first step after the intro screen: **Choose Upload Category** — Application or Game. The two paths then diverge.

Application types (APK required in all cases, no URL fields anywhere):
1. Progressive Web App (PWA APK)
2. Native Android APK
3. Hybrid Android APK (Flutter, React Native, Capacitor, Ionic, Cordova, other)
4. iOS Application — shown as Coming Soon, disabled

Removed entirely: Web App / hosted app / "runs from the web" / "no APK required" / URL-install options, in the wizard, the platform registry, validation, and store pages.

Game path asks its own questions: game name, short and long description, game category (Action … Other, full list), game type (single/multiplayer/online/offline/online+offline), optional engine (Unity, Unreal, Godot, Other), then game media (icon, feature graphic, screenshots, gameplay video) and game flags: age rating, contains ads, in-app purchases, multiplayer, user accounts, chat, online features, offline mode, controller support, cloud save.

## 3. Game store page

Games get their own detail layout: "About this game", "Similar games", "More games from this developer", plus genre, age rating, gameplay video, screenshots, downloads, ratings and reviews.

## 4. APK analysis

Keep the current in-browser analyzer (name, package, version name/code, size, permissions, min/target Android) and fix the "Reading APK" stall: run analysis in a worker-safe path with a hard timeout, always show either results or a readable error with a manual-continue option. Extracted fields are never re-asked.

## 5. Privacy policy system

- Every workflow includes a Privacy Policy URL step. Initially Skip is enabled and Next is disabled; entering a valid URL enables Next and hides Skip.
- After APK analysis, scan the package for privacy/terms/legal links. If found: "Privacy Policy Detected — We found a Privacy Policy inside your application", with Use Detected / Review Policy / Keep Existing Choice.
- Data-collection check from permissions and declared flags (account, email, location, camera, microphone, contacts, analytics, ad IDs, cloud data, user content). If data is collected and there is no URL and no detected in-app policy, publishing is blocked with "Privacy Policy Required" and an explanation.

## 6. Niza SDK / Review link step

Before final submission the developer must pick Niza Services SDK or Niza Review Link, with generated Review, Store, App Page and Share links plus the integration explanation.

## 7. Security scan and publishing flow

- Submit for Review sends the APK to VirusTotal; malware, suspicious files, dangerous permissions and threats block publishing and return the scan findings and required fixes to the developer, who can resubmit.
- Final review page keeps Back / edit-any-answer / Submit for Review.
- Success screen: "Application Published Successfully" (or "Game Published Successfully") with Public App Page, Download, Share, Review and Developer URLs, each with Copy, Open and Share buttons.

## 8. Admin

- Both `novaservices.org1@gmail.com` and `paschalsoromtochukwu@gmail.com` stay permanent super admins (granted only on verified email, no other account can be promoted from the client).
- Admin dashboard gains explicit Game Management alongside App, Developer, Review, Security and Approval controls.
- Admin uploads skip the approval queue and publish immediately, but still run the security scan.

## 9. Install / open / uninstall

- Install triggers the APK install immediately (native installer inside the wrapper, download+installer hint in the browser).
- Once installed, show Open and Uninstall: Open launches the package, Uninstall goes through the Android uninstall flow and then clears local install state.
- Fix stale "installed" detection and the Install button lingering after install by verifying package state through the bridge and refreshing install queries.
- Fix the spurious "sign in again" errors on install by reusing the live session instead of a stale token.

## Technical notes

- Migration: add game-specific columns to `apps` (`content_type` app/game, `game_category`, `game_type`, `game_engine`, and the boolean feature flags), plus `privacy_policy_source` / `detected_privacy_url`; keep existing columns and RLS untouched, with grants for the new state.
- `src/lib/platforms.ts` becomes the single registry for both application types and game types; `requiresUrl` and the web/PWA-URL specs are removed.
- Wizard work is in `src/routes/_authenticated/developer.new.tsx` (split into category → type → path-specific steps) with server validation mirrored in `src/lib/review.ts` and `src/lib/developer.functions.ts`.
- Install logic in `src/components/InstallButton.tsx`, `src/lib/apk-download.ts` and `src/lib/native-bridge.ts` (adds `uninstallPackage`, uses `NizaAndroid`).
- Also fixing a hydration mismatch on the app detail page caused by locale date formatting.
