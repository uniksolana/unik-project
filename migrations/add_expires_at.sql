-- migrations/add_expires_at_to_payment_orders.sql

-- Add the expires_at column to payment_orders table
-- This allows payment links to have a TTL (Time-To-Live) to fix LOW-06
ALTER TABLE payment_orders ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE NULL;

-- Optional: index the column for faster cleanup queries in the future
CREATE INDEX IF NOT EXISTS idx_payment_orders_expires_at ON payment_orders(expires_at);
