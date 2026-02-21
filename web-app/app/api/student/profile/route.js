import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { getServiceSupabase } from '@/lib/supabase';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

// Global in-memory cache to massively speed up Profile loads
// Keys are std_code, Values are { timestamp, data }
const profileCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('reg_token')?.value;

        // Lazy-init Supabase — it's optional (cache only)
        let supabase = null;
        try {
            supabase = getServiceSupabase();
        } catch (e) {
            console.warn('[Profile API] Supabase not available (cache disabled):', e.message);
        }

        // MOCK_AUTH block removed as per user request (User wants REAL data)


        // 1. Identification (Need User ID to check cache)
        // We might not have user ID if we don't fetch from Uni API first?
        // Actually, we usually decode user ID from token or previous session.
        // But here we rely on the token. 
        // Strategy: We MUST try to fetch from Uni API to know WHO it is, OR we trust the browser cookie?
        // Wait, if Uni API is down, we don't know the ID from the token alone (unless we decode JWT).
        // Let's assume for CACHE RETRIEVAL on failure, we need the stored User ID.
        // But if the user is logging in, they usually have a working token.

        // Revised Strategy for "Availability":
        // 1. Try to get UserID from Token (if possible locally) OR 
        // 2. Fetch from Uni API (3s timeout).
        // 3. If Uni API success -> Save to DB (Key: StudentID). Return Data.
        // 4. If Uni API fails -> 
        //    We need the StudentID to lookup the cache. 
        //    If we can't get StudentID from token (encrypted), we can't look up cache!
        //    CRITICAL: Does `getAuthUser` in `lib/auth` help? It calls the API.

        // SOLUTION: The UserProfileCard usually calls this.
        // If external API is down, we can't identify the user from a raw opaque token.
        // However, usually we store `user_id` in a separate cookie or session if we want offline access.
        // For now, let's assume we proceed with the standard flow: 
        // Attempt Fetch -> Success -> Cache.
        // If Fail -> We can only cache-hit if we know the ID.
        // Let's look for a `std_code` or similar cookie.

        // Initialize standard variables
        const storedStudentId = cookieStore.get('std_code')?.value;

        // 🚀 FAST PATH: Check Active Memory Cache first
        if (storedStudentId) {
            const cached = profileCache.get(storedStudentId);
            if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
                console.log(`[Profile API] Fast Memory Cache hit (latency ~0ms) for ${storedStudentId}`);
                return NextResponse.json({ success: true, data: cached.data });
            }
        }

        // Setup Timeout (3 seconds)
        const TIMEOUT_MS = 3000;
        const apiCallConfig = {
            headers: { 'Authorization': `Bearer ${token}` },
            timeout: TIMEOUT_MS,
            validateStatus: () => true
        };

        // --- ATTEMPT 1: Fetch from University API ---
        try {
            // Fetch all 3 endpoints in parallel
            const results = await Promise.allSettled([
                axios.get(`${BASE_URL}/Bioentryconfig/Getbioentryconfig/I`, apiCallConfig),
                axios.get(`${BASE_URL}/Schg/Getacadstrat`, apiCallConfig),
                axios.get(`${BASE_URL}/Schg/Getacadstd`, apiCallConfig)
            ]);

            const bioResult = results[0];
            const acadResult = results[1];
            const idResult = results[2];

            // Primary Check: Bioentry is essential (Name/Faculty). Acad is secondary.
            if (bioResult.status === 'fulfilled' && bioResult.value?.status === 200) {
                const entries = bioResult.value.data;

                // Check Acad Result safely
                const acadData = (acadResult.status === 'fulfilled' && acadResult.value?.status === 200)
                    ? acadResult.value.data
                    : {}; // Fallback to empty if acad fails

                // Extraction Logic
                const extract = (keywords) => {
                    if (!Array.isArray(entries)) return null;
                    const item = entries.find(e => {
                        const name = e.bioentryname || '';
                        return keywords.some(k => name.includes(k));
                    });
                    if (!item) return null;
                    let value = item.biodefaultvalue;
                    if (item.combolist && item.combolist.length > 0) {
                        const match = item.combolist.find(c => c.valueid == value);
                        if (match) value = match.label;
                    }
                    return value;
                };

                // Extract acad data safely from Getacadstd (idResult)
                const idData = (idResult.status === 'fulfilled' && idResult.value?.status === 200)
                    ? idResult.value.data
                    : {};

                // Get student ID from parallel result
                let studentId = idData.studentCode || idData.usercode || null;

                const profile = {
                    faculty: extract(['คณะ', 'Faculty']),
                    department: extract(['สาขา', 'Department', 'ภาควิชา']),
                    major: extract(['หลักสูตร', 'Curriculum']),
                    advisor1: extract(['ที่ปรึกษาคนที่ 1', 'Advisor 1']),
                    advisor2: extract(['ที่ปรึกษาคนที่ 2', 'Advisor 2']),
                    advisor3: extract(['ที่ปรึกษาคนที่ 3', 'Advisor 3']),
                    // Getacadstd returns these fields:
                    admitYear: idData?.admitacadyear || null,
                    admitSemester: idData?.admitsemester || null,
                    currentYear: acadData?.currentacadyear || idData?.currentacadyear || null,
                    currentSemester: acadData?.currentsemester || idData?.currentsemester || null,
                    enrollYear: idData?.enrollacadyear || null,
                    enrollSemester: idData?.enrollsemester || null
                };

                // --- CACHE STEP ---
                if (studentId && supabase) {
                    try {
                        await supabase.from('student_profiles').upsert({
                            student_id: studentId,
                            faculty: profile.faculty,
                            department: profile.department,
                            major: profile.major,
                            advisor1: profile.advisor1,
                            advisor2: profile.advisor2,
                            advisor3: profile.advisor3,
                            admit_year: profile.admitYear,
                            current_year: profile.currentYear,
                            current_semester: profile.currentSemester,
                            updated_at: new Date()
                        });
                    } catch (cacheErr) {
                        console.warn('[Profile API] Database cache upsert failed:', cacheErr.message);
                    }

                    // Update Memory Cache
                    profileCache.set(studentId, {
                        timestamp: Date.now(),
                        data: profile
                    });
                }

                return NextResponse.json({ success: true, data: profile });
            } else {
                // If Bioentry fails, we can't show much.
                // Check if it was a 401
                const errorStatus = bioResult.status === 'rejected' ? bioResult.reason?.response?.status : bioResult.value?.status;
                if (errorStatus === 401) {
                    const authError = new Error('Unauthorized');
                    authError.response = { status: 401 };
                    throw authError;
                }
                throw new Error(`Profile API Failed. Status: ${errorStatus}`);
            }

        } catch (apiError) {
            console.warn(`[Profile API] External API Status: ${apiError.response?.status} - ${apiError.message}`);

            // 1. Check for Unauthorized (401) - Session Timeout
            if (apiError.response?.status === 401) {
                return NextResponse.json({
                    success: false,
                    message: 'Session Expired (Unauthorized)',
                    code: 'SESSION_EXPIRED'
                }, { status: 401 });
            }

            console.warn(`[Profile API] External API Failed or Timed Out. Trying Cache...`);

            // --- ATTEMPT 2: Fallback to Cache ---
            const backupId = cookieStore.get('std_code')?.value;

            if (backupId && supabase) {
                try {
                    const { data: cached, error } = await supabase
                        .from('student_profiles')
                        .select('*')
                        .eq('student_id', backupId)
                        .single();

                    if (cached && !error) {
                        console.log('[API] Serving Cached Profile for:', backupId);
                        return NextResponse.json({
                            success: true,
                            data: {
                                faculty: cached.faculty,
                                department: cached.department,
                                major: cached.major,
                                advisor1: cached.advisor1,
                                advisor2: cached.advisor2,
                                advisor3: cached.advisor3,
                                admitYear: cached.admit_year,
                                currentYear: cached.current_year,
                                currentSemester: cached.current_semester
                            }
                        });
                    }
                } catch (cacheErr) {
                    console.warn('[Profile API] Cache lookup failed:', cacheErr.message);
                }
            }

            // If Cache miss and API fail:
            return NextResponse.json({
                success: false,
                message: 'Service Unavailable (No Cache)'
            }, { status: 503 });
        }

    } catch (error) {
        console.error('Profile API Critical Error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
