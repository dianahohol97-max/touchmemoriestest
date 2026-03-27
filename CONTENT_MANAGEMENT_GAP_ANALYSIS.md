# Content Management Gap Analysis
**Touch Memories - Making All Content Editable from Admin Panel**

Generated: 2026-03-27

---

## Executive Summary

This document identifies all hardcoded content on the Touch Memories public site and provides a roadmap to make 100% of content editable from the admin panel. **Goal: Zero hardcoded content after implementation.**

---

## Current State - What's Already Manageable

### ✅ WORKING (Admin Panel Exists)

| Feature | Admin Location | Database Table | Status |
|---------|---------------|----------------|--------|
| **Products** | `/admin/catalog` | `products` | ✅ Full CRUD |
| **Product visibility** | `/admin/catalog` | `products.is_active` | ✅ Toggle active/inactive |
| **Product prices** | `/admin/catalog/product/edit/[id]` | `products.price` | ✅ Editable |
| **Categories** | `/admin/catalog/categories` | `categories` | ✅ Full CRUD |
| **Category order** | `/admin/catalog/categories` | `categories.sort_order` | ✅ Sortable |
| **Popular products** | `/admin/popular-products` | `products.is_popular, popular_order` | ✅ Drag-and-drop ordering |
| **Blog posts** | `/admin/blog` | `blog_posts` | ✅ Full CRUD with rich text |
| **Blog categories** | `/admin/blog/categories` | `blog_categories` | ✅ Full CRUD |
| **Orders** | `/admin/orders` | `orders` | ✅ View, status updates |
| **Customers** | `/admin/customers` | `customers` | ✅ View, manage |
| **FAQ** | `/admin/faq` | `faq` | ✅ Full CRUD |
| **Promo codes** | `/admin/marketing/promocodes` | `promocodes` | ✅ Full CRUD |

---

## Gap Analysis - What's Missing

### 🔴 PRIORITY 1: HOMEPAGE HERO SECTION

| Element | Current State | In Supabase? | In Admin UI? | Action Needed |
|---------|--------------|--------------|--------------|---------------|
| **Hero overline text** | Hardcoded fallback in `Hero.tsx` | ❌ No | ❌ No | ✅ **CREATED** `hero_content` table |
| **Hero title (line 1)** | Hardcoded fallback | ❌ No | ❌ No | ✅ **CREATED** `hero_content` table |
| **Hero title (line 2)** | Hardcoded fallback | ❌ No | ❌ No | ✅ **CREATED** `hero_content` table |
| **Hero subtitle** | Hardcoded fallback | ❌ No | ❌ No | ✅ **CREATED** `hero_content` table |
| **Hero background image** | Hardcoded in code | ❌ No | ❌ No | ✅ **CREATED** `hero_content.background_image_url` |
| **Category buttons** | **6 buttons HARDCODED** | ❌ No | ❌ No | ✅ **CREATED** `hero_buttons` table |
| **Button text ("Фотокнига")** | Hardcoded in JSX | ❌ No | ❌ No | ✅ Stored in `hero_buttons.button_text` |
| **Button URLs** | Hardcoded links | ❌ No | ❌ No | ✅ Stored in `hero_buttons.button_url` |
| **Button row grouping** | Hardcoded layout | ❌ No | ❌ No | ✅ Stored in `hero_buttons.row_number` |

**Files to Update:**
- ✅ Created: `supabase/migrations/20260327000000_create_content_management_system.sql`
- ✅ Created: `app/admin/content/page.tsx` (admin UI)
- ⏳ **TODO**: Update `components/ui/Hero.tsx` to fetch from database
- ⏳ **TODO**: Update `app/page.tsx` to pass hero data as props

---

### 🔴 PRIORITY 2: "ЧОМУ ВАРТО ОБРАТИ НАС" SECTION

