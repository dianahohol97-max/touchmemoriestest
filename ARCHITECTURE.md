# TouchMemories — Architecture

> **Last updated:** 2026-04-29 · **Maintained by:** Diana + Claude
> **Production:** touchmemories1.vercel.app
> **Repo:** github.com/dianahohol97-max/touchmemoriestest
> **Read this first** before any feature work or debugging session. Update at the bottom of any major change.

---

## How to use this doc

This is a **living map** — the index of where things live, why, and how they connect. It is intentionally short. For deep details, follow the links it points to.

When something breaks or you need to add a feature, the order of operations is:

1. Read the **Quick map** below to find the right area
2. Open the files listed for that area
3. Follow internal cross-references in code if you need to go deeper
4. After major changes — **update this file** in the relevant section

The 47 markdown files in the repo root are historical (per-feature implementation summaries). They are useful as context but they are NOT the source of truth. **This file is.** When in doubt, this file wins.

---

## Quick map — where does X live?

| Area | Primary location | Notes |
|---|---|---|
| Public storefront (UA/EN/RO/PL/DE) | `app/[locale]/` | All customer-facing routes are localised |
| Admin panel | `app/admin/` | NOT localised, Ukrainian-only UI |
| API routes | `app/api/` | 98 routes, see `app/api/` for organisation |
| Photobook / travel book editor | `components/BookLayoutEditor.tsx` (6175 lines) + `components/editor/*` | The big one. See "Editor architecture" below |
| Cover editor (separate) | `components/CoverEditor.tsx` | Renders book covers; called from BookLayoutEditor |
| Editor data (templates, fonts, slots) | `lib/editor/` | All editor logic that is not React — types, constants, templates, slots, pricing |
| Frames feature | `components/FramesLayer.tsx` (451 lines) | PNG + SVG frames overlay |
| Free-floating photo slots | `components/FreeSlotLayer.tsx` | Used in editor for non-template slot placement |
| Cart + checkout | `store/cart-store.ts`, `app/[locale]/cart/`, `app/[locale]/checkout/` | Zustand store + Next pages |
| Designer cabinet | `components/designer-service/` + `app/admin/designer/` + `lib/designer-service/` | Lifecycle: brief → assignment → revisions → delivery |
| AI chatbot for site visitors | `lib/ai/claude-chat.ts` + `lib/chatbot/` + `app/admin/settings/chatbot/` | Anthropic SDK, system prompt configurable in admin |
| Photobooth (event product) | `components/photobooth/` + `lib/photobooth/` + `app/[locale]/photobooth/` | Separate sub-product, has its own state |
| Star map / astronomy products | `lib/astronomy/` + `astronomy-engine` package | Generates personalised sky maps from date+place |
| Email (transactional + marketing) | `components/email/` (React Email) + `lib/email/` + `emails/` | Brevo as the sender |
| Internationalisation | `lib/i18n/` + `locales/{uk,en,ro,pl,de}.json` | Server-side via context, client via `useT()` hook |
| Translations in DB | `translations` JSONB column on `products`, `categories`, `footer_sections` etc. | `getLocalized()` helper applies it. Footer i18n still incomplete — see Known gaps |
| Supabase client | `lib/supabase/client.ts` (browser) · `lib/supabase/server.ts` (RSC) · `lib/supabase/admin.ts` (service role) | Three separate clients, do NOT mix |
| Supabase migrations | `supabase/migrations/` | Run via Supabase CLI |
| Schema reference | `lib/supabase/schema/*.sql` | Authoritative reference for table shapes |
| Pricing engine | `lib/editor/pricing.ts` (pure) + `lib/editor/usePrices.ts` (client hook) + `app/api/pricing/photobook/route.ts` (server) | Photobook prices live in Supabase (`photobook_prices` table). API endpoint caches the matrix for 60s; the client hook fetches it and stores it in localStorage so the editor never shows a "0 ₴" flicker on repeat visits. `pricing.ts` itself is pure — all functions take a `PriceTable` argument. See "Pricing flow" below |
| Salary calculator | `lib/salary/` + `app/admin/expenses/` | For team payroll |
| Reporting | `lib/reporting/` + `app/admin/analytics/` | Dashboards, automated weekly reports |
| Automation rules | `lib/automation/` + `app/admin/automations/` | Deadline calc, assignment, telegram + email notifications |
| Shipping (Nova Poshta etc.) | `lib/shipping/` | Carrier integrations |
| Certificates (gift cards) | `lib/certificates/` + `app/admin/certificates/` | Code generation, validation |
| Blog | `app/admin/blog/` + `app/[locale]/blog/` | MD editor in admin via @uiw/react-md-editor |

