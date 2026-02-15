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

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('reg_token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ session กรุณาเข้าสู่ระบบใหม่' },
                { status: 401 }
            );
        }

        console.log('[API] Fetching grades (parallel) with token:', token.substring(0, 10) + '...');

        const headers = { 'Authorization': `Bearer ${token}` };

        // Fire all endpoints in parallel
        const results = await Promise.allSettled(
            GRADE_ENDPOINTS.map(ep =>
                axios.get(ep.url, { headers, validateStatus: s => s < 500 })
                    .then(res => ({ ...ep, response: res }))
            )
        );

        // Pick the first successful result (respecting priority order)
        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            if (r.status !== 'fulfilled') continue;
            const { response, label, needsArray } = r.value;

            if (response.status === 200 && response.data && typeof response.data === 'object') {
                if (needsArray) {
                    if (Array.isArray(response.data) && response.data.length > 0) {
                        console.log(`[API] Grade success from: ${label}`);
                        return NextResponse.json({ success: true, data: response.data });
                    }
                } else {
                    console.log(`[API] Grade success from: ${label}`);
                    return NextResponse.json({ success: true, data: response.data });
                }
            }
        }

        return NextResponse.json(
            { success: false, message: 'ไม่สามารถดึงข้อมูลผลการเรียนได้ (Endpoint Not Found)' },
            { status: 404 }
        );

    } catch (error) {
        console.error('[API] Grade fetch error:', error.message);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' },
            { status: 500 }
        );
    }
}