| Element | Current State | In Supabase? | In Admin UI? | Action Needed |
|---------|--------------|--------------|--------------|---------------|
| **Section heading** | Hardcoded "Чому варто обрати нас" | ❌ No | ❌ No | Add to `section_content` |
| **Feature cards (4 cards)** | **HARDCODED ARRAY** in `HowItWorks.tsx` | ❌ No | ❌ No | ✅ **CREATED** `why_choose_us_cards` table |
| **Card 1 title** | "Преміум якість друку" | ❌ No | ❌ No | ✅ Stored in `why_choose_us_cards.title` |
| **Card 1 description** | "Fujicolor Crystal Archive..." | ❌ No | ❌ No | ✅ Stored in `why_choose_us_cards.description` |
| **Card 2 title** | "Персональний дизайн" | ❌ No | ❌ No | ✅ Stored in database |
| **Card 2 description** | "Безкоштовний макет..." | ❌ No | ❌ No | ✅ Stored in database |
| **Card 3 title** | "Доступні ціни" | ❌ No | ❌ No | ✅ Stored in database |
| **Card 3 description** | "Якісний друк..." | ❌ No | ❌ No | ✅ Stored in database |
| **Card 4 title** | "Понад 20 000 клієнтів" | ❌ No | ❌ No | ✅ Stored in database |
| **Card 4 description** | "Нам довіряють..." | ❌ No | ❌ No | ✅ Stored in database |

**Files to Update:**
- ✅ Created: Database table `why_choose_us_cards`
- ✅ Created: Admin UI in `/admin/content` (features tab)
- ⏳ **TODO**: Update `components/ui/HowItWorks.tsx` to fetch from database
- ⏳ **TODO**: Convert to server component or add client-side fetch

---

### 🔴 PRIORITY 3: HOMEPAGE SECTIONS

| Element | Location | Current State | In Supabase? | In Admin UI? | Action Needed |
|---------|----------|--------------|--------------|--------------|---------------|
| **Travel section heading** | `app/page.tsx` line 150 | Hardcoded "Топ-10 локацій" | ❌ No | ❌ No | Move to `section_content` |
| **Travel section description** | `app/page.tsx` | Hardcoded text | ❌ No | ❌ No | Move to `section_content` |
| **Travel section image** | `app/page.tsx` line 140 | Hardcoded Unsplash URL | ❌ No | ❌ No | Add to `section_content.image_url` |
| **Gift Ideas heading** | `components/ui/GiftIdeas.tsx` | Hardcoded | ❌ No | ❌ No | ✅ Added to `section_content` |
| **Photo Print Promo** | `components/ui/PhotoPrintPromo.tsx` | Hardcoded | ❌ No | ❌ No | ✅ Added to `section_content` |
| **Custom Book Promo** | `components/ui/CustomBookPromo.tsx` | Hardcoded | ❌ No | ❌ No | ✅ Added to `section_content` |
| **Constructor Selection** | `components/ui/ConstructorSelection.tsx` | Hardcoded buttons | ❌ No | ❌ No | Create table or use existing |
| **Section visibility** | `app/page.tsx` | ✅ Uses `SectionWrapper` | ✅ `site_blocks` | ⚠️ Partial | Needs UI in admin |
| **Section order** | `app/page.tsx` | ✅ Uses `defaultOrder` | ✅ `site_blocks.position_order` | ⚠️ Partial | Needs drag-and-drop UI |

**Files to Update:**
- ⏳ TODO: Update all section components to fetch from `section_content`
- ⏳ TODO: Create `/admin/sections` page for section visibility/order management

---

### 🟡 PRIORITY 4: PROMOTIONAL BANNERS

| Feature | Current State | In Supabase? | In Admin UI? | Action Needed |
|---------|--------------|--------------|--------------|---------------|
| **Banner system** | ❌ No promotional banners | ❌ No | ❌ No | ✅ **CREATED** `promotional_banners` table |
| **Banner title** | N/A | ❌ No | ❌ No | ✅ Database field created |
| **Banner description** | N/A | ❌ No | ❌ No | ✅ Database field created |
| **Banner image** | N/A | ❌ No | ❌ No | ✅ Database field created |
| **Banner link** | N/A | ❌ No | ❌ No | ✅ Database field created |
| **Start/end dates** | N/A | ❌ No | ❌ No | ✅ Database fields created |
| **Display location** | N/A | ❌ No | ❌ No | ✅ `display_location` field |

**Files to Create:**
- ⏳ TODO: `/admin/banners/page.tsx` (admin CRUD UI)
- ⏳ TODO: `/components/PromotionalBanner.tsx` (frontend component)
- ⏳ TODO: Add banner display logic to homepage/catalog pages

---

### 🟡 PRIORITY 5: PRODUCT ATTRIBUTES & VARIANTS

