import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { getAuthContext } from '@/lib/auth';

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

const gatekeeperCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function summarizeOutstandingFees(fees) {
    const outstandingFees = Array.isArray(fees)
        ? fees
            .filter((fee) => Number(fee?.balance) > 0)
            .map((fee) => ({
                acadyear: fee.acadyear ?? null,
                semester: fee.semester ?? null,
                feeid: fee.feeid ?? null,
                feeidname: fee.feeidname ?? '',
                amount: Number(fee.amount ?? 0),
                balance: Number(fee.balance ?? 0),
                voucher: fee.voucher ?? '',
            }))
        : [];

    const outstandingBalance = outstandingFees.reduce((sum, fee) => sum + fee.balance, 0);

    return {
        outstandingFees,
        outstandingBalance,
        hasDebt: outstandingBalance > 0,
    };
}


export async function GET() {
    const authContext = await getAuthContext();
    let token = authContext?.token ?? null;
    const userId = authContext?.userId ?? null;
    let acadInfoFromAuth = authContext?.upstream ?? null;

    if (!token) {
        const cookieStore = await cookies();
        token = cookieStore.get('reg_token')?.value ?? null;
        if (!token) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const fallbackAuthRes = await axios.get(`${BASE_URL}/Schg/Getacadstd`, {
            headers: { 'Authorization': `Bearer ${token}` },
            validateStatus: () => true,
            timeout: 3000,
        });

        if (fallbackAuthRes.status !== 200 || !fallbackAuthRes.data) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        acadInfoFromAuth = fallbackAuthRes.data;
    }

    if (userId) {
        const cached = gatekeeperCache.get(userId);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            console.log(`[Gatekeeper API] Fast Memory Cache hit for ${userId}`);
            return NextResponse.json({ success: true, data: cached.data, cached: true });
        }
    }

    const headers = { 'Authorization': `Bearer ${token}` };
    const config = { headers, validateStatus: () => true, timeout: 3000 };

    try {
        const [enrollStageRes, enrollFeeRes, acadStdRes] = await Promise.allSettled([
            axios.get(`${BASE_URL}/Student/Getenrollstage`, config),
            axios.get(`${BASE_URL}/Debt/Enrollfee`, config),
            acadInfoFromAuth ? Promise.resolve({ status: 200, data: acadInfoFromAuth }) : axios.get(`${BASE_URL}/Schg/Getacadstd`, config)
        ]);

        let stage = 0;
        if (enrollStageRes.status === 'fulfilled' && enrollStageRes.value?.status === 200) {
            stage = Number(enrollStageRes.value.data) || 0;
        }

        const fees = enrollFeeRes.status === 'fulfilled' && enrollFeeRes.value?.status === 200
            ? enrollFeeRes.value.data
            : [];
        const { outstandingFees, outstandingBalance, hasDebt } = summarizeOutstandingFees(fees);

        let acadInfo = {};
        if (acadStdRes.status === 'fulfilled' && acadStdRes.value?.status === 200) {
            acadInfo = acadStdRes.value.data;
        }

        const blockingReasons = [];
        const isRegistrationPeriod = true;

        if (!isRegistrationPeriod) {
            blockingReasons.push('ยังไม่อยู่ในช่วงเวลาลงทะเบียน');
        }

        if (hasDebt) {
            blockingReasons.push(`มียอดค้างชำระ ${outstandingBalance.toLocaleString('th-TH')} บาท`);
        }

        const responseData = {
            student: {
                id: acadInfo.studentcode || userId || 'Unknown',
                faculty: 'Engineering'
            },
            stage,
            eligibility: {
                isRegistrationPeriod,
                hasDebt,
                academicStatus: 'Normal',
                canRegister: blockingReasons.length === 0,
                outstandingBalance,
                outstandingFees,
                blockingReasons,
                stageMessage: stage > 0 ? `REG รายงานสถานะการลงทะเบียนเป็น Stage ${stage}` : 'REG ยังไม่รายงานสถานะการลงทะเบียน'
            },
            acadInfo
        };

        if (userId) {
            gatekeeperCache.set(userId, { timestamp: Date.now(), data: responseData });
        }

        return NextResponse.json({ success: true, data: responseData });
    } catch (error) {
        console.error('Gatekeeper Error:', error);
        return NextResponse.json({ success: false, message: 'Gatekeeper System Error' }, { status: 500 });
    }
}
