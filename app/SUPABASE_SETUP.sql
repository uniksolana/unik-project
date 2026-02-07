-- Run this SQL in your Supabase SQL Editor to enable Public Profiles

-- 1. Create the 'avatars' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow PUBLIC access (Read/Write) to the avatars bucket
-- WARNING: This allows anyone to upload/overwrite avatars if they know the filename (wallet address).
-- Ideally, you would use RLS to only allow auth.uid() = owner, but since we use Wallet Auth (custom),
-- we rely on this open policy for the MVP. The frontend does client-side verification.
DROP POLICY IF EXISTS "Public Access Avatars" ON storage.objects;

CREATE POLICY "Public Access Avatars"
ON storage.objects FOR ALL
USING ( bucket_id = 'avatars' )
WITH CHECK ( bucket_id = 'avatars' );

-- 3. (Optional) If you have a 'profiles' table, you would enable public read here too.
