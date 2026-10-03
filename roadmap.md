# Niza App Store — Roadmap

## In progress
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
- [ ] Android wrapper must implement the documented contract — blocked: native code lives outside this project

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
