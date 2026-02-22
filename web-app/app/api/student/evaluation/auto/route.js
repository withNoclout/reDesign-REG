import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import axios from 'axios';
import https from 'https';

const BASE_URL = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th';
const agent = new https.Agent({ rejectUnauthorized: false });

export async function POST(request) {
    try {
        const { userCode, triggerSecret } = await request.json();

        const EXPECTED_SECRET = process.env.CRON_SECRET || 'dev_secret_only';
        if (triggerSecret !== EXPECTED_SECRET) {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const supabase = getServiceSupabase();

        let query = supabase.from('user_credentials').select('*').eq('is_auto_eval_enabled', true);

        if (userCode) {
            query = query.eq('user_code', userCode);
        }

        const { data: credentials, error } = await query;

        if (error) throw error;
        if (!credentials || credentials.length === 0) {
            return NextResponse.json({ success: true, message: 'No users with auto-evaluate enabled' });
        }

        const results = [];

        for (const cred of credentials) {
            try {
                // TODO: ระบบ Auto-Evaluate แบบใหม่นี้ เราต้องหาวิธีดึง `reg_token` ให้ได้
                // ก่อนหน้านี้เราใช้รหัสผ่าน (AES) ส่งไปที่ login_chk ของ reg2
                // ตอนนี้ reg2 เปลี่ยนระบบเป็น JWT (`reg_token`) ซึ่งออกให้โดย SCB SSO หรือ endpoint อื่น
                // ซึ่งหมายความว่าเราต้องพึ่งพา token ที่หมดอายุ (JWT expiration) หรือ
                // มีระบบ Refresh Token ที่ใช้ password + AES ไปขอ token ตัวใหม่ 
                // ณ ตอนนี้ เป็นการสร้าง Skeleton เตรียมพร้อมไว้สำหรับการดึง token นั้น

                // 1. (สมมุติ) getRegTokenFromPassword(cred.password)
                const mockToken = 'mock_jwt_token_awaiting_implementation';

                // 2. ดึงรายการที่ค้างประเมิน (Evaluateofficer/Class) เหมือนฝั่ง GET หลัก

                // 3. วนลูปรายวิชา และ HTTP POST ด้วย REST endpoint ใหม่
                // axios.post(`${BASE_URL}/Evaluateofficerform/Addanswer/${item.evaluateid}`, mock_answers, { headers: { 'Authorization': `Bearer ${mockToken}` } });

                // 4. commit 
                // axios.post(`${BASE_URL}/Evaluateofficerform/commit/${item.evaluateid}`, {}, { ... });

                results.push({ user_code: cred.user_code, status: 'simulated_success', message: 'Ready for Token & Payload Logic' });

            } catch (userErr) {
                console.error(`[AutoEval] Error for ${cred.user_code}:`, userErr.message);
                results.push({ user_code: cred.user_code, status: 'error', reason: userErr.message });
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (error) {
        console.error('[Auto Eval API] Critical Error:', error.message);
        return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
    }
}
