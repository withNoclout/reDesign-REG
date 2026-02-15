import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('reg_token')?.value;

    if (!token) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const headers = { 'Authorization': `Bearer ${token}` };

    try {
        // Parallel Fetch for Performance
        const [studentInfoRes, enrollStageRes, enrollFeeRes, acadStdRes] = await Promise.allSettled([
            axios.get(`${BASE_URL}/Schg/Getstudentinfo`, { headers, validateStatus: () => true }),
            axios.get(`${BASE_URL}/Student/Getenrollstage`, { headers, validateStatus: () => true }),
            axios.get(`${BASE_URL}/Debt/Enrollfee`, { headers, validateStatus: () => true }),
            axios.get(`${BASE_URL}/Schg/Getacadstd`, { headers, validateStatus: () => true })
        ]);

        // Process Enroll Stage
        // 1 = New, 2 = Advisor, 3 = Payment, 4 = Complete? (Need to verify exact mapping)
        // For now, assume any stage > 0 is "In Progress"
        let stage = 0;
        if (enrollStageRes.status === 'fulfilled' && enrollStageRes.value.status === 200) {
            stage = enrollStageRes.value.data;
        }

        // Process Debt
        let hasDebt = false;
        if (enrollFeeRes.status === 'fulfilled' && enrollFeeRes.value.status === 200) {
            // Check if any fee has a balance > 0
            // Filter out fees that are not relevant if needed, but safe assume balance > 0 is debt
            const fees = enrollFeeRes.value.data || [];
            hasDebt = fees.some(f => f.balance > 0);
        }

        // Process Academic Info
        let acadInfo = {};
        if (acadStdRes.status === 'fulfilled' && acadStdRes.value.status === 200) {
            acadInfo = acadStdRes.value.data;
        }

        // Construct Gatekeeper Response
        const eligibility = {
            isRegistrationPeriod: true, // Hardcoded for now, or check dates from EnrollControl if available
            hasDebt: hasDebt,
            academicStatus: 'Normal', // Mocked or derived from acadInfo
            canRegister: !hasDebt // Basic rule
        };

        return NextResponse.json({
            success: true,
            data: {
                student: {
                    // If Getstudentinfo fails (404 as seen), use decoded token or placeholder
                    // We can also extract from acadInfo partially
                    id: acadInfo.studentcode || 'Unknown',
                    faculty: 'Engineering' // Placeholder
                },
                stage: stage,
                eligibility: eligibility,
                acadInfo: acadInfo
            }
        });

    } catch (error) {
        console.error('Gatekeeper Error:', error);
        return NextResponse.json({ success: false, message: 'Gatekeeper System Error' }, { status: 500 });
    }
}
