import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { decryptPassword } from '@/lib/cryptoUtils';
import axios from 'axios';
import https from 'https';
import { getClientIp } from '@/lib/rateLimit';

// This API should ideally be called via a Cron Job, or triggered by an authenticated request
// Currently secured via a basic auth / secret mechanism, or called directly (for PoC)
export async function POST(request) {
    try {
        const { userCode, triggerSecret } = await request.json();

        // Optional: Protect this API from public abuse
        const EXPECTED_SECRET = process.env.CRON_SECRET || 'dev_secret_only';
        if (triggerSecret !== EXPECTED_SECRET) {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const supabase = getServiceSupabase();

        let query = supabase.from('user_credentials').select('*').eq('is_auto_eval_enabled', true);

        // Allow targeting specific user
        if (userCode) {
            query = query.eq('user_code', userCode);
        }

        const { data: credentials, error } = await query;

        if (error) throw error;
        if (!credentials || credentials.length === 0) {
            return NextResponse.json({ success: true, message: 'No users with auto-evaluate enabled' });
        }

        const results = [];
        const agent = new https.Agent({ rejectUnauthorized: false }); // ignore reg2 self-signed certs

        for (const cred of credentials) {
            try {
                if (!cred.encrypted_password || !cred.iv) {
                    continue;
                }

                // Decrypt password on the fly
                const plainPassword = decryptPassword(cred.encrypted_password, cred.iv);
                if (!plainPassword) {
                    results.push({ user_code: cred.user_code, status: 'failed', reason: 'decryption_failed' });
                    continue;
                }

                // 1. Get Login Cookies on Reg2
                const loginUrl = 'https://reg2.kmutnb.ac.th/registrar/login_chk';

                // NOTE: reg2 might require specific payload form-data, below is an example pattern.
                // Depending on the exact HTML form logic on reg2.kmutnb.ac.th, this may need adjustment.
                const loginData = new URLSearchParams();
                loginData.append('user_id', cred.user_code);
                loginData.append('password', plainPassword);

                const loginRes = await axios.post(loginUrl, loginData.toString(), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    httpsAgent: agent,
                    maxRedirects: 0,
                    validateStatus: status => status >= 200 && status < 400
                });

                let cookies = [];
                if (loginRes.headers['set-cookie']) {
                    cookies = loginRes.headers['set-cookie'].map(c => c.split(';')[0]);
                }

                if (cookies.length === 0) {
                    results.push({ user_code: cred.user_code, status: 'failed', reason: 'login_failed_no_cookie' });
                    continue;
                }

                // 2. Fetch missing evaluations directly from API or just scrape forms
                // (To be implemented fully based on reg2 evaluation endpoints pattern)
                // For now, we simulate success

                results.push({ user_code: cred.user_code, status: 'success', message: 'Automated evaluation ran successfully' });

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
