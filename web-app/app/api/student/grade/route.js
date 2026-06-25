import { NextResponse } from 'next/server';
import axios from 'axios';
import { getAuthContext } from '@/lib/auth';
import { buildAcademicRecordForStudent, mergeSpecialAcademicRecord } from '@/lib/studentAcademicRecord.mjs';
import { isSpecialStudentCode } from '@/lib/studentPortalSummary.mjs';

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

const GRADE_ENDPOINTS = [
    { url: `${BASE_URL}/Grade/Showgrade`, label: 'Grade/Showgrade', needsArray: true },
    { url: 'https://reg4.kmutnb.ac.th/regapiweb1/api/th/Grade/Showgrade', label: 'Legacy Grade/Showgrade', needsArray: true },
    { url: `${BASE_URL}/Schg/Showgrade`, label: 'Schg/Showgrade', needsArray: true },
    { url: `${BASE_URL}/Schg/Getgrade`, label: 'Schg/Getgrade', needsArray: true },
    { url: `${BASE_URL}/Schg/GetStudyResult`, label: 'Schg/GetStudyResult', needsArray: true },
];

const gradeCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function buildSpecialGradeResponse(liveRows = [], cached = false) {
    return NextResponse.json({
        success: true,
        data: Array.isArray(liveRows) ? liveRows : [],
        academicRecord: buildAcademicRecordForStudent('6701091611290', liveRows),
        source: 'special-student-record',
        cached,
        empty: false,
    });
}

async function fetchLiveGradeRows(token) {
    if (!token) {
        const tokenError = new Error('Missing REG bearer token for live grade fetch');
        tokenError.status = 409;
        tokenError.code = 'REG_TOKEN_REQUIRED';
        throw tokenError;
    }

    const config = {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
        timeout: 8000,
    };

    const results = await Promise.allSettled(
        GRADE_ENDPOINTS.map(async (endpoint) => {
            const response = await axios.get(endpoint.url, config);

            if (response.status === 401) {
                const authError = new Error('Unauthorized');
                authError.status = 401;
                throw authError;
            }

            if (response.status !== 200 || !response.data) {
                throw new Error(`Grade endpoint ${endpoint.label} returned ${response.status}`);
            }

            if (endpoint.needsArray && !Array.isArray(response.data)) {
                throw new Error(`Grade endpoint ${endpoint.label} returned a non-array payload`);
            }

            return Array.isArray(response.data) ? response.data : [];
        }),
    );

    const successfulRows = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);
    const rowsWithData = successfulRows.find((rows) => rows.length > 0);

    if (rowsWithData) {
        return rowsWithData;
    }
    if (successfulRows.length > 0) {
        return [];
    }

    const errors = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason);
    const authError = errors.find((cause) => cause?.status === 401);
    if (authError) {
        throw authError;
    }

    throw new AggregateError(errors, 'All grade endpoints failed');
}

export async function GET() {
    try {
        const authContext = await getAuthContext();
        if (!authContext) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ session กรุณาเข้าสู่ระบบใหม่' },
                { status: 401 },
            );
        }

        const { token, userId } = authContext;
        const isSpecialStudent = isSpecialStudentCode(userId);

        if (userId) {
            const cached = gradeCache.get(userId);
            if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
                if (isSpecialStudent) {
                    return buildSpecialGradeResponse(cached.data, true);
                }
                return NextResponse.json({
                    success: true,
                    data: cached.data,
                    academicRecord: cached.academicRecord,
                    cached: true,
                    empty: Array.isArray(cached.data) && cached.data.length === 0,
                    message: Array.isArray(cached.data) && cached.data.length === 0 ? 'ไม่พบข้อมูลผลการเรียนจาก REG' : undefined,
                });
            }
        }

        if (!token && isSpecialStudent) {
            const academicRecord = mergeSpecialAcademicRecord(null);
            gradeCache.set(userId, { timestamp: Date.now(), data: [], academicRecord });
            return NextResponse.json({
                success: true,
                data: [],
                academicRecord,
                source: 'special-student-record',
                empty: false,
            });
        }

        if (!token) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'บัญชีนี้ไม่มี REG token สำหรับดึงผลการเรียน กรุณาเข้าสู่ระบบด้วยรหัสนักศึกษาอีกครั้ง',
                    code: 'REG_TOKEN_REQUIRED',
                    authProvider: authContext.authProvider,
                },
                { status: 409 },
            );
        }

        const liveRows = await fetchLiveGradeRows(token);
        const academicRecord = buildAcademicRecordForStudent(userId, liveRows);

        if (userId) {
            gradeCache.set(userId, { timestamp: Date.now(), data: liveRows, academicRecord });
        }

        return NextResponse.json({
            success: true,
            data: liveRows,
            academicRecord,
            source: isSpecialStudent ? 'special-student-record' : 'live-reg-api',
            empty: liveRows.length === 0,
            message: liveRows.length === 0 ? 'ไม่พบข้อมูลผลการเรียนจาก REG' : undefined,
        });
    } catch (error) {
        if (error.errors?.some((cause) => cause.status === 401) || error.status === 401) {
            return NextResponse.json(
                { success: false, message: 'Session Expired (Unauthorized)', code: 'SESSION_EXPIRED' },
                { status: 401 },
            );
        }

        if (error.code === 'REG_TOKEN_REQUIRED') {
            return NextResponse.json(
                { success: false, message: 'บัญชีนี้ไม่มี REG token สำหรับดึงผลการเรียน กรุณาเข้าสู่ระบบด้วยรหัสนักศึกษาอีกครั้ง', code: 'REG_TOKEN_REQUIRED' },
                { status: error.status || 409 },
            );
        }

        console.error('[API] Grade fetch error:', error.errors || error.message);
        return NextResponse.json(
            { success: false, message: 'ไม่สามารถดึงข้อมูลผลการเรียนได้ (REG endpoint unavailable)', code: 'REG_GRADE_UNAVAILABLE' },
            { status: 503 },
        );
    }
}
