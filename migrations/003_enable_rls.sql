-- V-007 Fix: Enable Row Level Security on all tables
-- This blocks direct access via ANON_KEY from the browser.
-- All data operations now go through /api/data which uses SERVICE_ROLE_KEY.

-- ═══════════════════════════════════════════════════════
-- 1. user_encrypted_data - Contains encrypted contacts & notes
-- ═══════════════════════════════════════════════════════
ALTER TABLE user_encrypted_data ENABLE ROW LEVEL SECURITY;

-- Block all access for anonymous users (anon key)
-- Our API routes use service_role key which bypasses RLS
CREATE POLICY "Deny all for anon"
ON user_encrypted_data
FOR ALL
TO anon
USING (false);

-- Allow service_role full access (used by our API routes)
CREATE POLICY "Service role full access"
ON user_encrypted_data
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ═══════════════════════════════════════════════════════
-- 2. transaction_notes - Contains shared encrypted notes
-- ═══════════════════════════════════════════════════════
ALTER TABLE transaction_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all for anon"
ON transaction_notes
FOR ALL
TO anon
USING (false);

CREATE POLICY "Service role full access"
ON transaction_notes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ═══════════════════════════════════════════════════════
-- 3. legal_consents - Contains user consent records
-- ═══════════════════════════════════════════════════════
ALTER TABLE legal_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all for anon"
ON legal_consents
FOR ALL
TO anon
USING (false);

CREATE POLICY "Service role full access"
ON legal_consents
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);




-- ═══════════════════════════════════════════════════════
-- 4. profiles - Contains user preferences (language, currency)
-- ═══════════════════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all for anon"
ON profiles
FOR ALL
TO anon
USING (false);

CREATE POLICY "Service role full access"
ON profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ═══════════════════════════════════════════════════════
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard > SQL Editor
-- 2. Paste this entire file and click "Run"
-- 3. Add SUPABASE_SERVICE_ROLE_KEY to your .env.local
--    (Find it in Supabase Dashboard > Settings > API > service_role key)
-- 4. Redeploy your app
-- ═══════════════════════════════════════════════════════
