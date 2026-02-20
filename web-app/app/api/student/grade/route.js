import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

// Grade endpoints to try (in priority order)
const GRADE_ENDPOINTS = [
    { url: 'https://reg4.kmutnb.ac.th/regapiweb1/api/th/Grade/Showgrade', label: 'Grade/Showgrade', needsArray: true },
    { url: `${BASE_URL}/Schg/Showgrade`, label: 'Schg/Showgrade', needsArray: false },
    { url: `${BASE_URL}/Schg/Getgrade`, label: 'Schg/Getgrade', needsArray: false },
    { url: `${BASE_URL}/Schg/GetStudyResult`, label: 'Schg/GetStudyResult', needsArray: false },
];

const gradeCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('reg_token')?.value;
        const stdCode = cookieStore.get('std_code')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ session กรุณาเข้าสู่ระบบใหม่' },
                { status: 401 }
            );
        }

        // 🚀 FAST PATH: Check Active Memory Cache first
        if (stdCode) {
            const cached = gradeCache.get(stdCode);
            if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
                console.log(`[API] Fast Memory Cache hit (latency ~0ms) for grade: ${stdCode}`);
                return NextResponse.json({ success: true, data: cached.data, cached: true });
            }
        }

        console.log('[API] Fetching grades (fastest-wins parallel) with token:', token.substring(0, 10) + '...');

        const headers = { 'Authorization': `Bearer ${token}` };
        // Use timeout: 4000 to prevent hanging
        const config = { headers, validateStatus: () => true, timeout: 4000 };

        try {
            // We use Promise.any to return exactly when the *first* successful endpoint responds.
            // If an endpoint fails, times out, or returns bad data, we throw so Promise.any ignores it.
            const fastestResult = await Promise.any(
                GRADE_ENDPOINTS.map(async ep => {
                    const res = await axios.get(ep.url, config);
                    if (res.status === 200 && res.data && typeof res.data === 'object') {
                        if (ep.needsArray && (!Array.isArray(res.data) || res.data.length === 0)) {
                            throw new Error(`Invalid array data from ${ep.label}`);
                        }
                        console.log(`[API] Grade success from: ${ep.label}`);
                        return res.data;
                    }
                    if (res.status === 401) {
                        const authError = new Error('Unauthorized');
                        authError.status = 401;
                        throw authError;
                    }
                    throw new Error(`Non-200 or invalid from ${ep.label} (${res.status})`);
                })
            );

            // Update Memory Cache
            if (stdCode) {
                gradeCache.set(stdCode, { timestamp: Date.now(), data: fastestResult });
            }

            return NextResponse.json({ success: true, data: fastestResult });

        } catch (error) {
            // Promise.any throws an AggregateError if ALL promises fail
            console.warn('[API] All grade endpoints failed or timed out:', error.errors || error.message);

            // Check if any error was a 401 Unauthorized
            if (error.errors && error.errors.some(e => e.status === 401)) {
                return NextResponse.json(
                    { success: false, message: 'Session Expired (Unauthorized)', code: 'SESSION_EXPIRED' },
                    { status: 401 }
                );
            }

            return NextResponse.json(
                { success: false, message: 'ไม่สามารถดึงข้อมูลผลการเรียนได้ (Endpoint Not Found / Timeout)' },
                { status: 404 }
            );
        }

    } catch (error) {
        console.error('[API] Grade fetch error:', error.message);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' },
            { status: 500 }
        );
    }
}
