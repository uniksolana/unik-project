import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using SERVICE_ROLE_KEY.
 * This bypasses RLS and should ONLY be used in API routes (server-side).
 * NEVER import this from client-side code.
 */
export function getServerSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL env var");
    }
    if (!serviceKey) {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env var");
    }

    return createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}
