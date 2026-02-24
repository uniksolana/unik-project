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

// In-memory cache for fast rate limiting and reducing DB race conditions during bursts
const localCache = new Map<string, { count: number, expiresAt: number }>();

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
    const expiresAt = (windowStart + windowSeconds) * 1000;

    // M-01: Use in-memory cache first to prevent rapid-fire race conditions on the DB
    const cached = localCache.get(key);
    if (cached) {
        if (Date.now() > cached.expiresAt) {
            localCache.delete(key);
        } else {
            cached.count++;
            if (cached.count > limit) {
                return { success: false, remaining: 0 };
            }
            // Still propagate to DB asynchronously to share state across Vercel instances
            updateDbRateLimit(key, cached.count, expiresAt).catch(console.error);
            return { success: true, remaining: limit - cached.count };
        }
    }

    // If not in cache, fallback to DB
    try {
        const { data, error } = await supabase
            .from('rate_limits')
            .select('count')
            .eq('key', key)
            .single();

        let currentCount = 0;

        if (!error && data) {
            currentCount = data.count;
        }

        if (currentCount >= limit) {
            localCache.set(key, { count: currentCount + 1, expiresAt });
            return { success: false, remaining: 0 };
        }

        const newCount = currentCount + 1;
        localCache.set(key, { count: newCount, expiresAt });

        // Wait for DB on first cache miss
        await updateDbRateLimit(key, newCount, expiresAt);

        return { success: true, remaining: limit - newCount };

    } catch (e) {
        console.error("Rate limit exception:", e);
        return { success: true, remaining: 1 };
    }
}

// Helper to update DB asynchronously
async function updateDbRateLimit(key: string, count: number, expiresAt: number) {
    await supabase
        .from('rate_limits')
        .upsert({
            key,
            count: count,
            expires_at: expiresAt
        }, { onConflict: 'key' });
}
