
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Client-side usage (public data only if RLS enabled, or explicit public buckets)
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
)

// Server-side usage (Full Admin Access - use carefully in API routes only)
export const getServiceSupabase = () => {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase Service Key or URL')
    }
    return createClient(supabaseUrl, supabaseServiceKey)
}
