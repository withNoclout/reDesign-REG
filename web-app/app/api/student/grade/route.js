import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

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

        console.log('[API] Fetching grades with token:', token.substring(0, 10) + '...');

        // Attempt 1: Try Grade/Showgrade (User Provided URL)
        try {
            console.log('[API] Trying Grade/Showgrade (regapiweb1)...');
            // User specifically provided regapiweb1
            const response = await axios.get('https://reg4.kmutnb.ac.th/regapiweb1/api/th/Grade/Showgrade', {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                validateStatus: status => status < 500
            });

            console.log('[API] Grade/Showgrade Status:', response.status);

            // Validate that we got JSON matching expected structure (Array)
            // Some endpoints return HTML (login page) with 200 OK if token is invalid for that system
            if (response.status === 200 && response.data && typeof response.data === 'object') {
                // Additional check: If it's the expected array
                if (Array.isArray(response.data) || response.data.length >= 0) {
                    return NextResponse.json({
                        success: true,
                        data: response.data
                    });
                }
            }
            console.warn('[API] Grade/Showgrade returned non-array/invalid data, falling back...');
        } catch (err) {
            console.error('[API] Grade/Showgrade failed:', err.message);
        }

        // Attempt 2: Try Schg/Showgrade (regapiweb2 - Fallback)
        try {
            console.log('[API] Trying Schg/Showgrade (regapiweb2)...');
            const response = await axios.get(`${BASE_URL}/Schg/Showgrade`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                validateStatus: status => status < 500
            });

            console.log('[API] Schg/Showgrade Status:', response.status);

            if (response.status === 200 && response.data) {
                return NextResponse.json({
                    success: true,
                    data: response.data
                });
            }
        } catch (err) {
            console.error('[API] Schg/Showgrade (regapiweb2) failed:', err.message);
        }

        // Attempt 3: Try Getgrade (Backup)
        try {
            const response = await axios.get(`${BASE_URL}/Schg/Getgrade`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                validateStatus: status => status < 500
            });

            console.log('[API] Getgrade Status:', response.status);

            if (response.status === 200 && response.data) {
                return NextResponse.json({
                    success: true,
                    data: response.data
                });
            }
        } catch (err) {
            console.error('[API] Getgrade failed:', err.message);
        }

        // Attempt 3: Try GetStudyResult (Common alternative)
        try {
            const response = await axios.get(`${BASE_URL}/Schg/GetStudyResult`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                validateStatus: status => status < 500
            });

            console.log('[API] GetStudyResult Status:', response.status);

            if (response.status === 200 && response.data) {
                return NextResponse.json({
                    success: true,
                    data: response.data
                });
            }
        } catch (err) {
            console.error('[API] GetStudyResult failed:', err.message);
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
