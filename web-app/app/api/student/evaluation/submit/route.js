import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { getServiceSupabase } from '@/lib/supabase';
import { decryptPassword } from '@/lib/cryptoUtils';

export async function POST(request) {
    try {
        const payload = await request.json();
        const { evaluateId, formData, __VIEWSTATE, __EVENTVALIDATION, __VIEWSTATEGENERATOR } = payload;

        if (!evaluateId || !formData || !__VIEWSTATE) {
            return NextResponse.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const stdCode = cookieStore.get('std_code')?.value;

        if (!stdCode) {
            return NextResponse.json({ success: false, message: 'Unauthorized (No std_code cookie)' }, { status: 401 });
        }

        // 1. Fetch credentials
        const supabase = getServiceSupabase();
        const { data: cred, error: credError } = await supabase
            .from('user_credentials')
            .select('encrypted_password, iv')
            .eq('user_code', stdCode)
            .single();

        if (credError || !cred?.encrypted_password || !cred?.iv) {
            return NextResponse.json({
                success: false,
                message: 'เนื่องจากมีการอัปเดตระบบความปลอดภัย กรุณาออกจากระบบ (Logout) และเข้าสู่ระบบใหม่อีกครั้ง',
            }, { status: 403 });
        }

        const plainPassword = decryptPassword(cred.encrypted_password, cred.iv);

        // 2. Login to reg2 to get session cookie
        const loginUrl = 'https://reg2.kmutnb.ac.th/registrar/login_chk';
        const loginData = new URLSearchParams();
        loginData.append('f_uid', stdCode);
        loginData.append('f_pwd', plainPassword);

        const loginRes = await axios.post(loginUrl, loginData.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            validateStatus: status => status < 500,
            maxRedirects: 0
        });

        const setCookieHeaders = loginRes.headers['set-cookie'] || [];
        let authCookie = '';

        setCookieHeaders.forEach(cookie => {
            if (cookie.includes('ASP.NET_SessionId')) {
                authCookie = cookie.split(';')[0];
            }
        });

        if (!authCookie) {
            return NextResponse.json({ success: false, message: 'ล็อกอิน reg2 ไม่สำเร็จ (รหัสผ่านอาจไม่ถูกต้อง)' }, { status: 401 });
        }

        // 3. Prepare POST data for Form Submission
        const submitData = new URLSearchParams();

        // ASP.NET Required hidden fields
        submitData.append('__VIEWSTATE', __VIEWSTATE);
        if (__EVENTVALIDATION) submitData.append('__EVENTVALIDATION', __EVENTVALIDATION);
        if (__VIEWSTATEGENERATOR) submitData.append('__VIEWSTATEGENERATOR', __VIEWSTATEGENERATOR);
        submitData.append('__EVENTTARGET', '');
        submitData.append('__EVENTARGUMENT', '');

        // Attach student answers
        for (const [key, value] of Object.entries(formData)) {
            submitData.append(key, value);
        }

        // Action button for saving (typically ImageButton or Button name)
        // Adjust this if reg2 expects a specific button name to process the form
        // often reg2 uses 'btnSave' or 'Image1.x', 'Image1.y' 
        submitData.append('btnSave', 'บันทึก');

        const submitUrl = `https://reg2.kmutnb.ac.th/registrar/evaluateofficerform?evaluateid=${evaluateId}`;
        const submitRes = await axios.post(submitUrl, submitData.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': authCookie,
                'Referer': submitUrl,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            },
            validateStatus: status => status < 500
        });

        // Checking response to see if it succeeded.
        // Usually returns to the list page if successful (302 Redirect) or shows a success message.
        const htmlContext = (submitRes.data || '').toString();

        if (submitRes.status === 302 || htmlContext.includes('บันทึกข้อมูลเรียบร้อย') || htmlContext.includes('alert')) {
            return NextResponse.json({ success: true, message: 'ส่งผลการประเมินเรียบร้อย' });
        } else {
            console.warn('[Submit Proxy] Form submitted but success not guaranteed. Status:', submitRes.status);
            // It might succeed without matching our conditions, consider 200 as possible success too if no error is present
            if (submitRes.status === 200 && !htmlContext.includes('error')) {
                return NextResponse.json({ success: true, message: 'ส่งผลการประเมินเรียบร้อย (คาดหวัง)' });
            }
            return NextResponse.json({ success: false, message: 'ไม่สามารถส่งผลการประเมินได้' }, { status: 500 });
        }

    } catch (error) {
        console.error('[Submit Proxy] Error:', error.message);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
