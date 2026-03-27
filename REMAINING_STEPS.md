# 📋 REMAINING DATABASE FIXES

## ✅ COMPLETED

1. ✅ **Database Tables Created** - All 6 tables seeded externally
2. ✅ **Cache Fixed** - Changed `revalidate` from 3600 to 0 in `app/page.tsx`
3. ✅ **Code Pushed** - Latest deployment will fetch fresh database content

**Latest commit:** `d21f737` - Cache fix deployed to production

---

## 🔄 STEP 4: Update Site Content Branding

Touch Memories branding needs to be updated in the `site_content` table.

### Quick Fix:

Run this SQL in Supabase Dashboard:

```sql
UPDATE site_content SET value = 'Доторкніться до спогадів' WHERE key = 'hero_title';
UPDATE site_content SET value = 'Створено з любов''ю' WHERE key = 'hero_subtitle';
UPDATE site_content SET value = 'Тернопіль, вул. Київська 2' WHERE key = 'footer_address';
UPDATE site_content SET value = 'touch.memories3@gmail.com' WHERE key = 'footer_email';

-- Insert if keys don't exist
INSERT INTO site_content (key, value) VALUES
('hero_title', 'Доторкніться до спогадів'),
('hero_subtitle', 'Створено з любов''ю'),
('footer_address', 'Тернопіль, вул. Київська 2'),
('footer_email', 'touch.memories3@gmail.com')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
```

Or run the prepared file: `update-site-content-branding.sql`

**Verify:**
```sql
SELECT key, value FROM site_content WHERE key IN ('hero_title', 'hero_subtitle', 'footer_address', 'footer_email');
```

---

## 🛒 STEP 5: Seed Product Variants

Many products exist but have **0 variants**, meaning customers cannot order them. Each product needs at least 1 variant with a price.

### Products Needing Variants:

| Product | Variants Needed | Price Range |
|---------|----------------|-------------|
| **Фотомагніти** | 7 sizes | 215 ₴ per set |
| **Polaroid** | 1 variant | 7.5 ₴ per print |
| **Настільний календар** | 1 variant | 299 ₴ |
| **Настінний календар A3** | 2 sizes (A3, A4) | 590-690 ₴ |
| **Пазл A4** | 2 sizes | 249-349 ₴ |
| **Книга побажань** | 15 variants (3 sizes × 3 covers × 3 page colors) | 559-1359 ₴ |
| **Подарунковий сертифікат** | Configurable amounts | Variable |
| **Постер** | Base product | Variable |
| **Постер зоряного неба** | Constructor-based | Variable |
| **Постер мапи міста** | Constructor-based | Variable |
| **Фотодрук стандартні розміри** | 20 sizes | 8-44 ₴ |
| **Фотодрук нестандартні розміри** | 10 sizes | 7.5-8 ₴ |
| **Фотокнига з велюровою обкладинкою** | 210 variants (5 sizes × 6 page counts × 7 tiers) | 1050-3555 ₴ |
| **Фотокнига з шкірзамінника** | 208 variants | 1050-3555 ₴ |
| **Фотокнига з тканинною обкладинкою** | 210 variants | 1050-3555 ₴ |

### How to Seed Variants:

#### Option 1: Manual SQL (Small Products)

1. Open `seed-product-variants.sql`
2. Find the product template (e.g., "Фотомагніти")
3. Get the product ID:
   ```sql
   SELECT id FROM products WHERE slug = 'photomagnets';
   ```
4. Copy the product ID (UUID)
5. Uncomment the INSERT block
6. Replace `<product_id>` with the actual UUID
7. Run in Supabase SQL Editor

#### Option 2: Programmatic Seeding (Large Products)

For products with 100+ variants (photobooks), you'll need a script.

**Example: Photobook Variants Script**

Photobook pricing structure:
- 5 sizes: 20×20, 25×25, 20×30, 30×20, 30×30
- 6 page counts: 20, 30, 40, 50, 60, 70 pages
- 7 price tiers based on spread count

Create a Node.js script to generate all combinations:

```javascript
const sizes = [
  { name: '20×20 см', basePrice: 1050 },
  { name: '25×25 см', basePrice: 1200 },
  { name: '20×30 см', basePrice: 1150 },
  { name: '30×20 см', basePrice: 1150 },
  { name: '30×30 см', basePrice: 1350 }
];

const pageCounts = [20, 30, 40, 50, 60, 70];

// Generate all variants
for (const size of sizes) {
  for (const pages of pageCounts) {
    const spreads = pages / 2;
    const price = size.basePrice + (spreads * 50); // Example pricing

    console.log(`INSERT INTO product_variants (product_id, sku, price, attributes) VALUES
      ('<product_id>', 'PB-${size.name}-${pages}P', ${price}, '{"size": "${size.name}", "pages": ${pages}}');`);
  }
}
```

Run the script and execute the generated SQL in Supabase.

#### Option 3: Use Admin UI (Future)

Once product variants editor is fully functional at `/admin/products`, you can add variants via the UI.

---

## 🔍 Verification Queries

### Check which products have 0 variants:
```sql
SELECT
    p.id,
    p.name,
    p.slug,
    COUNT(pv.id) as variant_count
FROM products p
LEFT JOIN product_variants pv ON p.id = pv.product_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.slug
HAVING COUNT(pv.id) = 0
ORDER BY p.name;
```

### Check variant count per product:
```sql
SELECT
    p.name,
    p.slug,
    COUNT(pv.id) as variant_count
FROM products p
LEFT JOIN product_variants pv ON p.id = pv.product_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.slug
ORDER BY variant_count ASC;
```

### Verify specific product variants:
```sql
SELECT pv.sku, pv.price, pv.attributes
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE p.slug = 'photomagnets'
ORDER BY pv.price;
```

---

## 📊 Priority Order

Seed variants in this order based on importance:

1. **HIGH PRIORITY** (Most popular products):
   - Фотомагніти (7 variants)
   - Фотодрук стандартні розміри (20 variants)
   - Polaroid (1 variant)
   - Настільний календар (1 variant)

2. **MEDIUM PRIORITY**:
   - Книга побажань (15 variants)
   - Настінний календар A3 (2 variants)
   - Пазл A4 (2 variants)

3. **LOW PRIORITY** (Large variant sets):
   - Фотокнига з велюровою обкладинкою (210 variants)
   - Фотокнига з шкірзамінника (208 variants)
   - Фотокнига з тканинною обкладинкою (210 variants)
   - Фотодрук нестандартні розміри (10 variants)

4. **SPECIAL PRODUCTS** (Constructor-based, no variants needed):
   - Постер зоряного неба (uses constructor)
   - Постер мапи міста (uses constructor)
   - Подарунковий сертифікат (configurable amount)

---

## 🎯 Next Actions

1. **Run Step 4 SQL** to update site_content branding
2. **Verify homepage** loads fresh data from database (clear cache)
3. **Seed high-priority product variants** (Фотомагніти, Фотодрук, Polaroid, Календар)
4. **Test ordering flow** for one product with variants
5. **Seed remaining variants** as time permits

---

## 📁 Files Created

- ✅ `update-site-content-branding.sql` - Step 4 SQL script
- ✅ `seed-product-variants.sql` - Step 5 templates with examples
- ✅ `REMAINING_STEPS.md` - This file (documentation)

All files committed and pushed to GitHub.
