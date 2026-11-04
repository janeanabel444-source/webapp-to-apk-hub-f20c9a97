# Niza App Store — Roadmap

## In progress
- [x] Allow APK uploads up to 80 MB (TUS resumable upload + Wake Lock — wired into publish wizard and update page, with cancel and progress persistence)
- [x] VirusTotal 4/min queue, fail-closed "verifying" gate, scan ID/score/permalink on app_versions
- [x] Binary permissions + certificate fingerprint lock (zero-tolerance rejection, no admin review)
- [x] Expanded developer edit page (banner, icon, screenshots add/delete/reorder, category, tags, links — APK binary excluded)
- [x] InstallButton: cancel button, 700ms progress throttle (100%/error instant), direct native uninstall
- [x] Account settings: photo, display name, email, password; Account navigation
- [x] Native foreground refresh + package identity verified across listings
- [x] Domain cleanup: STORE_URL, FALLBACK_ORIGIN, share fallback and app-page download link all point at https://niza-app-store.lovable.app
- [x] Default og:image / twitter:image share banner (1200x630 at /og-banner.jpg) + twitter:card summary_large_image
- [x] Library: uninstall action on every library row; "Updates available" counter banner and per-app update badges
- [x] Google Search Console verification meta + /sitemap.xml + /robots.txt (sitemap serves static pages, live apps and published collections; anon EXECUTE on private.is_admin granted so collections resolve)
- [x] TUS resumable APK uploads wired into upload + update flows (wake lock, cancel)
- [x] TypeScript check passes; /sitemap.xml returns 200, robots.txt serves with Sitemap directive
- [x] Niza Hub integration layer (`src/lib/niza-hub.server.ts`): SSO, payments, catalog, webhooks
- [x] Niza Hub credentials (NIZA_APP_ID / NIZA_APP_SECRET / NIZA_WORKSPACE_ID / NIZA_WEBHOOK_SECRET)
- [x] Official logo everywhere (header, footer, auth, hero, favicon, PWA icons)

## Permanent download infrastructure
- [x] `/download/$appId` server route streams the active APK release (no Supabase URLs exposed)
- [x] Stable link helpers: app page, download, review, share, developer, ad campaign
- [x] Links survive app updates (always resolve newest active release)

## Native Android bridge
- [x] Capability handshake, Capacitor + legacy interface, browser fallback
- [x] Native download with real byte progress, install, open, uninstall, version detection
- [x] Android wrapper code in `android/` (NizaBridge.kt, MainActivity.kt, manifest)

## Reviews
- [x] Users can edit their own rating/review
- [x] `/app/$slug?review=1` opens the review interface
- [x] Owner developer replies to reviews
- [x] Admin moderation retained

## Advertising network
- [x] "Boost Your App" prompt with Remind Me Later / dismiss
- [x] Campaign creation
- [x] Campaign payments via Niza Hub (Paystack fallback), verified per provider before review
- [x] `/ad/$campaignId` attribution link
- [x] Admin campaign moderation
- [x] Niza Ads SDK endpoints (`/api/public/ads/serve`, `/api/public/ads/report`)
- [x] Video ads: close button gated behind 5s circular countdown
- [x] Developer analytics dashboard (views, clicks, downloads, spend per app)