---

## High-level stack

- **Framework:** Next.js 16 (Turbopack) App Router · TypeScript
- **Styling:** Tailwind + shadcn/ui (Radix primitives)
- **Database:** Supabase (Postgres + Auth + Storage)
- **Hosting:** Vercel (team `team_Qve9hriFT9sNYnjWZolAcFXl`, project `prj_Oz13dkGF3W1JvSVToT8WvZBseBba`)
- **Payments:** Monobank (UA + international dual-account routing)
- **Email:** Brevo
- **AI:** Anthropic SDK (chatbot, generation tasks)
- **Drag/drop:** dnd-kit
- **Canvas / image editing:** Fabric.js, html2canvas, jspdf
- **Background removal:** @imgly/background-removal
- **Maps for shipping:** Leaflet
- **Star maps:** d3-celestial + astronomy-engine

---

## Editor architecture (the big one)

The photobook/travel book editor is the most complex part of the codebase. **80% of "I can't find why this is broken" debugging happens here.** Read this section before touching it.

### Core files
- **`components/BookLayoutEditor.tsx`** — the main editor (6175 lines). State, layout, photo placement, text, frames, stickers, navigation, save/preview/order. This file is the editor.
- **`components/CoverEditor.tsx`** — separate cover editor, called by BookLayoutEditor for the cover spread.
- **`components/FramesLayer.tsx`** — overlay layer for PNG + SVG frames on a page.
- **`components/FreeSlotLayer.tsx`** — non-template free-floating photo slots with their own DPI checks.
- **`components/BookPreviewModal.tsx`** — preview of the finished book. Renders backgrounds, photo slots, frames (PNG+SVG), shapes, stickers, QR overlays, and the kalka page. Multi-slot layout rendering is still pending — it currently uses single-slot getSlotDefs only.

### Supporting files in `lib/editor/`
- **`types.ts`** — `PhotoData`, `BookConfig`, `CoverState`, `CoverDecoType`, `LayoutType` etc.
- **`constants.ts`** — 98 fonts (`FONT_GROUPS`, `FONT_DATA` with `cyr` flag), `GOOGLE_FONTS_URL`, decoration variants (acryl, photovstavka, flex, metal, gravira), leatherette/fabric/velour colours
- **`page-templates.ts`** — 64 spread layouts (`PAGE_TEMPLATES`)
- **`cover-templates.ts`** — 30+ cover presets, filterable by `tags` (`photobook` / `magazine` / `journal` / `travelbook` / `wishbook`)
- **`slot-defs.ts`** — slot geometry definitions for each layout
- **`auto-build.ts`** — automatic spread building from a photo set
- **`pricing.ts`** — dynamic price calculation: base + cover + size + pages + decorations + kalka + endpaper

### Editor sub-components in `components/editor/`
- **`FontPicker.tsx`** — visual font picker with previews. **Note:** the `kalka` (acid paper) flow still uses a basic `<select>` with 10 fonts — replacing it is a known TODO.
- **`CoverTemplatesPicker.tsx`** — filtered by `productType`
- **`PageTemplatesPicker.tsx`** — spread layout picker
- **`AutoBuildModal.tsx`** — guides the user through auto-build
- **`PhotoPanel.tsx`, `PhotoEditingPanel.tsx`** — photo upload, crop, zoom inside slot
- **`TextPropertiesPanel.tsx`** — text styling
- **`TemplatePanel.tsx`, `EditorSidebar.tsx`, `EditorToolbar.tsx`, `EditorTopBar.tsx`** — UI shells
- **`SpreadNavigation.tsx`** — page-by-page navigation
- **`PreviewModal.tsx`** — local-scope preview (different from the BookPreviewModal at component root)

