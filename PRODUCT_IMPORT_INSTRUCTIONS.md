# 📦 PRODUCT IMPORT INSTRUCTIONS

## Overview

This guide explains how to import all 98 products from the old Touch Memories site into the new database.

## Files Created

1. **`import-products-and-navigation.sql`** - Creates categories and navigation structure
2. **`import-all-98-products.sql`** - Imports main products with variants (Guest books, magazines, canvas prints, etc.)
3. **`PRODUCT_IMPORT_INSTRUCTIONS.md`** - This file

## Step-by-Step Process

### Step 1: Run Navigation & Categories SQL

```bash
# In Supabase SQL Editor, run:
import-products-and-navigation.sql
```

This creates:
- ✅ 7 new product categories
- ✅ Navigation links with dropdowns
- ✅ Initial products (Фотомагніти, Polaroid, Calendars, Puzzles)

### Step 2: Run Main Products Import

```bash
# In Supabase SQL Editor, run:
import-all-98-products.sql
```

This imports:
- ✅ Guest books (27 variants)
- ✅ Hard cover magazines (14 variants)
- ✅ Baby albums (9 variants)
- ✅ Canvas prints (14 variants)
- ✅ Instax camera (5 colors)
- ✅ Digital photo frame
- ✅ Instax film
- ✅ Baby footprint kit
- ✅ Accessories (LED curtain, tape, stickers, corners, markers)
- ✅ Gift items (vision board, custom song)

### Step 3: Import File-Based Albums (Manual or Script)

Due to the large number of file-based albums (47 products), you have two options:

#### Option A: Manual SQL (Tedious)

Create individual products for each file-based album using this template:

```sql
DO $$
DECLARE
    album_id UUID;
    category_id UUID;
BEGIN
    SELECT id INTO category_id FROM categories WHERE slug = 'photoalbomy-failykovi';

    INSERT INTO products (name, slug, description, price, categories_id, is_active)
    VALUES (
        'Product Name',
        'product-slug',
        'Description',
        PRICE,
        category_id,
        true
    )
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO album_id;

    IF album_id IS NULL THEN
        SELECT id INTO album_id FROM products WHERE slug = 'product-slug';
    END IF;

    INSERT INTO product_variants (product_id, sku, price, stock_quantity, attributes, is_active) VALUES
    (album_id, 'SKU-CODE', PRICE, 100, '{"Attribute": "Value"}', true)
    ON CONFLICT (sku) DO NOTHING;
END $$;
```

#### Option B: Programmatic Import (Recommended)

Create a Node.js/TypeScript script to generate and execute SQL for all 47 albums.

**File-based albums data:**
- 8× Файликовий велюровий альбом на 200 фото (різні кольори) → 609 грн
- 3× Альбом на 800 фото → 1399 грн
- 1× Альбом на 500 під індивідуальний напис → 1599 грн
- Multiple Фотоальбом на 200 фото → 349-529 грн (various designs)
- Multiple Фотоальбом на 500 фото → 1099-1199 грн
- Multiple Альбом для фотографій → 459-579 грн
- 2× Дитячий альбом → 459-529 грн

### Step 4: Import Scrapbook Albums

7 scrapbook albums with blank pages:

```sql
-- Template for scrapbook albums
-- Category: scrapbook-albums
-- 6× White pages album → 525 грн
-- 1× Black pages with photo window → 439 грн
```

### Step 5: Import Instax Albums

6 Instax mini albums:

```sql
-- Template for Instax albums
-- Category: instax-albums
-- 2× "My world" and "Collect" design → 300 грн
-- 4× Color variants (білий, блакитний, рожевий, зелений) → 320 грн
```

## Verification Queries

### Check total product count:
```sql
SELECT COUNT(*) as total_products FROM products WHERE is_active = true;
```

**Expected:** 98 products

### Check products by category:
```sql
SELECT c.name, COUNT(p.id) as count
FROM categories c
LEFT JOIN products p ON c.id = p.categories_id AND p.is_active = true
GROUP BY c.name
ORDER BY count DESC;
```

### Check products with 0 variants (should be 0):
```sql
SELECT
    p.name,
    COUNT(pv.id) as variant_count
FROM products p
LEFT JOIN product_variants pv ON p.id = pv.product_id
WHERE p.is_active = true
GROUP BY p.id, p.name
HAVING COUNT(pv.id) = 0
ORDER BY p.name;
```

### Check variant price ranges:
```sql
SELECT
    p.name,
    COUNT(pv.id) as variants,
    MIN(pv.price) as min_price,
    MAX(pv.price) as max_price
FROM products p
LEFT JOIN product_variants pv ON p.id = pv.product_id
WHERE p.is_active = true
GROUP BY p.id, p.name
ORDER BY variants DESC;
```

## Categories Created

| Category | Slug | Products |
|----------|------|----------|
| Фотокниги | photobooks | ~5 |
| Глянцеві журнали | hlyantsevi-zhurnaly | ~4 |
| Travelbooks | travelbooks | 1 |
| Фотодрук | prints | 3 |
| Фотомагніти | photomagnets | 1 (7 variants) |
| Постери | posters | ~3 |
| Подарунки | gifts | ~10 |
| Книга побажань | guestbooks | ~2 |
| Фотокалендарі | calendars | 2 |
| Альбоми для вклейки фото | scrapbook-albums | 7 |
| Альбоми Instax | instax-albums | 6 |
| Дитячі товари | kids | ~4 |
| Аксесуари | accessories | ~8 |
| Електроніка | electronics | 1 |
| Фотоальбоми файликові | photoalbomy-failykovi | 47 |

**Total:** 98+ products across 15 categories

## Next Steps

1. ✅ Run SQL migrations in Supabase
2. ✅ Verify product count (should be 98)
3. ✅ Verify all products have at least 1 variant
4. ✅ Test constructors are accessible from navigation
5. ✅ Test homepage constructor buttons work
6. ✅ Test catalog pages show products correctly

## Troubleshooting

### Error: "relation does not exist"
- Make sure you ran the navigation SQL first
- Check that categories table exists

### Error: "duplicate key value"
- Products already exist, this is OK
- SQL uses ON CONFLICT DO NOTHING to skip duplicates

### Products not showing in catalog
- Check `is_active = true` on both products and categories
- Verify `categories_id` foreign key is correct
- Check product has at least 1 active variant

### Constructors not visible in navigation
- Run the navigation SQL to create dropdown links
- Verify navigation_links table has parent_id relationships
- Check Navigation component was updated to support dropdowns