| Feature | Current State | In Supabase? | In Admin UI? | Action Needed |
|---------|--------------|--------------|--------------|---------------|
| **Product options** | ✅ Stored in `products.options` JSON | ✅ Yes | ⚠️ Partial | Needs dedicated editor UI |
| **Size variants** | ✅ In JSON | ✅ Yes | ⚠️ Manual JSON edit | Build visual variant editor |
| **Color variants** | ✅ In JSON | ✅ Yes | ⚠️ Manual JSON edit | Add color picker UI |
| **Variant prices** | ✅ In JSON | ✅ Yes | ⚠️ Manual JSON edit | Add price grid UI |
| **Stock per variant** | ❌ No inventory system | ❌ No | ❌ No | Create `inventory` table |

**Files to Create:**
- ⏳ TODO: `/admin/catalog/product/edit/[id]/variants` (variant editor)
- ⏳ TODO: `/components/admin/VariantEditor.tsx` (visual editor component)

---

### 🟢 PRIORITY 6: NAVIGATION & FOOTER

| Element | Current State | In Supabase? | In Admin UI? | Action Needed |
|---------|--------------|--------------|--------------|---------------|
| **Main menu links** | Hardcoded in `Navigation.tsx` | ❌ No | ❌ No | Create `navigation_menu` table |
| **Footer links** | Hardcoded in `Footer.tsx` | ❌ No | ❌ No | Create `footer_links` table |
| **Footer contact info** | Hardcoded | ❌ No | ❌ No | Add to `site_settings` |
| **Social media links** | Hardcoded | ❌ No | ❌ No | Create `social_links` table |

---

## Database Schema Created

### ✅ New Tables (Already Created)

```sql
1. hero_content
   - overline_text, title_line1, title_line2, subtitle
   - background_image_url
   - is_active

2. hero_buttons
   - button_text, button_url
   - display_order, row_number
   - is_active

3. why_choose_us_cards
   - title, description
   - icon_name, display_order
   - is_active

4. promotional_banners
   - title, description, image_url
   - link_url, link_text
   - start_date, end_date
   - display_location, is_active

5. section_content
   - section_name (unique key)
   - heading, subheading, body_text
   - cta_text, cta_url, image_url
   - metadata (JSONB), is_active
```

---

## Admin UI Created

### ✅ New Admin Pages (Already Created)

1. **`/admin/content`** - Content Management Hub
   - Tab 1: Hero Section (text, images)
   - Tab 2: Hero Buttons (CRUD, ordering)
   - Tab 3: Feature Cards ("Чому обрати нас")
   - Tab 4: Other Sections (read-only for now)

---

## Implementation Roadmap

### Phase 1: Foundation ✅ DONE
- [x] Create database migrations
- [x] Create admin content management page
- [x] Add RLS policies

### Phase 2: Hero Section ⏳ IN PROGRESS
- [ ] Update `Hero.tsx` to fetch from database
- [ ] Update `app/page.tsx` to pass hero data
- [ ] Test hero content editing flow
- [ ] Test button CRUD operations

### Phase 3: Feature Cards ⏳ TODO
- [ ] Update `HowItWorks.tsx` to fetch from database
- [ ] Add server-side fetch or client-side query
- [ ] Test card editing flow

### Phase 4: Section Content ⏳ TODO
- [ ] Update `GiftIdeas.tsx` to use `section_content`
- [ ] Update `PhotoPrintPromo.tsx` to use `section_content`
- [ ] Update `CustomBookPromo.tsx` to use `section_content`
- [ ] Update `TravelSection` (hardcoded in page.tsx) to use `section_content`

### Phase 5: Promotional Banners ⏳ TODO
- [ ] Create `/admin/banners` CRUD page
- [ ] Create `PromotionalBanner.tsx` component
- [ ] Add banner display logic to pages
- [ ] Test time-based banner visibility

### Phase 6: Navigation & Footer ⏳ TODO
- [ ] Create navigation/footer tables
- [ ] Create admin UI for menu management
- [ ] Update Navigation/Footer components
- [ ] Test link management

### Phase 7: Product Variants ⏳ TODO
- [ ] Create visual variant editor
- [ ] Add inventory tracking
- [ ] Build variant price matrix UI

---

## Testing Checklist

### For Each Editable Element:

1. **Admin Test:**
   - [ ] Can create new item
   - [ ] Can edit existing item
   - [ ] Can delete item
   - [ ] Can toggle visibility (is_active)
   - [ ] Can reorder items (if applicable)
   - [ ] Changes save successfully
   - [ ] Validation works (required fields, etc.)

