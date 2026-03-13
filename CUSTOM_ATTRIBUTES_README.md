# Custom Product Attributes - Implementation Guide

## Overview

This feature allows you to add flexible custom attributes to products, enabling dynamic customization options like engraving, paper type, lamination, and more. Each attribute can have its own price modifier that automatically calculates into the final product price.

## Database Schema

### Tables Modified

**`products` table** - Added two new columns:

```sql
custom_attributes JSONB DEFAULT '[]'::jsonb
attribute_price_modifiers JSONB DEFAULT '{}'::jsonb
```

### Data Structure Examples

#### `custom_attributes` (Array of attribute definitions)

```json
[
  {
    "key": "engraving",
    "label": "Гравіювання",
    "type": "boolean",
    "required": false
  },
  {
    "key": "paper_type",
    "label": "Тип паперу",
    "type": "select",
    "options": ["Матовий", "Глянцевий", "Шовковий"],
    "required": false
  },
  {
    "key": "size",
    "label": "Розмір",
    "type": "select",
    "options": ["Малий", "Середній", "Великий"],
    "required": true
  },
  {
    "key": "weight",
    "label": "Вага (г)",
    "type": "number",
    "min": 100,
    "max": 1000,
    "placeholder": "Введіть вагу"
  },
  {
    "key": "custom_text",
    "label": "Власний текст",
    "type": "text",
    "placeholder": "Введіть текст..."
  }
]
```

#### `attribute_price_modifiers` (Object mapping attribute values to price changes)

```json
{
  "engraving": 150,
  "lamination": 80,
  "paper_type_Глянцевий": 50,
  "paper_type_Шовковий": 100,
  "size_Середній": 50,
  "size_Великий": 100
}
```

**Format for price modifiers:**
- Boolean attributes: `"attribute_key": price` (e.g., `"engraving": 150`)
- Select attributes: `"attribute_key_OptionValue": price` (e.g., `"paper_type_Глянцевий": 50`)

## Migration

### Apply the migration

```bash
node tools/apply_custom_attributes_migration.mjs
```

This will add the required columns to your `products` table.

## Admin Panel Usage

### Adding Custom Attributes to a Product

1. Go to **Admin > Products > Edit Product** (or create a new product)
2. Scroll to the **"Додаткові характеристики"** section
3. Click **"＋ Додати характеристику"**
4. Fill in the attribute details:
   - **Назва характеристики**: Display label (e.g., "Гравіювання")
   - **Ключ**: Auto-generated system key (e.g., "engraving")
   - **Тип поля**: Choose attribute type
   - **Цінова надбавка**: Optional price increase

### Attribute Types

#### 1. Boolean (Checkbox)
- User sees a checkbox toggle
- Example: "Гравіювання", "Ламінування"
- Price modifier applies when checked

#### 2. Select (Dropdown)
- User sees a list of options to choose from
- Example: "Тип паперу: Матовий, Глянцевий, Шовковий"
- Each option can have its own price modifier

#### 3. Number
- User enters a numeric value
- Can set min/max constraints
- Example: "Вага (г)" with min: 100, max: 1000

#### 4. Text
- User enters free-form text
- Example: "Власний текст для гравіювання"

### Editing/Deleting Attributes

- Click the **Edit** button (pencil icon) to modify an attribute
- Click the **Delete** button (trash icon) to remove an attribute
- Changes are saved when you save the product

## Customer-Facing Product Page

### How Customers See Custom Attributes

After the standard format and cover selectors, customers will see dynamic fields based on the attributes you've configured:

- **Boolean**: Toggle switch with price label (e.g., "✓ Гравіювання +150 ₴")
- **Select**: Button group with options and prices (e.g., "Глянцевий +50 ₴")
- **Number**: Input field with min/max validation
- **Text**: Text input field

### Price Calculation

The price dynamically updates as customers select different attributes. The total includes:
- Base product price
- Format price modifier (if any)
- Cover price modifier (if any)
- Page count modifier (for photobooks)
- **Custom attribute price modifiers** ✨ NEW

## Cart & Orders

### Cart Items

Selected attributes are stored in the cart with the structure:

```typescript
{
  id: "unique-id",
  name: "Product Name",
  price: 1500,
  qty: 1,
  selected_attributes: {
    "engraving": true,
    "paper_type": "Глянцевий",
    "weight": 250
  }
}
```

### Order Display (Admin)

In the order details page, selected attributes appear under each item with icons:

```
✏️ Гравіювання: Так • 📄 Тип Паперу: Глянцевий • ⚖️ Вага: 250
```

## File Structure

### New Files Created

