import { error as apiError, success, unauthorized } from '@/lib/apiResponse';
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

function readRecordField(record, fieldNames) {
    if (!record || typeof record !== 'object') {
        return null;
    }

    for (const fieldName of fieldNames) {
        if (record[fieldName] !== undefined && record[fieldName] !== null) {
            return record[fieldName];
        }

        const matchingKey = Object.keys(record).find((key) => key.toLowerCase() === fieldName.toLowerCase());
        if (matchingKey && record[matchingKey] !== undefined && record[matchingKey] !== null) {
            return record[matchingKey];
        }
    }

    return null;
}

function normalizeRecordArray(payload) {
    if (Array.isArray(payload)) {
        return payload.filter((item) => item && typeof item === 'object');
    }

    const nested = payload?.data ?? payload?.items ?? payload?.rows ?? payload?.result;
    if (Array.isArray(nested)) {
        return nested.filter((item) => item && typeof item === 'object');
    }
    if (nested && typeof nested === 'object') {
        return [nested];
    }
    if (payload && typeof payload === 'object') {
        return [payload];
    }

    return [];
}

function readControlField(records, fieldNames) {
    for (const record of records) {
        const value = readRecordField(record, fieldNames);
        if (value !== null && value !== '') {
            return value;
        }
    }
    return null;
}

function parseBooleanLike(value) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value > 0;
    }
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        return null;
    }

    const openValues = ['1', 'true', 'y', 'yes', 'open', 'opened', 'active', 'allow', 'allowed'];
    const closedValues = ['0', 'false', 'n', 'no', 'closed', 'close', 'inactive', 'deny', 'denied'];
    if (openValues.includes(normalized)) {
        return true;
    }
    if (closedValues.includes(normalized)) {
        return false;
    }
    if (normalized.includes('เปิด') || normalized.includes('open') || normalized.includes('allow')) {
        return true;
    }
    if (normalized.includes('ปิด') || normalized.includes('ไม่เปิด') || normalized.includes('close') || normalized.includes('deny')) {
        return false;
    }

    return null;
}

function summarizeEnrollmentControl(payload, stage) {
    const records = normalizeRecordArray(payload);
    const statusValue = readControlField(records, [
        'isopen',
        'is_open',
        'isenroll',
        'is_enroll',
        'canenroll',
        'can_enroll',
        'allowenroll',
        'allow_enroll',
        'active',
        'status',
        'enrollstatus',
        'enroll_status',
    ]);
    const explicitFlag = parseBooleanLike(statusValue) ?? parseBooleanLike(payload);
    const statusMessage = readControlField(records, [
        'message',
        'msg',
        'description',
        'statusdes',
        'statusdesc',
        'statusname',
        'enrollstatusname',
        'enroll_status_name',
    ]);
    const startAt = readControlField(records, [
        'startdate',
        'start_date',
        'begindate',
        'begin_date',
        'enrollstartdate',
        'enroll_start_date',
        'startdatetime',
        'start_datetime',
    ]);
    const endAt = readControlField(records, [
        'enddate',
        'end_date',
        'closedate',
        'close_date',
        'enrollenddate',
        'enroll_end_date',
        'enddatetime',
        'end_datetime',
    ]);

    if (explicitFlag === true) {
        return {
            status: 'open',
            message: statusMessage || 'REG ระบุว่าอยู่ในช่วงเปิดลงทะเบียน',
            source: 'Student/Getenrollcontrol',
            startAt: startAt || null,
            endAt: endAt || null,
            recordCount: records.length,
        };
    }

    if (explicitFlag === false) {
        return {
            status: 'closed',
            message: statusMessage || 'REG ระบุว่ายังปิดช่วงลงทะเบียน',
            source: 'Student/Getenrollcontrol',
            startAt: startAt || null,
            endAt: endAt || null,
            recordCount: records.length,
        };
    }

    if (Number(stage) > 0) {
        return {
            status: 'open',
            message: statusMessage || 'ใช้ stage จาก REG เป็นสัญญาณว่าเปิดกระบวนการลงทะเบียน',
            source: 'Student/Getenrollstage',
            startAt: startAt || null,
            endAt: endAt || null,
            recordCount: records.length,
        };
    }

    return {
        status: 'unknown',
        message: statusMessage || 'REG ยังไม่ส่งสถานะช่วงลงทะเบียนที่ชัดเจน',
        source: records.length ? 'Student/Getenrollcontrol' : 'not_reported',
        startAt: startAt || null,
        endAt: endAt || null,
        recordCount: records.length,
    };
}

function readAcademicText(acadInfo, fieldNames) {
    const value = readRecordField(acadInfo, fieldNames);
    return value === null || value === undefined ? '' : String(value);
}