2. **Public Site Test:**
   - [ ] Content appears correctly
   - [ ] Content updates in real-time (or after revalidation)
   - [ ] No hardcoded fallbacks are shown
   - [ ] Inactive items don't appear
   - [ ] Order is respected

3. **Integration Test:**
   - [ ] Change in admin → appears on public site
   - [ ] No deploy required for content changes
   - [ ] ISR/caching works correctly

---

## Files Created

### ✅ Completed Files

```
supabase/migrations/
├── 20260327000000_create_content_management_system.sql ✅

app/admin/
├── content/
│   └── page.tsx ✅ (Content management hub)
```

### ⏳ Files to Update

```
components/ui/
├── Hero.tsx ⏳ (fetch from hero_content, hero_buttons)
├── HowItWorks.tsx ⏳ (fetch from why_choose_us_cards)
├── GiftIdeas.tsx ⏳ (fetch from section_content)
├── PhotoPrintPromo.tsx ⏳ (fetch from section_content)
├── CustomBookPromo.tsx ⏳ (fetch from section_content)
├── Navigation.tsx ⏳ (fetch from navigation_menu - to be created)
└── Footer.tsx ⏳ (fetch from footer_links - to be created)

app/
└── page.tsx ⏳ (fetch hero data, section data, pass to components)
```

### ⏳ Files to Create

```
app/admin/
├── banners/
│   ├── page.tsx ⏳ (banner list)
│   ├── new/page.tsx ⏳ (create banner)
│   └── [id]/edit/page.tsx ⏳ (edit banner)
├── sections/
│   └── page.tsx ⏳ (section visibility/order management)
└── navigation/
    └── page.tsx ⏳ (menu management)

components/
├── PromotionalBanner.tsx ⏳ (frontend banner display)
└── admin/
    └── VariantEditor.tsx ⏳ (product variant editor)

supabase/migrations/
├── 20260327010000_create_navigation_tables.sql ⏳
└── 20260327020000_create_inventory_table.sql ⏳
```

---

## Hardcoded Content Inventory

### Complete List of Hardcoded Elements Found:

**components/ui/Hero.tsx:**
- Line 97-98: "Фотокнига" button ❌
- Line 100-101: "Глянцевий журнал" button ❌
- Line 106-107: "Журнал з твердою обкладинкою" button ❌
- Line 109-110: "Тревелбук" button ❌
- Line 115-116: "Фотодрук" button ❌
- Line 118-119: "Фотомагніти" button ❌

**components/ui/HowItWorks.tsx:**
- Lines 15-16: Feature 1 title & description ❌
- Lines 19-22: Feature 2 title & description ❌
- Lines 24-27: Feature 3 title & description ❌
- Lines 29-32: Feature 4 title & description ❌
- Line 51: Section heading "Чому варто обрати нас" ❌

**app/page.tsx:**
- Lines 137-150: Travel section heading, image, description ❌

**Other components:**
- `GiftIdeas.tsx` - All text content ❌
- `PhotoPrintPromo.tsx` - All text content ❌
- `CustomBookPromo.tsx` - All text content ❌
- `ConstructorSelection.tsx` - Button text and links ❌
- `Navigation.tsx` - Menu links ❌
- `Footer.tsx` - Footer links and text ❌

---

## Success Criteria

### Definition of "Zero Hardcoded Content":

✅ **PASS** if:
- Every text element on public site can be edited from admin panel
- Every image URL can be changed from admin panel
- Every link/button can be modified from admin panel
- Changes in admin reflect on public site without code deploy
- No fallback content appears (all from database)

❌ **FAIL** if:
- Any text is defined in component code
- Any URLs are hardcoded in JSX
- Any content requires developer to update
- Redeployment needed for content changes

---

## Next Steps

1. ✅ Run migration: `supabase/migrations/20260327000000_create_content_management_system.sql`
2. ✅ Access admin page: `/admin/content`
3. ⏳ Update `Hero.tsx` to fetch from database (Priority 1)
4. ⏳ Update `HowItWorks.tsx` to fetch from database (Priority 2)
5. ⏳ Test full edit → save → display flow
6. ⏳ Continue with remaining priorities

---

**Document Version:** 1.0
**Last Updated:** 2026-03-27
**Status:** Foundation created, implementation in progress
