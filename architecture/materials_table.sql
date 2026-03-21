-- Create materials table for inventory management
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    unit TEXT NOT NULL, -- e.g., 'аркуш', 'кг', 'м', 'шт'
    quantity NUMERIC(10,2) DEFAULT 0,
    min_quantity NUMERIC(10,2) DEFAULT 0,
    supplier TEXT,
    cost_per_unit NUMERIC(10,2) DEFAULT 0,
    last_order_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_materials_quantity ON materials(quantity);
CREATE INDEX IF NOT EXISTS idx_materials_min_quantity ON materials(min_quantity);

-- Create materials_movements table to track stock changes
CREATE TABLE IF NOT EXISTS materials_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
    quantity NUMERIC(10,2) NOT NULL,
    quantity_before NUMERIC(10,2) NOT NULL,
    quantity_after NUMERIC(10,2) NOT NULL,
    reason TEXT,
    notes TEXT,
    added_by UUID REFERENCES staff(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for material movements
CREATE INDEX IF NOT EXISTS idx_materials_movements_material ON materials_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_materials_movements_created ON materials_movements(created_at DESC);

-- Insert default materials
INSERT INTO materials (name, unit, quantity, min_quantity, supplier, cost_per_unit) VALUES
    ('Папір Fujicolor 10x15', 'аркуш', 1000, 200, 'Fujifilm Ukraine', 1.50),
    ('Папір 15x21', 'аркуш', 800, 150, 'Fujifilm Ukraine', 2.80),
    ('Картон обкладинка', 'аркуш', 500, 100, 'Місцевий постачальник', 5.00),
    ('Плівка ламінація', 'м', 300, 50, 'Покрівельні матеріали', 12.00),
    ('Пакувальний матеріал', 'шт', 200, 50, 'Пакування Плюс', 3.50),
    ('Магнітна основа', 'шт', 150, 30, 'Магніт Україна', 8.00)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for materials
CREATE POLICY "Admin full access to materials" ON materials
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to materials_movements" ON materials_movements
    FOR ALL USING (auth.role() = 'authenticated');
