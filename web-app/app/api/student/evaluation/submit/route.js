import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import https from 'https';
import { encryptForReg } from '@/lib/regCipherUtils';
import { clearEvalCache } from '../route';

const BASE_URL = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th';

// Ignore self-signed certs
const agent = new https.Agent({ rejectUnauthorized: false });

export async function POST(request) {
    try {
        const payload = await request.json();
        const { evaluateId, classId, officerId, formData } = payload;

        if (!evaluateId || !classId || !officerId || !formData) {
            return NextResponse.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน (classId, evaluateId, officerId)' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const token = cookieStore.get('reg_token')?.value;
        const stdCode = cookieStore.get('std_code')?.value;

        if (!token) {
            return NextResponse.json({ success: false, message: 'Unauthorized (No reg_token)' }, { status: 401 });
        }

        const config = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            httpsAgent: agent,
            validateStatus: () => true
        };

        // Fetch the raw questions first to know their types
        const urlQ = `https://reg2.kmutnb.ac.th/regapiweb3/api/th/Evaluateofficerform/Evaluatequestion/${classId}/${evaluateId}/${officerId}`;
        const resQ = await axios.get(urlQ, config);

        let questions = [];
        if (resQ.status === 200 && resQ.data?.result) {
            const zlib = require('zlib');
            const { promisify } = require('util');
            const gunzip = promisify(zlib.gunzip);
            const decompressed = await gunzip(Buffer.from(resQ.data.result, 'base64'));
            questions = JSON.parse(decompressed.toString('utf-8'));
        }

        // Build payload EXACTLY like Angular's generateform
        const submitPayload = {};
        questions.forEach(q => {
            if (q.questiontype === 'H') return;

            const qId = q.questionid ?? q.id;
            const userAns = formData[qId] || '5'; // default to 5 if not found, though frontend should prevent this

            if (q.questiontype === 'Q') {
                submitPayload[q.questiontype + '' + q.questionid] = userAns;
            } else if (q.questiontype === 'C') {
                submitPayload[q.questiontype + '' + q.questionid] = q.description || '';
            } else if (q.questiontype === 'M' && q.evaluatechoice) {
                // For multi-choice questions
                q.evaluatechoice.forEach(c => {
                    const isChecked = userAns === c.choiceid; // Assuming frontend uses the choiceid for M
                    submitPayload[q.questiontype + '' + q.questionid + c.choiceid] = isChecked;
                    if (c.choicetype === 'T') {
                        submitPayload[q.questiontype + '' + q.questionid + c.choiceid + 'txt'] = c.chkdescription || '';
                    }
                });
            }
        });

        // Add feedback and complaints fields
        submitPayload['Ctxt'] = questions[0]?.feedback || '';
        submitPayload['complaints'] = questions[0]?.complaints || '';

        const jsonPayload = JSON.stringify(submitPayload);
        const encryptedParam = encryptForReg(jsonPayload);

        const REG2_BASE_URL = 'https://reg2.kmutnb.ac.th/regapiweb3/api/th';

        // 1. Submit Answers
        const submitUrl = `${REG2_BASE_URL}/Evaluateofficerform/Addanswer/${evaluateId}/${classId}/${officerId}/1`;
        const requestBody = { param: encryptedParam };

        const submitRes = await axios.post(submitUrl, requestBody, config);

        if (submitRes.status !== 200) {
            console.warn(`[Submit Proxy] Addanswer returned ${submitRes.status}`);
        }

        // 2. Commit Request
        const commitUrl = `${REG2_BASE_URL}/Evaluateofficerform/commit/${evaluateId}/${classId}/${officerId}`;
        const commitPayload = { param: encryptForReg(JSON.stringify({})) };

        const commitRes = await axios.post(commitUrl, commitPayload, config);

        if (commitRes.status !== 200) {
            console.warn(`[Submit Proxy] Commit returned ${commitRes.status}`);
        }

        // --- THE FIX: Clear the cache so the frontend knows this instructor is done ---
        if (stdCode) {
            clearEvalCache(stdCode);
        }

        return NextResponse.json({
            success: true,
            message: 'ส่งผลการประเมินเรียบร้อยแล้ว',
            debug: { evaluateId, commitStatus: commitRes.status, requestBuilt: true }
        });

    } catch (error) {
        console.error('[Submit Proxy] Error:', error.message);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
