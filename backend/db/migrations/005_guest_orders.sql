-- Guest checkout: a customer orders with just a phone number and a delivery location (no account).
-- Payment is on delivery for now; payment_method leaves room for mobile-money checkout later.
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN currency SET DEFAULT 'TZS';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_ref       VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name   VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone  VARCHAR(15);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method  VARCHAR(20) NOT NULL DEFAULT 'on_delivery';
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_ref ON orders(order_ref);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);

-- Keep the product name as it was when ordered (the seller may rename or remove the product later)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_title VARCHAR(255);
