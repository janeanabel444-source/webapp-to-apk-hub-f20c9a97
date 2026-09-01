# Niza App Store — Roadmap

## In progress
- [x] Niza Hub integration layer (`src/lib/niza-hub.server.ts`): SSO, payments, catalog, webhooks
- [ ] Niza Hub credentials (NIZA_APP_ID / NIZA_APP_SECRET / NIZA_WORKSPACE_ID / NIZA_WEBHOOK_SECRET) — needed from the developer console
- [x] Official logo everywhere (header, footer, auth, hero, favicon, PWA icons)

## Permanent download infrastructure
- [ ] `/download/$appId` server route streams the active APK release (no Supabase URLs exposed)
- [ ] Stable link helpers: app page, download, review, share, developer, ad campaign
- [ ] Links survive app updates (always resolve newest active release)

## Reviews
- [ ] Users can edit their own rating/review (update, never duplicate)
- [ ] `/app/$slug?review=1` review link opens the review interface
- [ ] Verified owner developer replies to reviews on their own apps only
- [ ] Admin moderation retained

## Advertising network
- [ ] "Boost Your App" prompt after publish/update, with Remind Me Later snooze
- [ ] Campaign creation prefilled from app store listing (creatives, CTA, placement, budget, duration)
- [ ] Campaign payments through Niza Hub (Paystack fallback), activate only after verification
- [ ] `/ad/$campaignId` attribution link → records click → opens listing
- [ ] Sponsored labelling on every ad surface; card / banner / native / video formats
- [ ] Full-screen video ads with circular 5s countdown then close button
- [ ] Niza Ads SDK/API endpoints for participating apps (serve + report)
- [ ] Analytics: impressions, clicks, page visits, downloads, spend — deduplicated
