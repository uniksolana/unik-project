
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    // Only log error in development or if strict mode required
    if (typeof window !== 'undefined') {
        console.error("🚨 Supabase credentials missing! Database features (Risk Modal, Contacts) will not work.");
        console.info("Please create an .env.local file with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
}

// Initialize with fallback to prevent immediate crash, but calls will fail
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder-key'
);
