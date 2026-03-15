# 🎨 Website Designer Architecture Schema

This document outlines the Supabase database schema for the dynamic website designer and role-based pricing functionality.

---

## 🏗️ Table: `theme_settings`
Stores the single, active configuration for the global website theme.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK, Default `uuid_generate_v4()` | Unique identifier |
| `color_primary` | `text` | Default `'#263A99'` | Primary brand color (hex) |
| `color_secondary` | `text` | Default `'#f1f5f9'` | Secondary/Background color |
| `color_accent` | `text` | Default `'#263A99'` | Accent/Highlight color |
| `color_background` | `text` | Default `'#ffffff'` | Main background color |
| `color_text` | `text` | Default `'#263A99'` | Main text color |
| `font_family_heading` | `text` | Default `'Inter'` | Font for h1, h2, h3 |
| `font_family_body` | `text` | Default `'Inter'` | Font for p, span, li |
| `font_size_h1` | `integer` | Default `48` | H1 size in px |
| `font_size_h2` | `integer` | Default `32` | H2 size in px |
| `font_size_body` | `integer` | Default `16` | Body size in px |
| `border_radius` | `integer` | Default `8` | General card/image rounding in px |
| `spacing_unit` | `integer` | Default `8` | Base UI spacing variable in px |
| `button_border_radius` | `integer` | Default `8` | Button rounding in px |
| `button_text_primary` | `text` | Default `'#ffffff'` | Text color on primary buttons |
| `button_text_secondary` | `text` | Default `'#263A99'` | Text color on secondary buttons |
| `updated_at` | `timestamptz` | Default `now()` | Last modification timestamp |

---

## 🏗️ Table: `theme_presets`
Stores a library of pre-configured design snapshots that can be applied to `theme_settings`.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK, Default `uuid_generate_v4()` | Unique identifier |
| `name` | `text` | Unique, Not Null | Preset name (e.g., 'minimal', 'elegant') |
| `settings` | `jsonb` | Not Null | JSON dump matching `theme_settings` column structure |
| `created_at` | `timestamptz` | Default `now()` | Creation timestamp |

---

## 🏗️ Table: `site_blocks`
Manages logical UI sections (Hero, Categories, Products, Blog, Footer), their visibility, sorting order, and potential hero/background images.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK, Default `uuid_generate_v4()` | Unique identifier |
| `block_name` | `text` | Unique, Not Null | Identifier like 'hero', 'featured_products' |
| `is_visible` | `boolean` | Default `true` | Show or hide section globally |
| `position_order` | `integer` | Not Null | Controls vertical vertical rendering order |
| `image_url` | `text` | Nullable | URL to Supabase Storage if the block contains a customizable visual |
| `updated_at` | `timestamptz` | Default `now()` | Last modification timestamp |

---

## 🏗️ Table: `site_content`
A key-value store for dynamically editable strings and URLs across the site layout (call to action buttons, hero headings, etc.).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK, Default `uuid_generate_v4()` | Unique identifier |
| `key` | `text` | Unique, Not Null | 'hero_title', 'about_button_url', etc. |
| `value` | `text` | Nullable | The raw string or localized payload |
| `updated_at` | `timestamptz` | Default `now()` | Last modification timestamp |

---

## 🏗️ Table: `role_pricing`
Facilitates dynamic B2B constraints, tracking product variants against specific user roles for pricing overrides.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK, Default `uuid_generate_v4()` | Unique identifier |
| `product_id` | `uuid` | FK references `products` | The product being overridden |
| `role` | `text` | Enum('default', 'photographer', 'corporate') | The target user group |
| `price` | `numeric(10,2)`| Nullable | Fixed fiat override price |
| `discount_percent` | `integer` | Nullable, max 100 | Percentage-based discount |
| `is_visible` | `boolean` | Default `true` | Hide certain products from certain roles |
| `updated_at` | `timestamptz` | Default `now()` | Last modification timestamp |

---

## 🔐 RLS (Row Level Security) Models
* **Public Access (READ-ONLY):**
   * Unauthenticated users have `SELECT` grants across `theme_settings`, `theme_presets`, `site_blocks`, and `site_content`.
   * Unauthenticated users have `SELECT` grants for `role_pricing` where `role = 'default'`.

* **Authenticated Roles:**
   * 'photographer' and 'corporate' profiles can `SELECT` from `role_pricing` matching their tag.

* **Admin Operations:**
   * Only rows carrying full permissions (`role = 'admin'`) or Service Roles running on the MCP server can execute `INSERT`, `UPDATE`, or `DELETE`.
