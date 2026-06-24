# Nova App Store — Play Store Repositioning Plan

Reframes the app around Apps + Games + Developer Hub, with AI image generation pushed into a secondary "AI Tools" area gated by role-based daily limits.

## 1. Information architecture & navigation

Rework `Header.tsx` nav to:
`Apps · Games · Trending · Categories · Developer Hub · AI Tools · Profile`

- "Developer Hub" rendered as a prominent pill (primary color / outline) so it visually stands apart from the rest.
- "AI Tools" replaces the current "Create AI Image" + "AI Gallery" top-level entries; those move into a single `/ai-tools` hub page that links to `/ai-image` and `/ai-gallery`.
- Profile dropdown gains "Developer Hub" link (only visible to authed users).

## 2. Home page redesign (`src/routes/index.tsx`)

Replace current AI-forward layout with Play Store–style sections, in order:

1. Hero: "Welcome to Nova App Store — Discover apps and games in one place".
2. Featured Apps (carousel, `is_featured=true` + `category='app'`).
3. Featured Games (carousel, `is_featured=true` + `category='game'`).
4. Trending Apps (top by `install_count`, last 30 days).
5. Trending Games (same, category=game).
6. Categories grid (Productivity, Social, Games – Action, Puzzle, etc.).
7. Small "Are you a developer? Publish on Nova" CTA card linking to `/developer`.
8. Tiny "AI Tools" card at the bottom (secondary, no longer the hero).

## 3. Trending & Categories routes

- `src/routes/trending.tsx` — combined trending list with tabs (Apps / Games), sorted by `install_count` desc.
- `src/routes/categories.tsx` — grid of category chips. Clicking filters via `/apps?category=` or `/games?category=`. Update `apps.tsx` / `games.tsx` to read `category` search param via TanStack search.

## 4. Developer Hub (core new feature)

New routes under `_authenticated/developer/`:

- `developer/index.tsx` — dashboard listing the developer's uploaded apps, with download counts and status badges (Pending / Approved / Live). "Upload new app" CTA.
- `developer/new.tsx` — upload form.
- `developer/$appId.edit.tsx` — edit existing app.

Upload form fields:
- App Name (required)
- App Logo (required; blocks submit if missing — uploaded to new `app-logos` storage bucket, public)
- Description (required)
- Category: App | Game (required)
- Subcategory (free text / select)
- Platform: Web | PWA | Android wrapper (required)
- App URL OR uploaded app file (one required; file → `app-files` private bucket)
- Screenshots (optional, multi-upload → `app-screenshots` public bucket)

DB schema changes (single migration):
- Extend `apps` table: add `developer_id uuid references auth.users`, `status text default 'pending'` (`pending|approved|live|rejected`), `platform text`, `app_url text`, `file_path text`, `screenshots text[]`. Keep existing `icon_url` as the logo.
- RLS: developers can `INSERT` rows where `developer_id = auth.uid()`; can `UPDATE/DELETE` own rows while `status != 'live'`; can `SELECT` own rows always. Public `SELECT` restricted to `status='live'` (so pending apps don't show on home).
- Admin role (via existing `has_role`) can update any row's status (approval workflow).
- New storage buckets: `app-logos` (public), `app-screenshots` (public), `app-files` (private). RLS scoped to `developer_id` folder.

Server functions (`src/lib/developer.functions.ts`):
- `createApp`, `updateApp`, `listMyApps`, `getAppForEdit`, `submitForReview`.
- All require `requireSupabaseAuth`.

## 5. Role-based AI limits

Roles already exist (`user`, plus we add `developer`, `jasper_ai`, `admin` to the `app_role` enum).

Daily limits:
- `user` → 0/day (must upgrade or redeem promo)
- `jasper_ai` → 20/day
- `developer` → 0/day (no AI perk by default)
- `admin` → unlimited
- Premium subscribers → keep existing premium allowance (treated as 20/day too).

Implementation:
- New table `ai_image_usage(user_id, used_on date, count int, primary key(user_id, used_on))` with RLS owner-only select; service-role writes.
- Update `generateImage` server fn (`src/lib/stability.functions.ts`):
  1. Resolve highest role for user.
  2. Compute daily quota.
  3. Upsert today's row, increment, reject if over quota.
  4. Admin short-circuits the check.
- Promo code "Jasper AI" (case-sensitive) in existing `promo_codes` flow now grants the `jasper_ai` role via `user_roles` insert instead of (or in addition to) premium flag. Update `redeemPromoCode` accordingly; keep existing JASPER AI permanent-premium code as a separate row or migrate it.

## 6. AI Tools area

- New `src/routes/_authenticated/ai-tools.tsx` — hub page describing AI features with cards linking to `/ai-image` (generate) and `/ai-gallery` (browse). Shows remaining daily quota for current user.
- `/ai-image` page updated to show "X of Y generations remaining today" and clear messaging when quota = 0 (with "Redeem promo code" + "Go Premium" buttons).

## 7. Auth & profile touches

- Auth flow unchanged (Google + email), but on signup default role stays `user`.
- Profile menu shows current role badge.

## 8. Out of scope (intentionally deferred)

- Actual malware scanning beyond VirusTotal hook (already wired) — keep current behavior.
- Android wrapper build pipeline — store the URL only.
- Manual admin approval UI — schema + status field land now; admin review screen can be a follow-up.

---

## Technical notes

- All schema work goes in one migration with explicit `GRANT`s and RLS per project rules.
- Storage buckets created via `supabase--storage_create_bucket` (not SQL).
- Role checks use existing `has_role` security-definer function; extend `app_role` enum with `developer` and `jasper_ai`.
- Search-param filtering on `/apps` and `/games` uses TanStack Router `validateSearch`.
- All server functions live in `src/lib/*.functions.ts`; protected functions called from `_authenticated/` routes only.
- Header reorders nav; the AI top-level links are removed in favor of a single "AI Tools" entry to enforce the "AI is secondary" rule.

Once you approve, I'll start with the migration + storage buckets, then Developer Hub, then the home/nav redesign, then the AI quota system.
