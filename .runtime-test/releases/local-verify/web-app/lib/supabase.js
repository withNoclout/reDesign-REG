
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Client-side usage (public data only if RLS enabled, or explicit public buckets)
let supabase = null
if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey)
} else {
    console.warn('[Supabase] Client not initialized: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}
export { supabase }

// Server-side usage (Full Admin Access - use carefully in API routes only)
export const getServiceSupabase = () => {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error(
            'Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
        )
    }
    return createClient(supabaseUrl, supabaseServiceKey)
}