async function fetchRegV2(endpoint, token) {
    const bearerResponse = await axios.get(`${BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
        timeout: 3000,
    });

    if (bearerResponse.status !== 401) {
        return bearerResponse;
    }

    const tokenHeaderResponse = await axios.get(`${BASE_URL}${endpoint}`, {
        headers: { token },
        validateStatus: () => true,
        timeout: 3000,
    });

    return tokenHeaderResponse.status === 200 ? tokenHeaderResponse : bearerResponse;
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
            if (authContext) {
                return apiError(
                    'ต้องเข้าสู่ระบบด้วย REG credentials เพื่อตรวจสอบสถานะลงทะเบียน',
                    409,
                    'REG_TOKEN_REQUIRED'
                );
            }
            return unauthorized('Unauthorized');
        }

        const fallbackAuthRes = await fetchRegV2('/Schg/Getacadstd', token);

        if (fallbackAuthRes.status !== 200 || !fallbackAuthRes.data) {
            return unauthorized('Unauthorized');
        }

        acadInfoFromAuth = fallbackAuthRes.data;
    }

    if (userId) {
        const cached = gatekeeperCache.get(userId);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            return success(cached.data);
        }
    }

    try {
        const [enrollStageRes, enrollFeeRes, enrollControlRes, acadStdRes] = await Promise.allSettled([
            fetchRegV2('/Student/Getenrollstage', token),
            fetchRegV2('/Debt/Enrollfee', token),
            fetchRegV2('/Student/Getenrollcontrol', token),
            acadInfoFromAuth ? Promise.resolve({ status: 200, data: acadInfoFromAuth }) : fetchRegV2('/Schg/Getacadstd', token)
        ]);

        let stage = 0;
        if (enrollStageRes.status === 'fulfilled' && enrollStageRes.value?.status === 200) {
            stage = Number(enrollStageRes.value.data) || 0;
        }

        const fees = enrollFeeRes.status === 'fulfilled' && enrollFeeRes.value?.status === 200
            ? enrollFeeRes.value.data
            : [];
        const { outstandingFees, outstandingBalance, hasDebt } = summarizeOutstandingFees(fees);

        const enrollmentControlData = enrollControlRes.status === 'fulfilled' && enrollControlRes.value?.status === 200
            ? enrollControlRes.value.data
            : null;
        const registrationPeriod = summarizeEnrollmentControl(enrollmentControlData, stage);

        let acadInfo = {};
        if (acadStdRes.status === 'fulfilled' && acadStdRes.value?.status === 200) {
            acadInfo = acadStdRes.value.data;
        }

        const blockingReasons = [];
        const isRegistrationPeriod = registrationPeriod.status === 'open';
        const isPeriodClosed = registrationPeriod.status === 'closed';

        if (isPeriodClosed) {
            blockingReasons.push(registrationPeriod.message || 'ยังไม่อยู่ในช่วงเวลาลงทะเบียน');
        }

        if (hasDebt) {
            blockingReasons.push(`มียอดค้างชำระ ${outstandingBalance.toLocaleString('th-TH')} บาท`);
        }

        const responseData = {
            student: {
                id: readAcademicText(acadInfo, ['studentcode', 'studentCode']) || userId || 'Unknown',
                faculty: readAcademicText(acadInfo, ['facultyname', 'facultyName', 'faculty']) || null,
                department: readAcademicText(acadInfo, ['departmentname', 'departmentName', 'department']) || null,
            },
            stage,
            eligibility: {
                isRegistrationPeriod,
                registrationPeriodStatus: registrationPeriod.status,
                registrationPeriodMessage: registrationPeriod.message,
                registrationPeriodSource: registrationPeriod.source,
                registrationPeriodStartAt: registrationPeriod.startAt,
                registrationPeriodEndAt: registrationPeriod.endAt,
                requiresOfficialConfirmation: registrationPeriod.status === 'unknown',
                hasDebt,
                academicStatus: readAcademicText(acadInfo, ['statusdes', 'statusdeseng', 'studentstatus', 'status']) || null,
                canRegister: blockingReasons.length === 0,
                outstandingBalance,
                outstandingFees,
                blockingReasons,
                stageMessage: stage > 0 ? `REG รายงานสถานะการลงทะเบียนเป็น Stage ${stage}` : 'REG ยังไม่รายงานสถานะการลงทะเบียน'
            },
            acadInfo,
            updatedAt: new Date().toISOString()
        };

        if (userId) {
            gatekeeperCache.set(userId, { timestamp: Date.now(), data: responseData });
        }

        return success(responseData);
    } catch (error) {
        console.error('Gatekeeper Error:', error);
        return apiError('Gatekeeper System Error', 500, 'GATEKEEPER_ERROR');
    }
}