### Product types the editor handles
The editor switches behaviour based on slug:
- `photobook` (photo book — default)
- `travelbook` (travel book)
- `magazine` / `journal` / `zhurnal` (glossy magazine — different cover templates, different fonts)
- `wishbook` (wishbook — cover-only, simplified UI, hides spread navigation)

The product-type detection is in BookLayoutEditor via `_slug.includes('...')` checks.

### Known editor pain points (debug-time savers)
- **Antigravity sometimes pushes broken `useT()` placement.** Run `npx tsc --noEmit | grep error TS | grep -v TS2307` after pulling. The `TS2307` filter is intentional — it ignores module-not-found errors that are not relevant.
- **i18n in DB-driven content** (Footer, products, categories) requires the `getLocalized()` helper. Footer still uses raw fields in some places — this is a known incomplete task.
- **Frames are currently overlays only.** They render on top of photos but the photo isn't constrained to the transparent area of the frame. Making frames into actual photo slots (PNG-on-top, photo underneath in transparent zone, with crop/zoom inside the frame) is the biggest open editor task.
- **`BookPreviewModal` does not yet support:** multi-slot layouts (uses single-slot getSlotDefs), crop/zoom inside slots (photos render with objectFit:cover only). Frames, shapes, stickers, QR overlays, and cover stickers ARE rendered.
- **`SpreadNavigation` keyboard arrow keys** sometimes conflict with text-editing inside slots — this is by design (focus check), but it can confuse first-time editors.

### Overlay z-order (unified layer stack)

All four overlay types — text blocks, shapes, stickers, QR codes — share a single z-order namespace per page via an optional `zOrder?: number` field on each object. This lets the user freely interleave them: text under a coloured rectangle, sticker above a frame, etc. Rendering uses `zIndexFor(obj.zOrder)` from `lib/editor/zOrder.ts`, which returns `Z_OVERLAY_BASE (100) + (zOrder ?? 0)` — putting the whole overlay stack above photo slots (zIndex 2) and below editor chrome (zIndex 50+).

When the user selects an overlay (click/tap), a small floating `ZOrderToolbar` (`components/editor/ZOrderToolbar.tsx`) appears with four buttons: send to back / send backward / bring forward / bring to front. The toolbar is rendered as a sibling inside the overlay's wrapper, so it sticks above the selected element. Handlers funnel through `zOrderAction(kind, id, pageIdx, action)` in `BookLayoutEditor`, which dispatches to the right slice of state (pages.textBlocks, pageShapes, pageStickers, qrOverlays). All four mutations push history before applying so undo works.

When a new overlay is created (`addShape`, new text, new sticker, new QR), it gets `zOrder: nextOverlayZ(pageIdx)`, which is `max(zOrder) + 1` across ALL overlay types on that page — so newly-placed objects always land on top of the current stack.

`zOrder` is intentionally optional (`?: number`) so saved projects from before this feature continue to render. Undefined is treated as 0 everywhere — old objects appear at the bottom of the new layer system and the user can re-stack them via the toolbar.

Cover overlays (pageIdx === 0) don't have the z-order toolbar yet — covers are simpler decoration surfaces and there hasn't been demand. The infrastructure is type-compatible (Shape/sticker types include zOrder), so adding it is a small follow-up if needed.

---

## Pricing flow

Photobook prices are NOT hardcoded in the codebase. They live in Supabase, in the `photobook_prices` table (joined to `cover_types` and `photobook_sizes`). Three components work together:

1. **`app/api/pricing/photobook/route.ts`** — GET endpoint, server-side. Reads the full matrix (~466 rows) from Supabase, flattens it into a `{ cover_type, size, page_count, base_price, kalka_surcharge }` shape, returns JSON. Uses Next.js `revalidate = 60`, so price changes propagate to prod within 60s of a migration without redeploy.

2. **`lib/editor/usePrices.ts`** — client React hook (`usePhotobookPrices`). On mount, seeds state from `localStorage` (24h TTL) for instant first paint, then fetches `/api/pricing/photobook` in the background and updates state if anything changed. Returns `{ table, loading, error }`. Used by `BookLayoutEditor`, `EditorTopBar`, and the photobook product page.

