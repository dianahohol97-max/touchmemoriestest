-- Loyalty System for Clients/Customers
-- Add fields for birthday tracking, telegram subscription, loyalty tier, orders count, and total spent

-- Add columns if they don't exist
ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS telegram_subscribed BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_tier TEXT DEFAULT 'Новий';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_order_date TIMESTAMPTZ;

-- Also check if clients table exists (some systems use 'clients' instead of 'customers')
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'clients') THEN
        ALTER TABLE clients ADD COLUMN IF NOT EXISTS birthday DATE;
        ALTER TABLE clients ADD COLUMN IF NOT EXISTS telegram_subscribed BOOLEAN DEFAULT false;
        ALTER TABLE clients ADD COLUMN IF NOT EXISTS loyalty_tier TEXT DEFAULT 'Новий';
        ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
        ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_order_date TIMESTAMPTZ;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_loyalty_tier ON customers(loyalty_tier);
CREATE INDEX IF NOT EXISTS idx_customers_birthday ON customers(birthday);
CREATE INDEX IF NOT EXISTS idx_customers_total_spent ON customers(total_spent DESC);
CREATE INDEX IF NOT EXISTS idx_customers_telegram ON customers(telegram_subscribed);

-- Function to calculate loyalty tier based on total orders
CREATE OR REPLACE FUNCTION calculate_loyalty_tier(order_count INTEGER)
RETURNS TEXT AS $$
BEGIN
    IF order_count >= 10 THEN
        RETURN 'Преміум';
    ELSIF order_count >= 5 THEN
        RETURN 'VIP';
    ELSIF order_count >= 2 THEN
        RETURN 'Постійний';
    ELSE
        RETURN 'Новий';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get loyalty discount percentage
CREATE OR REPLACE FUNCTION get_loyalty_discount(tier TEXT)
RETURNS INTEGER AS $$
BEGIN
    CASE tier
        WHEN 'Преміум' THEN RETURN 15;
        WHEN 'VIP' THEN RETURN 10;
        WHEN 'Постійний' THEN RETURN 5;
        ELSE RETURN 0;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function to update customer stats when order is created/updated
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
DECLARE
    customer_id_val UUID;
    order_count INTEGER;
    total_amount DECIMAL(10,2);
    new_tier TEXT;
BEGIN
    -- Get customer_id from new or old record
    customer_id_val := COALESCE(NEW.customer_id, OLD.customer_id);

    IF customer_id_val IS NULL THEN
        RETURN NEW;
    END IF;

    -- Calculate total orders and spent for this customer
    SELECT
        COUNT(*),
        COALESCE(SUM(total), 0)
    INTO order_count, total_amount
    FROM orders
    WHERE customer_id = customer_id_val
      AND order_status != 'cancelled';

    -- Calculate new loyalty tier
    new_tier := calculate_loyalty_tier(order_count);

    -- Update customer record
    UPDATE customers
    SET
        total_orders = order_count,
        total_spent = total_amount,
        loyalty_tier = new_tier,
        last_order_date = (
            SELECT created_at
            FROM orders
            WHERE customer_id = customer_id_val
            ORDER BY created_at DESC
            LIMIT 1
        )
    WHERE id = customer_id_val;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS update_customer_stats_trigger ON orders;
CREATE TRIGGER update_customer_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_stats();

-- Update existing customers' loyalty tiers based on current orders
UPDATE customers c
SET
    total_orders = (
        SELECT COUNT(*)
        FROM orders o
        WHERE o.customer_id = c.id
          AND o.order_status != 'cancelled'
    ),
    total_spent = (
        SELECT COALESCE(SUM(o.total), 0)
        FROM orders o
        WHERE o.customer_id = c.id
          AND o.order_status != 'cancelled'
    ),
    loyalty_tier = calculate_loyalty_tier((
        SELECT COUNT(*)
        FROM orders o
        WHERE o.customer_id = c.id
          AND o.order_status != 'cancelled'
    )),
    last_order_date = (
        SELECT o.created_at
        FROM orders o
        WHERE o.customer_id = c.id
        ORDER BY o.created_at DESC
        LIMIT 1
    );

-- Comment: Loyalty Tiers and Discounts
-- Новий (1 order): 0% discount, Bronze badge 🥉
-- Постійний (2-4 orders): 5% discount, Silver badge 🥈
-- VIP (5-9 orders): 10% discount, Gold badge 🥇
-- Преміум (10+ orders): 15% discount, Diamond badge 💎
