# 🔧 DATABASE FIX INSTRUCTIONS

## Problem
The homepage is broken because migration SQL files were created but never executed on the Supabase database. Missing tables:
- `hero_buttons`
- `why_choose_us_cards`
- `section_content`
- `navigation_links`
- `footer_sections`
- `footer_links`
- `social_media_links`

## Solution - Run SQL in Supabase Dashboard

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard/project/yivfsicvaoewxrtkrfxr
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Execute the Migration
1. Open the file: `MANUAL_RUN_THIS_IN_SUPABASE_DASHBOARD.sql`
2. **Copy the ENTIRE contents** of the file (⌘+A, ⌘+C)
3. **Paste** into the Supabase SQL Editor
4. Click **Run** (or press ⌘+Enter)
5. Wait for execution to complete (~5-10 seconds)

### Step 3: Verify Tables Were Created
Run this query to check:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'hero_content',
    'hero_buttons',
    'why_choose_us_cards',
    'navigation_links',
    'footer_sections',
    'footer_links',
    'section_content'
)
ORDER BY table_name;
```

You should see **7 tables** returned.

### Step 4: Verify Data Was Seeded
Check hero buttons:
```sql
SELECT button_text, button_url, display_order FROM hero_buttons ORDER BY display_order;
```

Should return **6 buttons** (Фотокнига, Глянцевий журнал, etc.)

Check feature cards:
```sql
SELECT title, display_order FROM why_choose_us_cards ORDER BY display_order;
```

Should return **4 cards**.

Check navigation links:
```sql
SELECT link_text, link_url FROM navigation_links ORDER BY display_order;
```

Should return **5+ links**.

Check footer:
```sql
SELECT section_title FROM footer_sections ORDER BY display_order;
```

Should return **3 sections** (Продукти, Допомога, Контакти).

### Step 5: Test Homepage
1. Open https://touchmemories1.vercel.app
2. Verify:
   - ✅ Hero section shows title and buttons
   - ✅ "Чому варто обрати нас" shows 4 cards
   - ✅ Navigation menu has all links
   - ✅ Footer has sections with links
   - ✅ No console errors

## Alternative: Run via Node.js Script (if SQL Editor doesn't work)

If you can't use the Supabase SQL Editor, run the seed script:

```bash
node seed-database.mjs
```

This will attempt to insert data using the Supabase client library.

## What Gets Created

### Tables Created:
1. `hero_content` - Hero section text
2. `hero_buttons` - Category buttons in hero (6 buttons)
3. `why_choose_us_cards` - Feature cards (4 cards)
4. `promotional_banners` - Time-based banners
5. `section_content` - All homepage section content (7 sections)
6. `navigation_links` - Main navigation menu (5 links)
7. `footer_sections` - Footer sections (3 sections)
8. `footer_links` - Footer links (11 links)
9. `social_media_links` - Social media links (3 links)

### Data Seeded:
- **Hero Buttons**: Фотокнига, Глянцевий журнал, Журнал з твердою обкладинкою, Тревелбук, Фотодрук, Фотомагніти
- **Feature Cards**: Преміум якість друку, Персональний дизайн, Доступні ціни, Понад 20 000 клієнтів
- **Navigation**: Фотокниги, Журнали, Travel Book, Фотодрук, Сертифікати
- **Footer Sections**: Продукти, Допомога, Контакти (with 11 total links)
- **Section Content**: Gift ideas, Photo print promo, Custom book promo, Constructor selection, Photobooth, Popular products, Footer brand

## Troubleshooting

### Error: "relation already exists"
This is OK! It means the table was already created. The `IF NOT EXISTS` clause prevents errors.

### Error: "duplicate key value violates unique constraint"
This is OK! It means data was already inserted. The `ON CONFLICT DO NOTHING` clause prevents duplicates.

### Error: "permission denied"
Make sure you're logged into the correct Supabase project: https://yivfsicvaoewxrtkrfxr.supabase.co

### Homepage still broken after running SQL
1. Clear browser cache (⌘+Shift+R on Chrome)
2. Check browser console for errors (F12 → Console tab)
3. Verify data exists in tables (run verification queries above)
4. Check deployment: https://vercel.com/dashboard

## Next Steps (Product Variants)

After fixing the database tables, you'll need to seed product variants. See `PRODUCT_VARIANTS_SEED.sql` for details (to be created next).
