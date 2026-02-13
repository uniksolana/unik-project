import { createClient } from '@supabase/supabase-js';

// Use service role key if available for higher privileges (bypassing RLS if policy allows)
// But for now we stick to standard env vars, assuming the client is initialized correctly
// actually, for server-side rate limiting, we MUST use Service Role to write to rate_limits if RLS is strict
// or ensure RLS allows the operation.
// We will use a dedicated client here if needed, but for now let's reuse a standard pattern or accept standard client.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a dedicated client for rate limiting to ensure reliability
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Checks if a request identifier (e.g. IP) has exceeded the rate limit.
 * @param identifier Unique key (e.g. "ip:127.0.0.1", "wallet:xyz")
 * @param limit Max requests allowed in the window
 * @param windowSeconds Window duration in seconds
 * @returns { success: boolean, remaining: number }
 */
export async function checkRateLimit(identifier: string, limit: number, windowSeconds: number) {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % windowSeconds);
    const key = `rate_limit:${identifier}:${windowStart}`;

    // 1. Try to upsert (increment)
    // Supabase (Postgres) doesn't have a simple atomic increment without a stored procedure or conflicting upsert.
    // We will use a simple read-modify-write for MVP, or better:
    // Insert with ON CONFLICT DO UPDATE.

    // We want to atomically increment. 
    // Since we can't easily do atomic increment via JS client without RPC, 
    // we will try to fetch first.

    try {
        const { data, error } = await supabase
            .from('rate_limits')
            .select('count')
            .eq('key', key)
            .single();

        let currentCount = 0;

        if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
            console.error("Rate limit check error:", error);
            // Fail open if DB error
            return { success: true, remaining: 1 };
        }

        if (data) {
            currentCount = data.count;
        }

        if (currentCount >= limit) {
            return { success: false, remaining: 0 };
        }

        // Increment
        const expiresAt = (windowStart + windowSeconds) * 1000;

        const { error: upsertError } = await supabase
            .from('rate_limits')
            .upsert({
                key,
                count: currentCount + 1,
                expires_at: expiresAt
            }, { onConflict: 'key' });

        if (upsertError) {
            // If race condition happens here, we might count incorrectly but it's okay for rate limiting
            console.error("Rate limit upsert error:", upsertError);
        }

        return { success: true, remaining: limit - (currentCount + 1) };

    } catch (e) {
        console.error("Rate limit exception:", e);
        // Fail open
        return { success: true, remaining: 1 };
    }
}
