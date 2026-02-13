-- V-009 Fix: Payment Orders table for backend verification
-- This table tracks expected payments and their verification status.

CREATE TABLE IF NOT EXISTS payment_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Order details (what we expect)
    merchant_alias TEXT NOT NULL,
    merchant_wallet TEXT NOT NULL,
    expected_amount TEXT NOT NULL,          -- Amount as string to preserve precision
    expected_token TEXT NOT NULL DEFAULT 'SOL',
    concept TEXT,
    
    -- Payment result (what actually happened)
    tx_signature TEXT,                      -- On-chain transaction signature
    actual_amount TEXT,                     -- Verified amount from chain
    payer_wallet TEXT,                      -- Who paid
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | expired | failed
    
    -- HMAC signature of the order (prevents forgery)
    order_sig TEXT NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    
    -- Indexes
    CONSTRAINT unique_tx_signature UNIQUE (tx_signature)
);

-- Index for fast lookups
CREATE INDEX idx_payment_orders_merchant ON payment_orders(merchant_wallet);
CREATE INDEX idx_payment_orders_status ON payment_orders(status);
CREATE INDEX idx_payment_orders_sig ON payment_orders(order_sig);

-- Enable RLS
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon" ON payment_orders FOR ALL TO anon USING (false);
CREATE POLICY "Service access" ON payment_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Paste this file and click "Run"
-- ═══════════════════════════════════════════════════════
