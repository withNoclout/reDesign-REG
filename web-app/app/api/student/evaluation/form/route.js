import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import https from 'https';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);
const BASE_URL = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th';

const agent = new https.Agent({ rejectUnauthorized: false });
const MOCK_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const evaluateId = searchParams.get('id');
        const classId = searchParams.get('classId');
        const officerId = searchParams.get('officerId');

        if (!evaluateId || !classId || !officerId) {
            return NextResponse.json({ success: false, message: 'Missing evaluateId, classId, or officerId' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const token = cookieStore.get('reg_token')?.value;

        if (!token) {
            return NextResponse.json({ success: false, message: 'Unauthorized (No reg_token cookie)' }, { status: 401 });
        }

        const config = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': MOCK_USER_AGENT,
                'Accept': 'application/json, text/plain, */*'
            },
            httpsAgent: agent,
            timeout: 10000,
            validateStatus: () => true
        };

        // 1. Fetch exact questions using the newly discovered reg2 scheme:
        const REG2_BASE_URL = 'https://reg2.kmutnb.ac.th/regapiweb3/api/th';
        const questionUrl = `${REG2_BASE_URL}/Evaluateofficerform/Evaluatequestion/${classId}/${evaluateId}/${officerId}`;
        const res = await axios.get(questionUrl, config);

        if (res.status !== 200) {
            console.warn(`[Eval Form REST] Failed to get exact questions. Status: ${res.status}`);
            return NextResponse.json({ success: false, message: 'ไม่สามารถดึงข้อมูลแบบประเมินได้' }, { status: 500 });
        }

        let rawData = res.data;
        if (typeof rawData === 'object' && rawData.result) {
            const compressedBuffer = Buffer.from(rawData.result, 'base64');
            const decompressed = await gunzip(compressedBuffer);
            rawData = JSON.parse(decompressed.toString('utf-8'));
        }

        return NextResponse.json({
            success: true,
            data: {
                evaluateId,
                classId,
                officerId,
                rawQuestions: rawData,
                questions: Array.isArray(rawData) ? rawData : [],
                __useRestAPI: true
            }
        });

    } catch (error) {
        console.error('[Eval Form Proxy] Error:', error.message);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
