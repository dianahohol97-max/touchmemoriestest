-- Migration for flexible custom product attributes
-- Adds custom_attributes and attribute_price_modifiers columns to products table

-- Add custom_attributes column (JSONB for flexible attribute definitions)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '[]'::jsonb;

-- Add attribute_price_modifiers column (JSONB for price modifiers)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS attribute_price_modifiers JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.products.custom_attributes IS 'Flexible custom attributes: [{"key": "engraving", "label": "Гравіювання", "type": "boolean", "required": false}, ...]';
COMMENT ON COLUMN public.products.attribute_price_modifiers IS 'Price modifiers for attributes: {"engraving": 150, "lamination": 80, "paper_type_glossy": 50}';

-- Example data structure for reference:
-- custom_attributes:
-- [
--   { "key": "engraving", "label": "Гравіювання", "type": "boolean", "required": false },
--   { "key": "size", "label": "Розмір", "type": "select", "options": ["Малий", "Середній", "Великий"], "required": true },
--   { "key": "paper_type", "label": "Тип паперу", "type": "select", "options": ["Матовий", "Глянцевий", "Шовковий"], "required": false },
--   { "key": "lamination", "label": "Ламінування", "type": "boolean", "required": false },
--   { "key": "weight", "label": "Вага (г)", "type": "number", "required": false },
--   { "key": "custom_text", "label": "Текст", "type": "text", "required": false }
-- ]
--
-- attribute_price_modifiers:
-- {
--   "engraving": 150,
--   "lamination": 80,
--   "paper_type_Глянцевий": 50,
--   "paper_type_Шовковий": 100,
--   "size_Середній": 50,
--   "size_Великий": 100
-- }
