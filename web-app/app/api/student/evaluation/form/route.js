import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getServiceSupabase } from '@/lib/supabase';
import { decryptPassword } from '@/lib/cryptoUtils';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const evaluateId = searchParams.get('id');

        if (!evaluateId) {
            return NextResponse.json({ success: false, message: 'Missing evaluateId' }, { status: 400 });
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
                needsSetup: true
            }, { status: 403 });
        }

        const plainPassword = decryptPassword(cred.encrypted_password, cred.iv);
        if (!plainPassword) {
            return NextResponse.json({ success: false, message: 'ถอดรหัสผ่านไม่สำเร็จ' }, { status: 500 });
        }

        // 2. Login to reg2
        const loginUrl = 'https://reg2.kmutnb.ac.th/registrar/login_chk';
        const loginData = new URLSearchParams();
        loginData.append('f_uid', stdCode);
        loginData.append('f_pwd', plainPassword);

        const loginRes = await axios.post(loginUrl, loginData.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            validateStatus: status => status < 500,
            maxRedirects: 0 // Prevent redirect to intercept cookies
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

        // 3. Fetch Form Page
        const formUrl = `https://reg2.kmutnb.ac.th/registrar/evaluateofficerform?evaluateid=${evaluateId}`;
        const formRes = await axios.get(formUrl, {
            headers: {
                'Cookie': authCookie,
                'Referer': 'https://reg2.kmutnb.ac.th/registrar/evaluateofficer',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            },
            validateStatus: status => status < 500
        });

        if (formRes.status !== 200) {
            return NextResponse.json({ success: false, message: 'ดึงข้อมูลฟอร์มไม่สำเร็จ' }, { status: 500 });
        }

        // 4. Scrape Form Data
        const html = formRes.data;
        const $ = cheerio.load(html);

        const viewState = $('#__VIEWSTATE').val();
        const eventValidation = $('#__EVENTVALIDATION').val();
        const viewStateGenerator = $('#__VIEWSTATEGENERATOR').val();

        if (!viewState) {
            // Might have been evaluated already or session expired
            return NextResponse.json({ success: false, message: 'ไม่พบฟอร์มประเมิน (อาจถูกประเมินไปแล้ว)' }, { status: 404 });
        }

        const questions = [];

        // Extract questions. The reg2 DOM is usually a series of nested tables.
        // Usually, questions have radio buttons with names starting like rdoOption_ or similar, or class 'normalDetail'
        // A generic approach: find all inputs of type radio.

        $('table.normalDetail').each((idx, tableElem) => {
            // Let's find rows inside this that might be questions
            $(tableElem).find('tr').each((rowIdx, rowElem) => {
                const text = $(rowElem).find('td').first().text().trim();
                const radios = $(rowElem).find('input[type="radio"]');

                if (radios.length > 0 && text.length > 5 && !text.includes('ระดับคะแนน')) {
                    // Get the name attribute of the first radio button to use as question ID
                    const name = radios.first().attr('name');

                    // Try to parse values available
                    const options = [];
                    radios.each((i, radioElem) => {
                        options.push({
                            value: $(radioElem).attr('value'),
                            label: $(radioElem).parent().text().trim() || String(5 - i)
                        });
                    });

                    questions.push({
                        id: name,
                        text: text.replace(/^\d+\.\s*/, ''), // Remove leading number
                        options: options
                    });
                }
            });
        });

        // If the table layout is different, fallback to finding all TRs with radio buttons
        if (questions.length === 0) {
            $('tr').each((rowIdx, rowElem) => {
                const text = $(rowElem).find('td').first().text().trim();
                const radios = $(rowElem).find('input[type="radio"]');

                if (radios.length > 0 && text.length > 5 && text.match(/^\d+\./)) {
                    const name = radios.first().attr('name');
                    const options = [];
                    radios.each((i, radioElem) => {
                        options.push({
                            value: $(radioElem).attr('value'),
                            label: String(5 - i)
                        });
                    });

                    questions.push({
                        id: name,
                        text: text.replace(/^\d+\.\s*/, ''),
                        options: options
                    });
                }
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                evaluateId,
                questions,
                __VIEWSTATE: viewState,
                __EVENTVALIDATION: eventValidation,
                __VIEWSTATEGENERATOR: viewStateGenerator
            }
        });

    } catch (error) {
        console.error('[Eval Form Proxy] Error:', error.message);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
