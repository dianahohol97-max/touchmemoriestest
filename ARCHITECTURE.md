# TouchMemories — Architecture

> **Last updated:** 2026-06-04 · **Maintained by:** Diana + Claude
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
| Region pricing / currency | `lib/payment/pricing-region.ts` (markup + currency rule, pure) + `lib/i18n/currency.ts` (rates, pure convert) + `lib/i18n/exchangeRate.ts` (server rate reader) | +30% intl markup = locale × shipRegion (NOT currency); flat €25 intl shipping (free-shipping disabled: threshold 0). EUR rate in `settings('eur_rate')`, refreshed biweekly by `/api/cron/update-exchange-rate`. See "Region pricing" below |
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
- **Payments:** Monobank (UA + international dual-account routing via `bank_accounts.region`; charge always in UAH, EUR shown via buffered NBU rate)
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

### Cover text model (front + back)

The cover has two surfaces — front and back — and both can carry free-positioned text:

- **`coverState.printedTextBlocks`** — front-cover text on printed covers (magazine / journal / photobook printed / travelbook / wishbook / scrapbook / graduation). Rendered by `CoverEditor`.
- **`coverState.extraTexts`** — front-cover text on soft covers (велюр / тканина / шкірзамінник albums). One-shot inscription priced at +180 ₴ via `inscriptionMethod` (`flex` or `graviruvannya`). Rendered by `CoverEditor`.
- **`coverState.backCoverTexts`** — back-cover text on printed covers. Same shape as `printedTextBlocks` (`{id,text,x,y,fontSize,fontFamily,color,bold}`, percent-positioned). Rendered by `CoverView` directly (the back cover lives in `CoverView`, not in `CoverEditor`). Free, no surcharge. Not supported on soft covers — the front-cover `extraTexts` flow already covers that audience.

All three lists are serialised in `coverState` and persisted automatically via `cover_data` on `projects` (so saved sessions, the cart payload, and the "Замовити повторно" replay flow get them for free). The cart `options` map surfaces back-cover text as `'Текст на задній обкладинці'` when present so production sees the exact strings the customer placed.

The editor's "Текст" tab on `currentIdx === 0` shows two buttons for printed covers: one for the front and one for the back. Both desktop and mobile have the pair.

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

## Payment flow & designer handoff

The end-to-end path from cart to designer brief:

