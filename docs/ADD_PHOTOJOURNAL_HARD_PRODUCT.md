# Adding Photojournal Hard Cover Product to Database

This document contains the SQL command to add the new "Журнал з твердою обкладинкою" (Photojournal Hard Cover) product to the Supabase database.

## Product Details

- **Slug**: `photojournal-hard-cover`
- **Name**: Журнал з твердою обкладинкою
- **Category**: magazines (same as glossy magazine)
- **Base Price**: 600 грн
- **Description**: Збережіть свої спогади у стильному журналі — створеному спеціально для ваших історій. Формат A4 (210×297 мм), тверда матова або глянцева обкладинка, глянцевий крейдований папір 170 г/м².

## SQL Command

Execute this SQL in your Supabase SQL Editor:

```sql
-- First, get the category ID for 'magazines'
-- SELECT id FROM categories WHERE slug = 'magazines';

-- Insert the new product
INSERT INTO products (
  slug,
  name,
  short_description,
  description,
  category_id,
  price,
  price_from,
  is_active,
  is_personalized,
  images,
  specs,
  created_at,
  updated_at
) VALUES (
  'photojournal-hard-cover',
  'Журнал з твердою обкладинкою',
  'Формат A4, тверда обкладинка, глянцевий папір 170 г/м²',
  'Збережіть свої спогади у стильному журналі — створеному спеціально для ваших історій. Формат A4 (210×297 мм), тверда матова або глянцева обкладинка, глянцевий крейдований папір 170 г/м².',
  (SELECT id FROM categories WHERE slug = 'magazines'),  -- Get magazines category ID
  600,
  true,
  true,
  true,
  ARRAY[
    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80',
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=80'
  ],
  ARRAY[
    '{"key": "Розмір", "value": "A4 (210×297 мм)"}',
    '{"key": "Папір", "value": "глянцевий, крейдований, 170 г/м²"}',
    '{"key": "Обкладинка", "value": "тверда, матова або глянцева"}',
    '{"key": "Кількість сторінок", "value": "від 12 до 80 (парна кількість)"}',
    '{"key": "Форзаци", "value": "можна додати друк (+200 грн)"}'
  ],
  NOW(),
  NOW()
);
```

## Pricing Structure

The pricing is already configured in `ProductOptionsSelector.tsx` as `PHOTOJOURNAL_HARD_PAGE_PRICES`:

| Pages | Price (грн) |
|-------|-------------|
| 12    | 600         |
| 16    | 750         |
| 20    | 900         |
| 24    | 1050        |
| 28    | 1200        |
| 32    | 1350        |
| 36    | 1500        |
| 40    | 1650        |
| 44    | 1800        |
| 48    | 1950        |
| 52    | 2075        |
| 60    | 2275        |
| 72    | 2575        |
| 80    | 2825        |

## Product Options

The product will automatically have the following options configured through `ProductOptionsSelector.tsx`:

1. **Розмір**: A4 (210×297 мм) - fixed/display only
2. **Кількість сторінок**: 12-80 pages (dropdown selector with dynamic pricing)

## Product Detection

The product will be detected by the slug containing `photojournal-hard`, configured in the `detectProductType()` function.

## After Adding the Product

1. Execute the SQL command in Supabase
2. Verify the product appears in `/catalog?category=magazines`
3. Navigate to `/catalog/photojournal-hard-cover` to see the product page
4. Test the option selectors and dynamic pricing

## Notes

- The product uses the same pricing structure as the existing `PHOTO_JOURNAL_HARD` in `lib/products.ts`
- Product images are placeholder URLs from Unsplash - replace with actual product images
- Make sure to set appropriate product images showing the hard cover journal