3. **`lib/editor/pricing.ts`** — pure module. All exported functions (`lookupPrice`, `lookupPriceWithKalka`, `findPriceRow`, `calculateDynamicPrice`) take a `PriceTable` (or `null` for the fallback path) as their first argument. Knows nothing about React, fetch, or Supabase. Handles cover-type aliasing (`Velour` / `велюр` / `Velvet` → canonical `Велюр`), size normalisation (`20x30` → `20×30`), nearest-page-count fallback, and graceful null-table fallback to the price the user already saw.

**Why this shape:** the editor route uses `dynamic: 'force-dynamic'` + `ssr: false` (the editor needs browser APIs and is 200KB+), so a Server Component cannot pass prices in as a prop. Going through a thin API route lets us keep server-side caching while still letting the client refresh on its own schedule.

**Tracing paper ("калька") on the product page is not added to the displayed price** — the radio is intentionally lead-gen ("ціна уточнюється"). The editor, where kalka is part of the live config, does add the `kalka_surcharge` from the DB.

**Historical note:** Until 2026-05-14, `pricing.ts` shipped a hardcoded ~150-row table. The table drifted from the DB — `velour_20×30` was missing entirely, so the editor showed 1200₴ instead of 1985₴ for velour 20×30 / 10pp / +kalka. The hardcoded table has been removed; the DB is now the single source of truth.

---

## Routing & i18n

- All public routes live under `app/[locale]/` — locale is one of `uk`, `en`, `ro`, `pl`, `de`
- Default locale: `uk`
- Middleware handles locale detection and redirects (`proxy.ts`)
- Static labels: `locales/{locale}.json` files, accessed via the `useT()` hook
- DB-driven content (product names, category names, footer sections etc.) uses a `translations` JSONB column with shape `{ uk: {...}, en: {...}, ro: {...}, pl: {...}, de: {...} }`
- The `getLocalized(record, field, locale)` helper in `lib/i18n/localize.ts` reads `translations[locale].field || record.field` (fallback to base column)

---

## Data model — key tables

(Authoritative shapes are in `lib/supabase/schema/*.sql` and `supabase/migrations/`. This list is for orientation only.)

- **`products`** — catalog items, has `translations` JSONB
- **`product_variants`** — sizes, covers, options
- **`categories`** — has `translations` JSONB
- **`orders`** — order header
- **`order_items`** — line items
- **`customers`** — accounts (linked to Supabase auth)
- **`carts`** — abandoned + active carts
- **`reviews`** — customer reviews
- **`certificates`** — gift cards
- **`design_orders`** — designer service workflow
- **`designer_assignments`** — designer ↔ order linking
- **`expenses`** — finance module
- **`salary_records`** — payroll
- **`automation_rules`** — automation config
- **`email_promo_*`** — email marketing
- **`ai_chat_*`** — chatbot conversations
- **`photobook_projects`** — legacy table, last writes March 2026. New saves go to `projects`
- **`projects`** — saved editor sessions (photobook, travelbook, magazine, wishbook). Columns: `pages_data`, `cover_data`, `overlays_data`, `uploaded_photos`. The `overlays_data` jsonb bundle holds `pageStickers`, `pageShapes`, `pageBgs`, `freeSlots`, `qrOverlays`, `generatedQRCount` — everything the editor renders on top of `pages_data` that wouldn't otherwise be persisted
- **`reporting_*`** — analytics aggregations
- **`footer_sections`** — site footer content (has `translations` JSONB, application is incomplete — see Known gaps)
- **`material_*`, `inventory_*`** — production materials
- **`team_members`** — staff
- **`shipping_*`** — Nova Poshta + other carriers
- **`birthday_*`** — customer birthday tracking for marketing

---

## Deployment

- **Auto-deploy:** Vercel deploys main branch on every push.
- **Manual deploy hook (when GitHub→Vercel webhook fails):**
  `POST https://api.vercel.com/v1/integrations/deploy/prj_Oz13dkGF3W1JvSVToT8WvZBseBba/e1HuPQmmq1`
  Call from browser DevTools fetch or curl on your machine — `api.vercel.com` is **not** in the bash allowlist for Claude tool runs.
- **Daily limit:** Vercel may queue deploys with `state: PENDING` after hitting the daily prod limit. Wait it out or schedule the next day.

