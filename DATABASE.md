# TouchMemories — Database Map

> **Last updated:** 2026-05-01 · After cleanup migration `20260501_drop_unused_empty_tables`
> **Project:** Supabase `yivfsicvaoewxrtkrfxr` · 66 tables · RLS on all tables

---

## How this doc works

Tables grouped by responsibility. For each: row count at last audit, what it stores, where the code touches it. **Empty tables are listed separately at the bottom** — those are scaffolded for future features but not in active use.

When you add a new table, add it here. When you drop one, remove it here.

---

## Catalog (the storefront's product data)

| Table | Rows | Purpose |
|---|---|---|
| `products` | 59 | Master product list (photobooks, magazines, prints, magnets, etc.) |
| `categories` | 16 | Top-level navigation categories |
| `photobook_prices` | 496 | Price matrix: size × pages × cover × lamination |
| `photobook_sizes` | 5 | Available sizes (15×15, 20×20, 25×25, etc.) |
| `photobook_rules` | 4 | Constraints (min/max pages per size) |
| `cover_types` | 5 | Cover material types (printed, leather, fabric) |
| `cover_colors` | 34 | Available cover colors |
| `spine_types` | 2 | Binding styles |
| `decoration_types` | 5 | Decoration categories (foiling, embossing) |
| `decoration_variants` | 51 | Specific decoration options |
| `book_cover_templates` | 4 | Pre-designed cover layouts |
| `travel_book_covers` | 55 | Travel book cover variants |
| `constructor_product_types` | 3 | Product types available in the editor |
| `listings` | 4 | Marketplace-style listings (legacy?) |

## Editor

| Table | Rows | Purpose |
|---|---|---|
| `editor_stickers` | 74 | Stickers available in editor |
| `photobook_projects` | 54 | Saved customer projects (the "Мої дизайни" feature) |
| `projects` | 1 | Generic projects (legacy — most live in photobook_projects) |

## Site content (CMS)

| Table | Rows | Purpose |
|---|---|---|
| `site_content` | 20 | Page-level content blocks |
| `site_blocks` | 18 | Reusable content components |
| `section_content` | 10 | Section-specific text |
| `hero_content` | 1 | Homepage hero section |
| `hero_buttons` | 2 | Homepage CTA buttons |
| `feature_cards` | 4 | "Why us" feature cards on homepage |
| `why_choose_us_cards` | 3 | Trust-builder cards |
| `faqs` | 8 | FAQ entries |
| `navigation_links` | 28 | Header nav structure |
| `footer_sections` | 3 | Footer column groups |
| `footer_links` | 15 | Individual footer links |
| `featured_articles` | 2 | Highlighted blog posts |

## Blog

| Table | Rows | Purpose |
|---|---|---|
| `blog_posts` | 4 | Articles |
| `blog_categories` | 9 | Article categories |

## Orders / customers

| Table | Rows | Purpose |
|---|---|---|
| `orders` | 1 | Customer orders (currently 1 — most sales still go via Instagram DM, not site checkout) |
| `customers` | 1 | Customer records |
| `subscribers` | 1 | Newsletter subscribers |
| `cart_events` | 37 | Cart abandonment tracking |
| `order_tags` | 8 | Tag taxonomy for orders |

## Promotions

| Table | Rows | Purpose |
|---|---|---|
| `promo_codes` | 3 | Active discount codes |
| `gift_collections` | 5 | Curated gift bundles |
| `gift_collection_items` | 3 | Items in each bundle |
| `quiz_recommendations` | 20 | Gift quiz outcomes |
| `marketing_automations` | 2 | Marketing flow definitions |
| `automation_settings` | 1 | Global automation config |
| `email_templates` | 4 | Transactional + marketing email templates |
| `reply_templates` | 3 | Quick-reply templates for support |

## Theme / design system

| Table | Rows | Purpose |
|---|---|---|
| `theme_settings` | 1 | Active theme |
| `theme_presets` | 5 | Available theme presets |

## Internal panel (Diana's productivity stack)

| Table | Rows | Purpose |
|---|---|---|
| `dashboard_tasks` | 129 | Tasks across all of Diana's projects |
| `dashboard_projects` | 16 | Project list |
| `boards` | 16 | Kanban boards |
| `staff` | 4 | Team members |
| `salary_periods` | 2 | Payroll periods |
| `inventory_movements` | 4 | Stock changes log |
| `expense_categories` | 7 | Expense taxonomy |
| `fiscal_rules` | 4 | Tax/fiscal rules |
| `body_measurements` | 1 | Personal fitness tracking |
| `training_exercises` | 32 | Personal training catalog |
| `training_sessions` | 7 | Personal workout log |

## Settings / admin

| Table | Rows | Purpose |
|---|---|---|
| `settings` | 4 | Global key-value config |
| `admin_users` | 2 | Admin panel users |
| `admin_roles` | 5 | Admin role definitions |

---

## Empty tables (scaffolded for future features — keep)

These have zero rows but are referenced from `orders` or `fiscal_rules` via nullable foreign keys. They're future infrastructure for the checkout pipeline. Do **not** drop them.

| Table | Future purpose |
|---|---|
| `bank_accounts` | Diana's payment receiving accounts (for invoice generation) |
| `customer_projects` | Customer-created design briefs (separate from photobook_projects) |
| `fiscal_accounts` | Tax authority accounts |
| `np_accounts` | Nova Poshta sender accounts |
| `print_profiles` | Print specifications by product type |
| `referral_codes` | Customer referral program codes |

---

## What got dropped on 2026-05-01

49 empty tables removed in `supabase/migrations/20260501_drop_unused_empty_tables.sql`. They were scaffolded by Antigravity / earlier iterations but never wired up to the application. To restore one, copy the schema from a Supabase daily backup.

Removed: `admin_formats`, `admin_global_rules`, `admin_materials`, `admin_product_configs`, `admin_templates`, `automation_logs`, `automation_rules`, `certificates`, `clients`, `constructor_product_templates`, `daily_logs`, `dashboard_files`, `dashboard_subtasks`, `design_briefs`, `design_revisions`, `editor_frames`, `email_campaign_logs`, `email_campaigns`, `email_logs`, `expenses`, `gift_certificates`, `gift_hints`, `magazine_briefs`, `materials`, `materials_movements`, `media`, `media_library`, `message_templates`, `notification_log`, `order_files`, `order_history`, `order_tag_assignments`, `pins`, `product_stock`, `project_comments`, `project_notifications`, `promo_code_usages`, `promotional_banners`, `qc_error_log`, `recipes`, `reviews`, `role_pricing`, `salary_calculations`, `social_conversations`, `social_messages`, `staff_schedule`, `staff_shifts`, `staff_work_log`, `stock_alerts`, `wishlists`.

---

## Storage buckets

| Bucket | Public | Files | Size |
|---|---|---|---|
| `touch-memories-assets` | yes | 77 | 46 MB |
| `products` | yes | 12 | 9.7 MB |
| `photobook-uploads` | yes | 11 | 5.3 MB |
| `travel-covers` | yes | 0 | – |
| `category-images` | yes | 0 | – |
| `videos` | yes | 0 | – |
| `design-briefs` | no | 0 | – |
| `order-files` | yes | 0 | – |
| `db_backups` | no | 0 | – |
| `poster-exports` | yes | 0 | – |

---

## Migration history

105 migrations applied through 2026-04-29, plus this cleanup on 2026-05-01. All versioned in `supabase/migrations/`. The numbered prefix convention is `YYYYMMDD_description.sql`.
