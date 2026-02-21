import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

export async function GET() {
    // Block in production — debug endpoints should never be accessible
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('reg_token')?.value;

    if (!token) {
        return NextResponse.json({ error: 'No token found' }, { status: 401 });
    }

    const endpoints = [
        '/Schg/Getstudentinfo', // Control: Should work
        '/Schg/Getacadstd',
        '/Student/Getenrollcontrol',
        '/Student/Getenrollstage',
        '/Debt/Enrollfee',
        // '/Student/Getenrollresult' // Skipped due to 404
    ];

    const results = {};

    for (const endpoint of endpoints) {
        try {
            // Attempt 1: Standard 'token' header
            let res = await axios.get(`${BASE_URL}${endpoint}`, {
                headers: { 'token': token },
                timeout: 5000,
                validateStatus: () => true
            });

            let status = res.status;
            let usedHeader = 'token';

            // Attempt 2: Authorization Bearer (Just in case)
            if (status === 401) {
                const res2 = await axios.get(`${BASE_URL}${endpoint}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    timeout: 5000,
                    validateStatus: () => true
                });
                if (res2.status === 200) {
                    res = res2; // It worked with Bearer!
                    status = 200;
                    usedHeader = 'Bearer';
                }
            }

            results[endpoint] = {
                status: status,
                data: status === 200 ? res.data : `Error ${status}`,
                header: usedHeader
            };
        } catch (err) {
            results[endpoint] = { error: err.message };
        }
    }

    return NextResponse.json({
        success: true,
        tokenPrefix: token.substring(0, 5) + '...',
        results
    });
}
