-- Add delivery_status field to orders table for Nova Poshta tracking

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status TEXT;

-- Index for faster queries on tracking
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status);

-- Common delivery statuses from Nova Poshta:
-- 'Відправлено', 'В дорозі', 'Прибув у місто', 'Прибув на відділення', 'Вручено', 'Отримано'
