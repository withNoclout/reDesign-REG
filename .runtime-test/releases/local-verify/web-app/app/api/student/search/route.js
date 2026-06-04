import { getAuthUser } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { createRateLimiter, getClientIp } from '@/lib/rateLimit';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import { success, error, unauthorized, rateLimited, validationError } from '@/lib/apiResponse';

const searchLimiter = createRateLimiter({
    namespace: 'student-search',
    maxAttempts: 10,
    windowMs: 60 * 1000, // 10 requests per minute
});

export async function GET(request) {
    try {
        // Auth required
        const userId = await getAuthUser();
        if (!userId) return unauthorized();

        // Rate limit by user
        const limit = searchLimiter.check(userId);
        if (!limit.allowed) return rateLimited(limit.retryAfterMs);
        searchLimiter.increment(userId);

        // Parse and validate query
        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q');

        const { valid, sanitized, error: validationErr } = sanitizeSearchQuery(q, {
            minLength: 3,
            maxLength: 50,
        });

        if (!valid) return validationError(validationErr);

        const supabase = getServiceSupabase();
        const searchPattern = `%${sanitized}%`;

        // Search user_directory — may return 0 results if students haven't logged in yet
        let results = [];
        try {
            const { data, error: dbError } = await supabase
                .from('user_directory')
                .select('user_code, name_th, name_en, avatar_url')
                .or(`name_th.ilike.${searchPattern},name_en.ilike.${searchPattern},user_code.ilike.${searchPattern}`)
                .neq('user_code', userId)
                .limit(10);

            if (!dbError && data) {
                results = data;
            }
        } catch (dbErr) {
            // Table might not exist yet — continue with empty results
            console.warn('[API] user_directory query failed:', dbErr.message);
        }

        return success(results);
    } catch (err) {
        console.error('[API] Student search error:', err.message);
        return error('Internal server error', 500);
    }
}
