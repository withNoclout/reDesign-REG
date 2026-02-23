import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import https from 'https';
import axios from 'axios';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

/**
 * API Route: /api/student/schedule
 * 
 * วัตถุประสงค์: ดึงตารางเรียนของนักศึกษาในเทอมปัจจุบัน พร้อมข้อมูลครบถ้วน
 * 
 * External API ที่ใช้ (regapiweb1 - API หลักของ reg3.kmutnb.ac.th):
 * 
 * 1. Timetable/Timetable/{acadyear}/{semester} - ตารางเรียนครบถ้วน ✅ RECOMMENDED
 *    - URL: https://reg3.kmutnb.ac.th/regapiweb1/api/th/Timetable/Timetable/2568/2
 *    - Method: GET
 *    - Authentication: Bearer token
 *    - Response Format: { result: "base64-gzip-compressed-json" }
 *    - Data Encoding: 
 *      1. JSON → gzip compress → base64 encode
 *      2. ต้อง decode: base64 → gunzip → JSON
 *    - Response Fields (after decode):
 *      * coursecode, coursename (TH), coursenameeng (EN)
 *      * sectioncode, classid
 *      * time (HTML format): "<B><FONT COLOR=#5080E0>พ.</FONT></B><FONT>13:00-16:00</FONT>"
 *      * roomtime: ห้องเรียน
 *      * classofficer (HTML): ชื่ออาจารย์
 *      * m_exam, f_exam: วันสอบกลางเทอม/ปลายเทอม
 *      * creditattempt, courseunit
 * 
 * 2. Schg/Getacadstd - ดึงข้อมูลเทอมปัจจุบัน (สำหรับ dynamic acadyear/semester)
 *    - URL: https://reg4.kmutnb.ac.th/regapiweb2/api/th/Schg/Getacadstd
 *    - Response: { enrollsemester, enrollacadyear, ... }
 * 
 * ⚠️ API เดิมที่ไม่แนะนำ:
 * - regapiweb2/Enroll/Timetable → ข้อมูลไม่ครบ (มีแค่ 16.7% ของวิชาทั้งหมด)
 * - ไม่มีชื่อวิชา, ไม่มีชื่ออาจารย์, ไม่มีวันสอบ
 * 
 * Logic:
 * 1. เรียก Schg/Getacadstd → ได้ปีการศึกษา/ภาคเรียนปัจจุบัน
 * 2. เรียก Timetable/Timetable/{acadyear}/{semester} → ได้ตารางครบถ้วน
 * 3. Decode: base64 → gunzip → JSON
 * 4. Parse HTML ใน field "time" → ดึงวัน-เวลาเรียน
 * 5. Clean HTML tags จาก classofficer, roomtime
 * 6. Format เป็น schema ที่ frontend ต้องการ
 * 
 * Data Coverage: ~66.7% ของวิชาทั้งหมด (ดีกว่า regapiweb2 มาก)
 */

