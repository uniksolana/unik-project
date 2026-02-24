
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    if (typeof window !== 'undefined') {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables. The application cannot initialize the database client.");
    }
}

// Initialize only with valid keys
export const supabase = createClient(
    supabaseUrl as string,
    supabaseKey as string
);
