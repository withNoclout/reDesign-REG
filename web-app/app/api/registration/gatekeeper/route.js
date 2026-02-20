import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

const gatekeeperCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('reg_token')?.value;
    const stdCode = cookieStore.get('std_code')?.value;

    if (!token) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // 🚀 FAST PATH: Check Active Memory Cache first
    if (stdCode) {
        const cached = gatekeeperCache.get(stdCode);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            console.log(`[Gatekeeper API] Fast Memory Cache hit for ${stdCode}`);
            return NextResponse.json({ success: true, data: cached.data, cached: true });
        }
    }

    const headers = { 'Authorization': `Bearer ${token}` };
    // Strict timeout of 3 seconds to prevent indefinite hangs
    const config = { headers, validateStatus: () => true, timeout: 3000 };

    try {
        // Parallel Fetch for Performance
        const [studentInfoRes, enrollStageRes, enrollFeeRes, acadStdRes] = await Promise.allSettled([
            axios.get(`${BASE_URL}/Schg/Getstudentinfo`, config),
            axios.get(`${BASE_URL}/Student/Getenrollstage`, config),
            axios.get(`${BASE_URL}/Debt/Enrollfee`, config),
            axios.get(`${BASE_URL}/Schg/Getacadstd`, config)
        ]);

        // Process Enroll Stage
        // 1 = New, 2 = Advisor, 3 = Payment, 4 = Complete? (Need to verify exact mapping)
        // For now, assume any stage > 0 is "In Progress"
        let stage = 0;
        if (enrollStageRes.status === 'fulfilled' && enrollStageRes.value?.status === 200) {
            stage = enrollStageRes.value.data;
        }

        // Process Debt
        let hasDebt = false;
        if (enrollFeeRes.status === 'fulfilled' && enrollFeeRes.value?.status === 200) {
            // Check if any fee has a balance > 0
            // Filter out fees that are not relevant if needed, but safe assume balance > 0 is debt
            const fees = enrollFeeRes.value.data || [];
            hasDebt = fees.some(f => f.balance > 0);
        }

        // Process Academic Info
        let acadInfo = {};
        if (acadStdRes.status === 'fulfilled' && acadStdRes.value?.status === 200) {
            acadInfo = acadStdRes.value.data;
        }

        // Construct Gatekeeper Response
        const eligibility = {
            isRegistrationPeriod: true, // Hardcoded for now, or check dates from EnrollControl if available
            hasDebt: hasDebt,
            academicStatus: 'Normal', // Mocked or derived from acadInfo
            canRegister: !hasDebt // Basic rule
        };

        const responseData = {
            student: {
                // If Getstudentinfo fails (404 as seen), use decoded token or placeholder
                // We can also extract from acadInfo partially
                id: acadInfo.studentcode || stdCode || 'Unknown',
                faculty: 'Engineering' // Placeholder
            },
            stage: stage,
            eligibility: eligibility,
            acadInfo: acadInfo
        };

        // Update Memory Cache
        if (stdCode) {
            gatekeeperCache.set(stdCode, { timestamp: Date.now(), data: responseData });
        }

        return NextResponse.json({ success: true, data: responseData });

    } catch (error) {
        console.error('Gatekeeper Error:', error);
        return NextResponse.json({ success: false, message: 'Gatekeeper System Error' }, { status: 500 });
    }
}