// Server-side log helper (fire-and-forget async I/O)
function serverLog(level, message) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${level}] [Schedule API] ${message}\n`;
    const logPath = path.join(process.cwd(), 'logs', 'app.log');
    fs.appendFile(logPath, entry).catch(() => { });
    console.log(`[Schedule API] ${message}`);
}

// Format time from API integers: tfrom=16, mfrom=0 → "16:00"
function formatTime(hour, minute) {
    if (hour == null) return null;
    return `${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`;
}

const BASE_URL_V1 = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th';
const BASE_URL_V2 = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

const scheduleCache = new Map();
const SCHEDULE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let globalAcadInfo = null;
let globalAcadInfoTimestamp = 0;
const ACAD_INFO_TTL_MS = 60 * 60 * 1000; // 1 hour

const agent = new https.Agent({ rejectUnauthorized: false });

const gunzip = promisify(zlib.gunzip);

// Helper: Decode gzip-compressed base64 response from regapiweb1
async function decodeGzipResponse(base64String) {
    const compressedBuffer = Buffer.from(base64String, 'base64');
    const decompressed = await gunzip(compressedBuffer);
    return JSON.parse(decompressed.toString('utf-8'));
}

// Helper: Parse HTML time format from regapiweb1
// Example: "<B><FONT COLOR=#5080E0>พ.</FONT></B><FONT>13:00-16:00</FONT>"
// Returns: { weekday: 4, timefrom: "13:00", timeto: "16:00" }
function parseTimeHtml(timeHtml) {
    if (!timeHtml) return { weekday: null, timefrom: null, timeto: null };

    // Extract day abbreviation (จ, อ, พ, พฤ, ศ, ส, อา)
    // Must check 2-char days first (พฤ, อา) before single chars
    const dayMatch = timeHtml.match(/>(พฤ|อา|จ|อ|พ|ศ|ส)\.?</);
    const dayMap = { 'จ': 2, 'อ': 3, 'พ': 4, 'พฤ': 5, 'ศ': 6, 'ส': 7, 'อา': 1 };

    // Extract time range (HH:MM-HH:MM)
    const timeMatch = timeHtml.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);

    return {
        weekday: dayMatch ? dayMap[dayMatch[1]] : null,
        timefrom: timeMatch ? timeMatch[1] : null,
        timeto: timeMatch ? timeMatch[2] : null
    };
}

// Helper: Remove HTML tags
function stripHtml(html) {
    if (!html) return null;
    return html.replace(/<[^>]*>/g, '').trim();
}

// Zod Schema for our normalized schedule item
const ScheduleItemSchema = z.object({
    weekday: z.number().min(1).max(7),
    timefrom: z.string().min(1),
    timeto: z.string().optional().nullable(),
    subject_id: z.string().min(1),
    subject_name_th: z.string().optional().nullable(),
    subject_name_en: z.string().optional().nullable(),
    section: z.string().optional().nullable(),
    roomcode: z.string().optional().nullable(),
    teach_name: z.string().optional().nullable()
});

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('reg_token')?.value;
    const stdCode = cookieStore.get('std_code')?.value;

    serverLog('INFO', `=== Request Start === Has token: ${!!token}, Token length: ${token?.length || 0}`);

    // Mock data fallback when no token
    if (process.env.MOCK_AUTH === 'true' || !token) {
        const reason = !token ? 'no token in cookie' : 'MOCK_AUTH enabled';
        serverLog('WARN', `Serving Mock Data. Reason: ${reason}`);

        const mockData = [{
            weekday: 2,
            timefrom: '09:00',
            timeto: '12:00',
            subject_id: '010123102',
            subject_name_th: 'การเขียนโปรแกรมคอมพิวเตอร์',
            subject_name_en: 'Computer Programming',
            section: '1',
            roomcode: 'TB-402',
            teach_name: 'Dr. Somchai'
        }];

        return NextResponse.json({
            success: true,
            data: mockData,
            scheduled: mockData,
            unscheduled: [],
            stats: { total: 1, withSchedule: 1, withoutSchedule: 0 },
            semester: '2/2568'
        });
    }

    // 🚀 FAST PATH: Check Active Memory Cache first
    if (stdCode && process.env.MOCK_AUTH !== 'true') {
        const cached = scheduleCache.get(stdCode);
        if (cached && (Date.now() - cached.timestamp < SCHEDULE_CACHE_TTL_MS)) {
            serverLog('INFO', `Fast Memory Cache hit (latency ~0ms) for schedule: ${stdCode}`);
            return NextResponse.json(cached.data);
        }
    }

    const apiConfig = {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        httpsAgent: agent,
        validateStatus: () => true,
        timeout: 5000 // Reduced from 10000 to fail fast
    };

    try {
        // 1. Get current semester info (Cached Globally)
        let semester = '2/2568';
        let acadyear = 2568;
        let semesterNum = 2;

        if (globalAcadInfo && (Date.now() - globalAcadInfoTimestamp < ACAD_INFO_TTL_MS)) {
            serverLog('INFO', 'Using globally cached Acad Info (latency ~0ms)');
            semester = globalAcadInfo.semester;
            acadyear = globalAcadInfo.acadyear;
            semesterNum = globalAcadInfo.semesterNum;
        } else {
            serverLog('INFO', 'Calling Schg/Getacadstd...');
            const acadRes = await axios.get(`${BASE_URL_V2}/Schg/Getacadstd`, apiConfig);

            if (acadRes.status === 200 && acadRes.data) {
                const acad = acadRes.data;
                if (acad.enrollsemester && acad.enrollacadyear) {
                    semester = `${acad.enrollsemester}/${acad.enrollacadyear}`;
                    acadyear = acad.enrollacadyear;
                    semesterNum = acad.enrollsemester;

                    globalAcadInfo = { semester, acadyear, semesterNum };
                    globalAcadInfoTimestamp = Date.now();
                }
            }
        }

        // 2. Fetch timetable from regapiweb1 (compressed format)
        serverLog('INFO', `Calling Timetable/Timetable/${acadyear}/${semesterNum}...`);
        const timetableRes = await axios.get(
            `${BASE_URL_V1}/Timetable/Timetable/${acadyear}/${semesterNum}`,
            apiConfig
        );

        if (timetableRes.status !== 200 || !timetableRes.data?.result) {
            serverLog('ERROR', `Timetable API failed: ${timetableRes.status}`);
            return NextResponse.json({
                success: false,
                error: 'Failed to fetch timetable from university',
                statusCode: timetableRes.status
            }, { status: timetableRes.status || 502 });
        }

        // 3. Decode gzip-compressed response
        serverLog('INFO', 'Decoding gzip-compressed timetable...');
        const rawData = await decodeGzipResponse(timetableRes.data.result);

        serverLog('INFO', `Timetable decoded: ${Array.isArray(rawData) ? rawData.length : 'N/A'} courses`);

        if (!Array.isArray(rawData) || rawData.length === 0) {
            serverLog('INFO', 'No timetable data — student may not have enrolled');
            return NextResponse.json({ success: true, data: [], semester });
        }

        // 4. Transform regapiweb1 format → our schema
        const transformed = rawData
            .filter(item => {
                const hasCode = item.coursecode && String(item.coursecode).trim() !== '';
                if (!hasCode) {
                    serverLog('DEBUG', `Filtered: coursecode=${item.coursecode}`);
                }
                return hasCode;
            })
            .map(item => {
                const schedule = parseTimeHtml(item.time);
                const teacherName = stripHtml(item.classofficer);
                const roomName = stripHtml(item.roomtime);

                return {
                    weekday: schedule.weekday,
                    timefrom: schedule.timefrom,
                    timeto: schedule.timeto,
                    subject_id: String(item.coursecode).trim(),
                    subject_name_en: item.coursenameeng || null,
                    subject_name_th: item.coursename || null,
                    section: item.sectioncode ? String(item.sectioncode) : null,
                    roomcode: roomName || 'TBA',
                    teach_name: teacherName || null,
                    // Extra fields (useful for frontend)
                    credit: item.creditattempt || null,
                    exam_midterm: item.m_exam ? stripHtml(item.m_exam) : null,
                    exam_final: item.f_exam ? stripHtml(item.f_exam) : null
                };
            });

        // 5. Separate scheduled vs unscheduled courses
        const scheduledCourses = transformed.filter(item => item.weekday !== null);
        const unscheduledCourses = transformed.filter(item => item.weekday === null);

        serverLog('INFO', `Final: ${rawData.length} total → ${scheduledCourses.length} scheduled + ${unscheduledCourses.length} unscheduled`);

        const responseData = {
            success: true,
            data: transformed,  // All courses
            scheduled: scheduledCourses,  // Courses with time
            unscheduled: unscheduledCourses,  // Courses without time
            semester,
            stats: {
                total: rawData.length,
                withSchedule: scheduledCourses.length,
                withoutSchedule: unscheduledCourses.length
            }
        };

        // Update Memory Cache
        if (stdCode && process.env.MOCK_AUTH !== 'true') {
            scheduleCache.set(stdCode, { timestamp: Date.now(), data: { ...responseData, cached: true } });
        }

        return NextResponse.json(responseData);

    } catch (error) {
        serverLog('ERROR', `Schedule Fetch Error: ${error.message}`);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch schedule data',
            details: error.message
        }, { status: 500 });
    }
}