### Session start protocol (when collaborating with Antigravity)
Antigravity often pushes to the same repo concurrently. Always start with:
```bash
git fetch origin && git reset --hard origin/main
```
After making changes, before pushing, rebase and check for conflicts. If Antigravity already applied something similar, cherry-pick only the new commits.

### Patch protocol
Use `str_replace` for code patches, **not** `git apply`. The `git apply` workflow has caused issues in past sessions.

### TypeScript check
```bash
npx tsc --noEmit | grep error TS | grep -v TS2307
```
The `-v TS2307` filter intentionally hides module-not-found errors that are not relevant to current changes.

---

## External services & keys

| Service | Purpose | Where configured |
|---|---|---|
| Supabase | DB + Auth + Storage | `.env.local` and Vercel env vars (`NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`) |
| Vercel | Hosting | Vercel dashboard |
| Anthropic | AI chatbot | `ANTHROPIC_API_KEY` env var |
| Brevo | Email sending | `BREVO_API_KEY` env var |
| Monobank | Payments | Two account configs (UA + international), see env vars |
| Nova Poshta | Shipping (UA) | `NOVA_POSHTA_API_KEY` |

See `ENV_VARS_REQUIRED.md` and `VERCEL_ENV_VARS.md` for complete list.

---

## Known gaps (the live TODO that always hurts)

These are the recurring "why is this still broken" issues. Update this list when items are resolved.

1. **Frames as photo slots** — frames are currently overlay-only. Photo doesn't fit into transparent zone. Files: `FramesLayer.tsx`, `BookLayoutEditor.tsx`. Critical for editor usability.
2. **`BookPreviewModal` partial features** — Frames, shapes, stickers, QR overlays now render correctly in preview. Still missing: multi-slot layouts (uses single-slot only) and per-slot crop/zoom. Full multi-slot support needs `getSlotDefs` integration similar to the editor.
3. **Footer i18n DB application** — `footer_sections.translations` exists but is not always applied; `Footer.tsx` falls back to raw `section_title` instead of `getLocalized(...)`.
4. **Kalka FontPicker** — still uses basic `<select>` with 10 fonts; should use `components/editor/FontPicker.tsx` like the rest of the editor.
5. **PNG frame quality** — current frames look basic vs Canva references. Need higher-quality botanical/gold/watercolour sets. ALSO: ~7% of opaque pixels in many of the floral frames are near-black (RGB <40, alpha 255) — leaf shadow detail that survived an incomplete background-removal pass. Currently softened at render time via `PNG_FRAME_FILTER` (brightness 1.18 / contrast 0.88 / saturate 0.9 applied in FramesLayer + BookPreviewModal). Proper fix is to rebuild the 34 PNGs with a matting-based BG removal pipeline (e.g. `@imgly/background-removal` which is already a dependency) instead of the colour-threshold tool that was used.
6. **Cover templates breadth** — magazine and travel book templates are fewer than photobook. Expanding from Canva designs is ongoing.
7. **Designer cabinet revision lifecycle gaps** — known but not yet documented in detail. Audit the flow when next touching `app/admin/designer/`.
8. **Cart/checkout end-to-end audit** — known to have edge-case breakages, full walkthrough as a customer is a recurring TODO.
9. **47 markdown files in repo root** — historical implementation summaries. These should be moved into a `docs/archive/` folder once everything they cover is reflected in this ARCHITECTURE.md.
10. **Schema drift between repo and prod Supabase** — production schema has been extended directly via the Supabase dashboard with no corresponding migrations. Two migrations bring the worst offenders back in line:
    - `20260429_sync_projects_schema_with_prod.sql` — covers `projects` (name, uploaded_photos, notified_*_at, relaxed CHECK constraints, consolidated RLS policy). **Applied to prod 2026-04-29.**
    - `20260429_create_missing_infrastructure_tables.sql` — creates 6 infra tables that code references but prod never had: `automation_settings`, `email_templates`, `notification_log`, `staff_shifts`, `qc_error_log`, `salary_calculations`. Also adds `is_recurring`, `recurring_interval`, `name`, `period_start`, `period_end`, `supplier`, `invoice_number` to `expenses` so the recurring-expenses cron can run. **Applied to prod 2026-04-29.**

    Resolved follow-ups (also applied 2026-04-29):
    - `birthday-emails` cron rewritten to read birthday via join `subscribers.email = customers.email` (the `subscribers.birthday_month/_day` columns the cron used to read never existed in prod, and the subscribe form had already moved birthday collection to user registration).
    - `lib/ai/claude-chat.ts` (and its schema reference `lib/supabase/schema/ai-chat.sql`) deleted — visitor-facing AI chatbot was never deployed and nothing imports it.
    - `db_backups` storage bucket created explicitly on prod (private, 100MB limit) so `backup-db` cron stops needing to lazy-create it.

