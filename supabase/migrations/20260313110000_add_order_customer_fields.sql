-- Migration: Add telegram and birthday to orders and customers
-- Description: Adds customer_telegram and customer_birthday to orders, and telegram and birthday to customers.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_telegram TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_birthday DATE;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS telegram TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday DATE;