```
/lib/types/product.ts                          - TypeScript type definitions
/components/admin/AddAttributeModal.tsx        - Modal for adding/editing attributes
/components/admin/CustomAttributeManager.tsx   - Manager component for admin form
/components/ui/ProductAttributeSelector.tsx    - Customer-facing attribute selector
/architecture/custom_attributes_migration.sql  - Database migration
/tools/apply_custom_attributes_migration.mjs   - Migration script
```

### Modified Files

```
/components/admin/AdminProductForm.tsx         - Added custom attributes section
/components/ui/ProductOptions.tsx              - Integrated attribute selector + price calc
/store/cart-store.ts                           - Added selected_attributes to CartItem
/app/admin/orders/[id]/page.tsx               - Display attributes in order details
```

## TypeScript Types

```typescript
export type AttributeType = 'boolean' | 'select' | 'number' | 'text';

export interface CustomAttribute {
  key: string;
  label: string;
  type: AttributeType;
  options?: string[];         // For select type
  required?: boolean;
  min?: number;              // For number type
  max?: number;              // For number type
  placeholder?: string;      // For text/number type
}

export interface AttributePriceModifiers {
  [key: string]: number;     // e.g., "engraving": 150
}

export interface SelectedAttributes {
  [key: string]: boolean | string | number;  // Customer selections
}
```

## API Integration

The custom attributes integrate seamlessly with your existing Supabase setup:

1. Attributes are saved as JSONB in the `products` table
2. No additional API endpoints needed
3. Works with existing product CRUD operations
4. Selected attributes flow through cart → checkout → orders

## Best Practices

### Naming Conventions

- Use descriptive labels in Ukrainian: "Гравіювання", "Тип паперу"
- Keys are auto-generated as slugs: "engraving", "paper_type"
- Keep keys unique per product

### Price Modifiers

- Set realistic prices that reflect actual costs
- Use whole numbers (no decimals needed for UAH)
- Test price calculations before publishing

### Required Fields

- Mark attributes as required only when necessary
- Required attributes must be filled before adding to cart
- Consider user experience when making fields mandatory

### Attribute Ordering

Attributes are displayed in the order they were added. To reorder:
1. Delete the attribute
2. Re-add it in the desired position

## Example Use Cases

### 1. Photobook with Engraving
```json
{
  "custom_attributes": [
    {
      "key": "engraving",
      "label": "Гравіювання на обкладинці",
      "type": "boolean"
    },
    {
      "key": "engraving_text",
      "label": "Текст гравіювання",
      "type": "text",
      "placeholder": "До 50 символів"
    }
  ],
  "attribute_price_modifiers": {
    "engraving": 150
  }
}
```

### 2. Custom Prints with Multiple Options
```json
{
  "custom_attributes": [
    {
      "key": "paper_type",
      "label": "Тип паперу",
      "type": "select",
      "options": ["Матовий", "Глянцевий", "Шовковий"],
      "required": true
    },
    {
      "key": "lamination",
      "label": "Ламінування",
      "type": "boolean"
    }
  ],
  "attribute_price_modifiers": {
    "paper_type_Глянцевий": 50,
    "paper_type_Шовковий": 150,
    "lamination": 80
  }
}
```

### 3. Size-Based Pricing
```json
{
  "custom_attributes": [
    {
      "key": "size",
      "label": "Розмір",
      "type": "select",
      "options": ["Малий", "Середній", "Великий"],
      "required": true
    }
  ],
  "attribute_price_modifiers": {
    "size_Середній": 100,
    "size_Великий": 250
  }
}
```

## Troubleshooting

### Attributes not showing on product page
- Check that `custom_attributes` array is not empty
- Verify the product data includes the new fields
- Ensure the product page component is receiving the full product object

### Price not updating
- Check that `attribute_price_modifiers` keys match the attribute selections
- For select types, ensure format: `"attribute_key_OptionValue"`
- Verify price modifiers are numbers, not strings

### Migration fails
- Ensure you have the correct database credentials in `.env`
- Check that the `products` table exists
- Verify you have permission to alter the table schema

## Future Enhancements

Potential improvements for future iterations:

- [ ] Image upload for attribute options (visual swatches)
- [ ] Conditional attributes (show/hide based on other selections)
- [ ] Attribute templates for quick setup
- [ ] Bulk import/export of attributes
- [ ] Attribute groups/categories
- [ ] Dynamic validation rules
- [ ] Multi-language support for attribute labels

## Support

For questions or issues with custom attributes:
1. Check this documentation first
2. Review the example implementations in the codebase
3. Test in a development environment before production changes

---

**Version:** 1.0
**Last Updated:** March 2026
**Implementation:** Touch Memories E-commerce Platform