11. **Security hardening** — full audit on 2026-04-29 found 24 critical/high/medium issues across RLS, API auth, webhook verification, and dependency vulnerabilities. Three migrations + extensive code changes resolve them. **All applied to prod 2026-04-29.**
    - `20260429_security_hardening.sql` — enable RLS on `magazine_briefs` (was off; PII questionnaires were anon-readable), drop public SELECT on `subscribers` / `wishlists` / `gift_certificates` / `inventory_movements`, drop `Free Designer Orders Read` (anon-leaked customer PII for designer-service orders), drop anon FOR ALL on `photobook_projects` / `recipes`, restrict `bank_accounts` / `fiscal_accounts` / `np_accounts` to admin only, drop `staff` "any authenticated reads" policy, drop `design_briefs` / `design_revisions` `USING (true)` policies, lock down orphan tables from sibling projects.
    - `20260429_security_hardening_admin_check_fix.sql` — fixes the previous migration's admin check. The first attempt used `EXISTS (admin_users WHERE id = auth.uid())` but `admin_users.id` is its own UUID, NOT `auth.users.id`. Replaced with the existing `is_admin()` DB function (matches via `auth.jwt()->>'email'`).
    - `20260429_close_customer_projects.sql` — `customer_projects` had a policy literally named "Admin full access" but with `USING (true)` and no role restriction; full table was anon-readable. Closed with admin/owner policies; the customer review link path now goes through `/api/review/[token]/[action]` with token-validated service-role access.

    Code-side fixes:
    - `lib/auth/guards.ts` — new `requireAuth` / `requireAdmin` / `requireOwnerOrAdmin` helpers for API routes.
    - 24 `/api/admin/*` routes — added `requireAdmin()` at the top of every handler. Previously they used the service-role client with no auth check; anyone could GET/PATCH any order, change `payment_status`, etc.
    - 5 dangerous non-admin routes guarded similarly: `/api/orders/[id]/{duplicate,send-email,create-ttn}`, `/api/production/queue`, `/api/monobank/sync-balance`.
    - `/api/orders` (no params) was leaking ALL orders with customer PII to anyone — now requires admin.
    - `/api/orders/track` — added input validation to prevent PostgREST `or()` filter injection via the `contact` field.
    - `/api/monobank/webhook` — was silently skipping signature verification when the `X-Sign` header was missing (trivially forgeable: anyone could mark an order as paid). Header now required when `MONOBANK_PUB_KEY` is set; 503 in production if the env var is missing.
    - `app/[locale]/review/[token]/{page,ReviewPageClient}.tsx` — switched to use `/api/review/[token]/[action]` server route + admin client for the page query, so token-based public review still works after RLS lockdown.
    - `npm audit fix` ran: 3 vulnerabilities remain unfixed and are accepted risks: `xlsx` (no upstream fix; we generate xlsx, never parse untrusted input), `request` + `form-data` (transitive via `node-telegram-bot-api` → no maintained alternative; runs server-side over HTTPS to Telegram API).

---

## How to update this doc

When you make a change that:

- **Adds a new top-level area** → add a row to **Quick map**
- **Adds a major feature** → mention it under the relevant section
- **Resolves a known gap** → remove from **Known gaps**
- **Changes the tech stack** → update **High-level stack**
- **Changes deployment** → update **Deployment**

Keep it short. The whole doc should stay readable in one sitting (~10 minutes). When a section gets too long, split it into a separate file in `docs/` and link from here.

When Claude is asked to do TouchMemories work, Claude reads this file first.

---

*End of ARCHITECTURE.md*
