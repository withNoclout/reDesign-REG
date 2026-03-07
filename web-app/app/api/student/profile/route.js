import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchFromUniversityApi } from '@/lib/universityApi';
import { parseProfileData } from '@/lib/profileParser';
import { getCachedProfile, cacheProfile } from '@/lib/supabaseProfile';
import { success, unauthorized } from '@/lib/apiResponse';

// Rapid In-Memory Cache (0ms latency, saves DB hits)
// Keys: student_id, Values: { timestamp, data: StudentProfile }
const memoryCache = new Map();
const MEMORY_TTL_MS = 5 * 60 * 1000; // 5 mins

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('reg_token')?.value;
        const storedStudentId = cookieStore.get('std_code')?.value;

        if (!token) {
            return unauthorized('No authentication token');
        }

        // --- 1. L1 CACHE: IN-MEMORY (Instant) ---
        if (storedStudentId) {
            const memCached = memoryCache.get(storedStudentId);
            if (memCached && (Date.now() - memCached.timestamp < MEMORY_TTL_MS)) {
                console.log(`[Profile Controller] L1 Memory Cache Hit: ${storedStudentId}`);
                return success(memCached.data);
            }
        }

        // --- 2. L2 CACHE: DATABASE (Database-First Approach) ---
        if (storedStudentId) {
            const dbProfile = await getCachedProfile(storedStudentId);
            if (dbProfile) {
                console.log(`[Profile Controller] L2 Database Cache Hit: ${storedStudentId}`);

                // Promote to L1 Memory Cache
                memoryCache.set(storedStudentId, { timestamp: Date.now(), data: dbProfile });

                return success(dbProfile);
            }
        }

        // --- 3. FETCH: FIRST TIME LOGIN OR NO CACHE ---
        console.log(`[Profile Controller] No Cache found. Fetching from University API...`);

        try {
            // Fetch raw data
            const rawApiData = await fetchFromUniversityApi(token);

            // Parse & Validate — pass storedStudentId as cookie fallback since
            // Getacadstd does not always return studentCode/usercode in its response.
            const { profile, isPartial } = parseProfileData(rawApiData, storedStudentId);


            // Only cache if we have a complete profile (Full Atomic Promise)
            if (!isPartial) {
                await cacheProfile(profile);
                memoryCache.set(profile.studentId, { timestamp: Date.now(), data: profile });
                console.log(`[Profile Controller] Cached full profile for ${profile.studentId}`);
            } else {
                // Partial data — still return it but don't persist so next request tries again
                console.warn(`[Profile Controller] Partial profile for ${profile.studentId} — will not cache`);
            }

            return success(profile);

        } catch (fetchOrParseError) {
            console.warn(`[Profile Controller] Fetch/Parse Failed:`, fetchOrParseError.message);

            if (fetchOrParseError.isAuthError) {
                return NextResponse.json({ success: false, message: 'Session Expired', code: 'SESSION_EXPIRED' }, { status: 401 });
            }

            return NextResponse.json({ success: false, message: 'Service Unavailable (Upstream API Down and No Cache)' }, { status: 503 });
        }

    } catch (error) {
        console.error('[Profile Controller] Critical Error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
