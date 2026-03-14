-- Make category_id optional in products table
ALTER TABLE products ALTER COLUMN category_id DROP NOT NULL;
