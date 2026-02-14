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

        // Fetch from University API
        console.time('StudentInfo-ExternalAPI');
        const apiRes = await axios.get(`${BASE_URL}/Schg/Getstudentinfo`, {
            headers: { 'token': token },
            timeout: 10000
        });
        console.timeEnd('StudentInfo-ExternalAPI');

        if (apiRes.status === 200 && apiRes.data) {
            return NextResponse.json({
                success: true,
                data: response.data
            });
        }

        // Token expired or invalid
        if (response.status === 401) {
            return NextResponse.json(
                { success: false, message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' },
                { status: 401 }
            );
        }

        return NextResponse.json(
            { success: false, message: 'ไม่สามารถดึงข้อมูลได้', apiStatus: response.status },
            { status: response.status }
        );

    } catch (error) {
        console.error('[API] Student info error:', error.message);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลนักศึกษา' },
            { status: 500 }
        );
    }
}
