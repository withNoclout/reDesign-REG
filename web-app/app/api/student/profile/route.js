import { NextResponse } from 'next/server';
import { fetchFromUniversityApi } from '@/lib/universityApi';
import { parseProfileData } from '@/lib/profileParser';
import { getCachedProfile, cacheProfile } from '@/lib/supabaseProfile';
import { success, unauthorized } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';

const memoryCache = new Map();
const MEMORY_TTL_MS = 5 * 60 * 1000;

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildSsoFallbackProfile(authContext) {
    const ssoUser = authContext?.ssoUser;
    const studentInfo = ssoUser?.studentInfo && typeof ssoUser.studentInfo === 'object' ? ssoUser.studentInfo : {};
    const userId = authContext?.userId;
    if (!ssoUser || !userId) return null;

    return {
        studentId: userId,
        faculty: readString(studentInfo.faculty_name) || readString(studentInfo.faculty) || null,
        department: readString(studentInfo.department_name) || readString(studentInfo.department) || null,
        major: readString(studentInfo.program_name) || readString(studentInfo.curriculum_name) || readString(studentInfo.major) || null,
        advisor1: readString(studentInfo.advisor_name) || readString(studentInfo.advisor1) || null,
        advisor2: readString(studentInfo.advisor2) || null,
        advisor3: readString(studentInfo.advisor3) || null,
        admitYear: readString(studentInfo.admitacadyear) || readString(studentInfo.admit_year) || null,
        currentYear: readString(studentInfo.currentacadyear) || readString(studentInfo.current_year) || null,
        currentSemester: readString(studentInfo.currentsemester) || readString(studentInfo.current_semester) || null,
        enrollYear: readString(studentInfo.enrollacadyear) || readString(studentInfo.enroll_year) || null,
        enrollSemester: readString(studentInfo.enrollsemester) || readString(studentInfo.enroll_semester) || null,
        partialSource: 'kmutnb_sso',
    };
}

export async function GET() {
    try {
        const authContext = await getAuthContext();
        if (!authContext) {
            return unauthorized('No authentication token');
        }

        const { token, userId, authProvider } = authContext;

        if (userId) {
            const memCached = memoryCache.get(userId);
            if (memCached && (Date.now() - memCached.timestamp < MEMORY_TTL_MS)) {
                console.log(`[Profile Controller] L1 Memory Cache Hit: ${userId}`);
                return success(memCached.data);
            }
        }

        if (userId) {
            const dbProfile = await getCachedProfile(userId);
            if (dbProfile) {
                console.log(`[Profile Controller] L2 Database Cache Hit: ${userId}`);
                memoryCache.set(userId, { timestamp: Date.now(), data: dbProfile });
                return success(dbProfile);
            }
        }

        if (!token && authProvider === 'kmutnb_sso') {
            const fallbackProfile = buildSsoFallbackProfile(authContext);
            if (fallbackProfile) {
                console.log(`[Profile Controller] Serving KMUTNB SSO fallback profile for ${userId}`);
                memoryCache.set(userId, { timestamp: Date.now(), data: fallbackProfile });
                return success(fallbackProfile);
            }
        }

        console.log('[Profile Controller] No Cache found. Fetching from University API...');

        try {
            const rawApiData = await fetchFromUniversityApi(token);
            const { profile, isPartial } = parseProfileData(rawApiData, userId);

            if (!isPartial) {
                await cacheProfile(profile);
                memoryCache.set(userId || profile.studentId, { timestamp: Date.now(), data: profile });
                console.log(`[Profile Controller] Cached full profile for ${profile.studentId}`);
            } else {
                console.warn(`[Profile Controller] Partial profile for ${profile.studentId} — will not cache`);
            }

            return success(profile);
        } catch (fetchOrParseError) {
            console.warn('[Profile Controller] Fetch/Parse Failed:', fetchOrParseError.message);

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