1. **Cart → checkout.** The `/cart` page is now **navigation-only** — it lists items and totals and its button routes to `/[locale]/checkout`. It no longer collects contact/delivery or creates orders (the old `/cart` "Pay" button POSTed to a deleted `/api/checkout/create-invoice` and 404'd, blocking all online payment). `/checkout` is the single online entry point: it owns the contact → shipping → payment steps, calls `/api/orders/submit` (which resolves `payment_mode` and may downgrade split→full), then `/api/monobank/create-invoice`. It also runs `linkPendingExports` — reading each `sessionStorage.export_{cartItemId}` descriptor that constructors stash and inserting `order_files` rows — **before** `clearCart()`, so designed files (photobook PDFs, posters, star maps) always attach to the order. `lib/submitOrder.ts` inserts the `orders` row with `payment_status='pending'`, `order_status='new'`; line items go into `orders.items` JSONB.

2. **Invoice creation.** Customer hits "Pay" → POST `/api/monobank/create-invoice` with `{orderId, paymentRegion: 'ua'|'international'}`. The token is now taken from the active `bank_accounts` row whose `region` matches the destination (UA → ФОП Коблик, international → ФОП Гоголь); env tokens (`MONOBANK_TOKEN` / `MONOBANK_TOKEN_INTL`) are only a fallback if the DB row is missing. The charged amount is `order.total` (already the marked-up UAH — see "Region pricing" below), or `prepaid_amount` for a 50/50 split. Stores `monobank_invoice_id` + `monobank_payment_url`, logs to `order_history`, returns the page URL. Always charges in UAH (`ccy: 980`); foreign cards are converted by the customer's own bank.

3. **Customer pays on Monobank.** Monobank fires a webhook to `/api/monobank/webhook` (canonical path). Two legacy aliases — `/api/webhook/monobank` and `/api/webhooks/monobank` — re-export the canonical handler, so Monobank can hit any of the three URLs without breaking.

4. **Webhook handler** (`app/api/monobank/webhook/route.ts`) does, in order:
   - Verify the `X-Sign` signature with `MONOBANK_PUB_KEY`. Production webhooks without a configured pub key return 503 to avoid silently accepting unsigned payloads.
   - Look up the order, sanity-check that `amount` matches `total * 100` ± 1 kopeck (defence in depth).
   - Atomic conditional UPDATE on `orders` setting `payment_status`, `monobank_invoice_status`, `paid_at` etc. The `.or(monobank_invoice_id.is.null,monobank_invoice_id.neq.{x},monobank_invoice_status.neq.{y})` clause makes the update race-safe — concurrent webhook deliveries can't both insert duplicate history rows.
   - Insert into `order_history` with the human-readable note.
   - On `success`: auto-confirm the order if it was still `new`.
   - On `success` AND `with_designer=true` AND order wasn't already paid: fire-and-forget POST `/api/designer-service/on-payment`. The Monobank webhook is not allowed to block on email + Telegram (those would make Monobank retry the webhook on slow APIs), so we don't await.

5. **Designer handoff** (`app/api/designer-service/on-payment/route.ts`):
   - Loads the order + customer (joined customers row, or inline `customer_*` fields for guest checkout).
   - Creates a `design_briefs` row with `status='waiting_brief'`. Token is generated by the `gen_brief_token()` Postgres DEFAULT — server-side capability that the customer can later use to access their brief form without logging in.
   - Sends the brief link email via Brevo (`sendBriefLinkEmail`). Skips silently if no email is on file.
   - Pings the designer Telegram chat with the order summary + brief token.
   - Idempotent: re-running on the same order finds the existing brief and just re-sends the email.

6. **Customer fills the brief.** Hits `/api/designer-service/brief/[token]`, fills the form (occasion, style, photo order, important_photos, title_text, additional_notes), uploads photos to the `design-briefs` storage bucket. `submitBrief()` updates the row to `status='brief_received'`, then `triggerAIProcessing()` fires off the AI photo analysis in the background.

7. **Designer picks up the order** in `app/admin/designer/`, assigns themselves (`orders.designer_id` + `assigned_at`), opens the brief, builds the book in the editor.

8. **Revision round-trip.** Designer hits "Send for review" → creates a `design_revisions` row with its own `client_token`, emails customer the review link. Customer approves or asks for changes (`client_decision` + `client_comments` + `general_feedback`). `revision_count` increments per round; the contract caps at 3.

### Region pricing, currency & ship region

Canonical price is **always UAH**. Two checkout decisions depend on (interface language) × (delivery destination), and both live in one pure module, `lib/payment/pricing-region.ts`, used by the server (authoritative) and the client (display) so "shown == charged":

- **`resolvePriceMultiplier(locale, shipRegion)`** — the international markup (×1.30) applies ONLY at `locale !== 'uk' && shipRegion === 'INTL'`. The markup is a function of locale × shipRegion, **not** of currency. `convertPrice` in `lib/i18n/currency.ts` is now a pure conversion (markup was decoupled from it); storefront cards apply markup via `formatDisplayPrice(...)` using the locale's `defaultShipRegion`.
- **`resolveDisplayCurrency(locale, userChoice)`** — default UAH for uk, EUR otherwise; checkout has a UAH/EUR switcher available to everyone. Display only — charge is always UAH.

**International shipping** is a flat €25 fee (free-shipping disabled — config `free_threshold_eur` = 0; set it > 0 to re-enable a free-over-threshold tier) (`computeIntlShippingUah`, config in `settings('intl_shipping')` = `{free_threshold_eur, flat_fee_eur}`, defaults in `DEFAULT_INTL_SHIPPING`). The threshold/fee are in EUR; the order's marked UAH subtotal is converted via the buffered rate to decide. `/api/orders/submit` computes the fee server-side and stores it in `orders.delivery_cost`; the checkout fetches `/api/exchange-rate` (public: rate + threshold + fee) so its displayed total and free-shipping nudge match the charge exactly. Recipient-pays-on-delivery is **not** available for outbound international (domestic-only), so intl shipping is always prepaid in the order total. NOTE: a uk-locale customer shipping abroad gets no markup (matrix: base UAH) but pays the same flat €25 shipping — fine.

The checkout shipping step now carries an authoritative **UA / INTL selector** (`shipRegionChoice`) that drives the address form (Nova Poshta picker vs free international address), the payment account, the markup, split availability (INTL = full prepayment only, enforced server-side in `/api/orders/submit`), and the currency default. The old late "payment region" modal was removed.

`/api/orders/submit` receives base UAH `subtotal`/`total` + `ship_region` + `locale` + `display_currency`, applies the multiplier itself (a tampered client can't skip it), and **freezes** `ship_region`, `price_multiplier`, `display_currency`, `exchange_rate` on the order.

**EUR rate** lives in `settings('eur_rate')` (`{rate, base_rate, buffer_pct, source, updated_at}`), read server-side via `lib/i18n/exchangeRate.ts` (cached). It's refreshed twice a month (1st & 15th, `0 5 1,15 * *`) by `/api/cron/update-exchange-rate` from the NBU official rate with a margin buffer — predictable price-change dates rather than daily drift.



### Manual order create (parallel entry point)

The Monobank webhook is the path for orders the customer pays online. Most of Diana's real volume comes through Instagram DM, where an admin enters the order by hand in `app/admin/orders/create`. That route (`/api/admin/orders/create`) mirrors the webhook side effects so manually-created orders aren't second-class:

- Inserts an `order_created` row in `order_history` with the source (`manual` / `instagram` / etc.) and `created_by` FK, so the order detail page's history feed shows when and how the order entered the system.
- If `with_designer=true` AND the admin marks the order paid on the form, fires the same `POST /api/designer-service/on-payment` the webhook does — fire-and-forget, no await, downstream is idempotent.

Both entry points converge on the same designer-handoff route, so the brief creation / email / Telegram ping logic lives in one place (`app/api/designer-service/on-payment/route.ts`) regardless of how the order was paid.

The three webhook endpoints, the dual `mono_*` / `monobank_*` order columns, and the historical reference to `design_orders` / `designer_assignments` in earlier drafts of this doc are all artefacts of the same migration episode and have been straightened out — `monobank_*` is canonical, the older alias columns are dead code paths preserved only because dropping them is a DB migration risk for very little gain.

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

- **`products`** — catalog items, has `translations` JSONB. Variants and options live INLINE in `products.variants` / `products.options` JSONB columns, not in separate tables.
- **`categories`** — has `translations` JSONB
- **`orders`** — order header. Line items live in `orders.items` JSONB (there is no `order_items` table). Customer info has two paths: linked via `customer_id` → `customers` table, or inline `customer_name` / `customer_email` / `customer_phone` for guest checkout. Designer service info: `with_designer`, `designer_service_fee`, `designer_id`, `brief_token`. Payment: `monobank_invoice_id`, `monobank_payment_url`, `monobank_invoice_status`, `monobank_approval_code`, `monobank_rrn`, `payment_region`, `paid_at`, `payment_status`. Frozen pricing context (added 2026-06-04): `ship_region` ('UA'|'INTL'), `price_multiplier` (1.0 base, 1.30 intl), `display_currency`, `exchange_rate` (UAH-per-EUR snapshot; null for UAH orders). Two old aliases `mono_invoice_id` / `mono_payment_id` are present but no longer read by any runtime code.
- **`order_history`** — audit trail of order lifecycle events (payment status changes, status transitions, TTN creation, manager/designer assignment). Written by Monobank webhook, automation routes, admin order page.
- **`order_files`** — files attached to orders. `file_type='upload'` for customer-supplied (photos for editor, designer reference material); `file_type='export'` for our 300dpi production PDFs and intermediate config blobs from constructors.
- **`cart_events`** — abandoned + active cart tracking (event log shape; there is no `carts` table)
- **`customers`** — accounts (linked to Supabase auth via `auth_user_id`)
- **`reviews`** — Instagram imports + manual entries for storefront social proof
- **`design_briefs`** — designer-service customer brief (token-keyed, capability-based access; schema mirrors `lib/types/designer-service.ts`). Token generated server-side by `gen_brief_token()` Postgres function (32-char base64url).
- **`design_revisions`** — one row per designer→customer review round-trip (revision_count tracks how many revision rounds; contract is 3 max)
- **`magazine_briefs`** — parallel brief flow for magazine product (generic `brief_data` JSONB so the magazine form can evolve without schema changes; lifecycle scheduled → generating → done)
- **`promo_codes`** + **`promo_code_usages`** — promo codes + per-customer usage tracking (lets us enforce single-use-per-customer promos)
- **`notification_log`** — outbound Telegram + email status-change notifications, audit only
- **`email_logs`** — Brevo / Resend transactional send audit log (surfaced in admin order view)
- **`email_campaigns`** + **`email_campaign_logs`** — newsletter campaigns + per-subscriber send results
- **`expenses`** + **`expense_categories`** — finance module. `expenses.extras` JSONB captures form fields beyond the explicit columns.
- **`salary_calculations`** + **`salary_periods`** + **`staff_shifts`** + **`staff_work_log`** — payroll. `is_locked` on salary_calculations freezes paid periods from re-computation. The earlier `salary_records` name in this doc referred to a table that never existed — the canonical name is `salary_calculations`.
- **`qc_error_log`** — production QC errors attributed to staff for salary deductions
- **`stock_alerts`** — out-of-stock / low-stock notification log so we don't double-notify
- **`social_conversations`** + **`social_messages`** — AI chatbot social inbox (Instagram / FB). `lib/chatbot/core.ts` handles auto-replies; admin/social-inbox is the manual-reply UI. A trigger on `social_messages` insert updates the conversation's `last_message_at` + `is_read=false` (when sender is customer).
- **`certificates`** — gift certificates. Canonical name; an earlier alias `gift_certificates` was unified into this table. Schema covers money + product certificates, electronic + printed, plus the 7-day-before-expiry reminder flag the cron route uses.
- **`gift_hints`** — anonymous "gift hint" submissions (public insert, admin read)
- **`order_tags`** + **`order_tag_assignments`** — many-to-many order-tag linkage (separate from the `tags` text[] column on orders, used by the admin UI for colour-coded tags)
- **`photobook_projects`** — legacy table, last writes March 2026. New saves go to `projects`
- **`projects`** — saved editor sessions (photobook, travelbook, magazine, wishbook). Columns: `pages_data`, `cover_data`, `overlays_data`, `uploaded_photos`. The `overlays_data` jsonb bundle holds `pageStickers`, `pageShapes`, `pageBgs`, `freeSlots`, `qrOverlays`, `generatedQRCount` — everything the editor renders on top of `pages_data` that wouldn't otherwise be persisted
- **`footer_sections`** — site footer content (has `translations` JSONB, application is incomplete — see Known gaps)

Storage buckets (`storage.buckets`, not tables): `category-images`, `db_backups`, `design-briefs`, `order-files`, `photobook-uploads`, `poster-exports`, `products`, `touch-memories-assets`, `travel-covers`, `videos`. `db_backups` previously appeared in this doc as a "missing table" — it's a storage bucket and exists.

### Removed from this doc

Earlier drafts mentioned these tables/relations as if they existed. They do not, and the runtime code doesn't reference them:

- `product_variants` — variants live INLINE in `products.variants` JSONB
- `order_items` — line items live in `orders.items` JSONB
- `carts` — abandoned/active cart tracking is `cart_events` (event-log shape)
- `salary_records` — canonical name is `salary_calculations`
- `automation_rules`, `email_promo_*`, `ai_chat_*`, `reporting_*`, `material_*`, `inventory_*`, `team_members`, `shipping_*`, `birthday_*` — placeholder names from earlier drafts; the actual tables are listed above (e.g. `automation_settings`, `email_campaigns`, `social_conversations`, `staff`)
- `design_orders`, `designer_assignments` — designer flow uses `design_briefs` + `design_revisions` with `designer_id` directly on the orders row, no separate join table

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
8. **Cart/checkout end-to-end audit** — region pricing is now implemented (2026-06-04): account routing from `bank_accounts`, +30% intl markup frozen on the order, UA/INTL ship-region selector, UAH/EUR switcher, INTL = full prepayment. Still open: (a) **international shipping is semi-manual** — Diana uses Nova Poshta's international service (no programmatic waybill API on her domestic contract). The admin order page has an international panel for `ship_region='INTL'` orders: transliterated recipient/address/description (`lib/shipping/transliterate.ts`, KMU-55 table) ready to paste into the NP international application, plus a field to save the resulting tracking number (stored on `orders.ttn` with `tracking_carrier='nova_poshta_intl'` + `tracking_url`). The domestic `sync-tracking` cron skips any order with a non-null `tracking_carrier` (domestic leaves it NULL). Auto-creation via an API (e.g. Nova Global Partners "Create IEW") is a future Phase B, gated on signing a Nova Global agreement + a separate Global API key. (Fixed 2026-06-04: `sync-tracking` previously read non-existent `tracking_number`/`delivery_status` columns — now reads the real `ttn`/`tracking_status`.) (b) **fiscalization (Checkbox)** is not wired — `fiscal_accounts` is empty and `fiscal_rules` all disabled, so no receipts are issued per ФОП; (c) `np_accounts` is empty (no internal NP account configured for live TTN); (d) a live end-to-end Monobank test (real invoice → webhook → `paid`) has not been run. A full customer-perspective walkthrough (promo + markup interaction, designer-service orders) still recommended.
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
