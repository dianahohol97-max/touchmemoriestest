# ProductOptions Component

A reusable component for rendering product option selectors with consistent styling across all product pages.

## Features

- ✅ **Dropdown selectors** for standard options
- ✅ **Color swatches** with automatic detection of color names
- ✅ **Required field indicators** (red asterisk)
- ✅ **Checkbox toggles** for boolean options
- ✅ **Number inputs** for quantity/numeric options
- ✅ **Text inputs** for custom text
- ✅ **Consistent styling** matching the velour photobook reference design

## Usage

### 1. Basic Usage

```tsx
import ProductOptions, { ProductAttribute } from '@/components/ProductOptions';

const attributes: ProductAttribute[] = [
  {
    key: 'size',
    label: 'Розмір',
    type: 'select',
    options: ['20×20', '25×25', '30×30'],
    required: true,
    defaultValue: '20×20'
  }
];

<ProductOptions
  attributes={attributes}
  onOptionsChange={(options) => console.log(options)}
/>
```

### 2. With Color Swatches

When option values are color names in Ukrainian, the component automatically renders color circles:

```tsx
const attributes: ProductAttribute[] = [
  {
    key: 'color',
    label: 'Колір обкладинки',
    type: 'color', // or 'select' with color names
    options: ['чорний', 'білий', 'червоний', 'синій', 'зелений'],
    required: true
  }
];
```

**Supported colors:**
- чорний, білий, червоний, синій, зелений, жовтий
- помаранчевий, фіолетовий, рожевий, сірий, коричневий
- бежевий, бордовий, темно-синій, темно-зелений, бірюзовий
- лавандовий, персиковий, мятний, золотий, срібний

### 3. Database Integration

Store attributes in Supabase `products` table using the `custom_attributes` JSONB column:

```sql
UPDATE products
SET custom_attributes = '[
  {
    "key": "size",
    "label": "Розмір",
    "type": "select",
    "options": ["20×20", "25×25", "30×30"],
    "required": true,
    "defaultValue": "20×20"
  },
  {
    "key": "color",
    "label": "Колір",
    "type": "color",
    "options": ["чорний", "білий", "червоний"],
    "required": true
  }
]'::jsonb
WHERE slug = 'velour-photobook';
```

### 4. Complete Example (Product Page)

```tsx
'use client';
import ProductOptions, { ProductAttribute } from '@/components/ProductOptions';
import { useState } from 'react';

export default function ProductPage({ product }) {
  const [selectedOptions, setSelectedOptions] = useState({});

  // Parse attributes from database
  const attributes: ProductAttribute[] = product.custom_attributes || [];

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.price} UAH</p>

      <ProductOptions
        attributes={attributes}
        onOptionsChange={setSelectedOptions}
      />

      <button onClick={() => addToCart(product, selectedOptions)}>
        Додати у кошик
      </button>
    </div>
  );
}
```

## Attribute Types

### Select Dropdown

```tsx
{
  key: 'size',
  label: 'Розмір',
  type: 'select',
  options: ['Малий', 'Середній', 'Великий'],
  required: true,
  defaultValue: 'Середній'
}
```

### Color Swatch

```tsx
{
  key: 'color',
  label: 'Колір',
  type: 'color',
  options: ['чорний', 'білий', 'червоний'],
  required: true,
  defaultValue: 'чорний'
}
```

### Boolean (Checkbox)

```tsx
{
  key: 'lamination',
  label: 'Ламінація',
  type: 'boolean',
  required: false,
  defaultValue: false
}
```

### Number Input

```tsx
{
  key: 'quantity',
  label: 'Кількість',
  type: 'number',
  required: true,
  defaultValue: 1
}
```

### Text Input

```tsx
{
  key: 'custom_text',
  label: 'Текст для гравіювання',
  type: 'text',
  required: false
}
```

## Styling

The component uses CSS modules (`ProductOptions.module.css`) with consistent spacing and colors:

- Background: `#f9f9f9`
- Border radius: `3px`
- Required indicator: Red asterisk `*`
- Color circles: 40px diameter
- Dropdowns: Full width with border focus states

## Integration Points

### ProductContent.tsx

```tsx
import ProductOptions, { ProductAttribute } from '@/components/ProductOptions';

const productAttributes: ProductAttribute[] = product.custom_attributes || [];

<ProductOptions
  attributes={productAttributes}
  onOptionsChange={setSelectedOptions}
/>
```

### cart-store.ts

The selected options are passed to the cart:

```tsx
addItem({
  id: product.id,
  name: product.name,
  price: product.price,
  options: selectedOptions, // { size: '20×20', color: 'чорний', ... }
});
```

## Migration Guide

### Before (Hardcoded)

```tsx
<div>
  <select>
    <option>20×20</option>
    <option>25×25</option>
  </select>
</div>
```

### After (Reusable)

```tsx
<ProductOptions
  attributes={[{
    key: 'size',
    label: 'Розмір',
    type: 'select',
    options: ['20×20', '25×25'],
    required: true
  }]}
  onOptionsChange={setOptions}
/>
```

## Benefits

1. **Consistency**: All products use the same visual structure
2. **Flexibility**: Each product loads unique attributes from database
3. **Maintainability**: Changes to styling happen in one place
4. **Type Safety**: Full TypeScript support
5. **Accessibility**: Proper labels and ARIA attributes

## Examples

See `supabase/migrations/example_product_with_custom_attributes.sql` for complete examples of how to structure attributes in the database.
