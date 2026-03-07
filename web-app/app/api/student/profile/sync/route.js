import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchFromUniversityApi } from '@/lib/universityApi';
import { parseProfileData } from '@/lib/profileParser';
import { cacheProfile } from '@/lib/supabaseProfile';
import { success, unauthorized } from '@/lib/apiResponse';

// This endpoint explicitly forces a fresh pull from the University API
// and overwrites the Supabase Database Cache.

export async function POST() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('reg_token')?.value;
        const storedStudentId = cookieStore.get('std_code')?.value;

        if (!token) {
            return unauthorized('No authentication token');
        }

        console.log(`[Profile Sync] Force refreshing data from University API...`);

        // 1. Fetch from University
        const rawApiData = await fetchFromUniversityApi(token);

        // 2. Parse & Validate — pass storedStudentId fallback since ID endpoint may not return studentCode
        const { profile, isPartial } = parseProfileData(rawApiData, storedStudentId);


        if (isPartial) {
            console.warn(`[Profile Sync] Partial data for ${profile.studentId} — sync skipped, returning partial data`);
            // Still return the partial data for the UI, just don't write to DB
            return NextResponse.json({
                success: true,
                message: 'Warning: Partial data received from University servers. Profile not fully updated.',
                data: profile,
                isPartial: true
            });
        }

        // 3. Save to Supabase only if data is complete
        const saved = await cacheProfile(profile);

        if (!saved) {
            throw new Error("Failed to save synced profile to database.");
        }

        console.log(`[Profile Sync] Successfully synced profile for ${profile.studentId}`);

        return success(profile);

    } catch (error) {
        console.warn(`[Profile Sync] Sync Failed:`, error.message);

        if (error.isAuthError) {
            return NextResponse.json({ success: false, message: 'Session Expired', code: 'SESSION_EXPIRED' }, { status: 401 });
        }

        return NextResponse.json({ success: false, message: 'Failed to sync with University servers' }, { status: 503 });
    }
}
