# Order Tags Schema

## `order_tags`
Stores the available tags that can be assigned to orders.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | uuid | PRIMARY KEY, default `gen_random_uuid()` | Unique identifier |
| `name` | text | NOT NULL | Display name (e.g., "Відправити швидше") |
| `color` | text | NOT NULL | Hex color code (e.g., "#E94560") |
| `icon` | text | NOT NULL | Emoji character (e.g., "⚡") |
| `sort_order` | int | DEFAULT 0 | Sorting order in UI |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |

## `order_tag_assignments`
Maps tags to specific orders.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `order_id` | uuid | PRIMARY KEY, FOREIGN KEY (`orders.id`) ON DELETE CASCADE | The associated order |
| `tag_id` | uuid | PRIMARY KEY, FOREIGN KEY (`order_tags.id`) ON DELETE CASCADE | The assigned tag |
| `added_by` | uuid | FOREIGN KEY (`staff.id`) ON DELETE SET NULL | Staff member who added it |
| `added_at` | timestamptz | DEFAULT now() | Assignment timestamp |

## Initial Data Setup
The following tags will be populated at startup:
1. ⚡ Відправити швидше — #F59E0B
2. ✏️ Гравіювання — #8B5CF6
3. 🎁 Подарункова упаковка — #EC4899
4. 🖋️ Персоналізація — #263A99
5. ⭐ VIP клієнт — #F59E0B
6. 🔄 Повторне замовлення — #10B981
7. ⚠️ Потребує уточнення — #EF4444
