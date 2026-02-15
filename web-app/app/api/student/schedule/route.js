import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import https from 'https';
import axios from 'axios';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// Server-side log helper (persists to app.log)
function serverLog(level, message) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${level}] [Schedule API] ${message}\n`;
    try {
        const logPath = path.join(process.cwd(), 'logs', 'app.log');
        fs.appendFileSync(logPath, entry);
    } catch { /* ignore */ }
    console.log(`[Schedule API] ${message}`);
}

// Format time from API integers: tfrom=16, mfrom=0 → "16:00"
function formatTime(hour, minute) {
    if (hour == null) return null;
    return `${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`;
}

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

const agent = new https.Agent({ rejectUnauthorized: false });

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

    serverLog('INFO', `=== Request Start === Has token: ${!!token}, Token length: ${token?.length || 0}`);

    // Mock data fallback when no token
    if (process.env.MOCK_AUTH === 'true' || !token) {
        const reason = !token ? 'no token in cookie' : 'MOCK_AUTH enabled';
        serverLog('WARN', `Serving Mock Data. Reason: ${reason}`);
        return NextResponse.json({
            success: true,
            data: [{
                weekday: 2,
                timefrom: '09:00',
                timeto: '12:00',
                subject_id: '010123102',
                subject_name_th: 'การเขียนโปรแกรมคอมพิวเตอร์',
                subject_name_en: 'Computer Programming',
                section: '1',
                roomcode: 'TB-402',
                teach_name: 'Dr. Somchai'
            }],
            semester: '2/2568'
        });
    }

    const apiConfig = {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        httpsAgent: agent,
        validateStatus: () => true,
        timeout: 10000
    };

    try {
        // 1. Fetch Timetable + Grade data in parallel
        serverLog('INFO', 'Calling Enroll/Timetable + Grade/Showgrade...');
        const [timetableRes, gradeRes, acadRes] = await Promise.allSettled([
            axios.get(`${BASE_URL}/Enroll/Timetable`, apiConfig),
            axios.get(`${BASE_URL}/Grade/Showgrade`, apiConfig),
            axios.get(`${BASE_URL}/Schg/Getacadstd`, apiConfig)
        ]);

        // 2. Extract semester info
        let semester = '2/2568';
        if (acadRes.status === 'fulfilled' && acadRes.value?.status === 200) {
            const acad = acadRes.value.data;
            if (acad.enrollsemester && acad.enrollacadyear) {
                semester = `${acad.enrollsemester}/${acad.enrollacadyear}`;
            }
        }

        // 3. Build course name lookup from Grade/Showgrade
        const courseNames = {};
        if (gradeRes.status === 'fulfilled' && gradeRes.value?.status === 200 && Array.isArray(gradeRes.value.data)) {
            for (const g of gradeRes.value.data) {
                if (g.coursecode) {
                    courseNames[g.coursecode] = g.coursename || null;
                }
            }
            serverLog('INFO', `Grade lookup built: ${Object.keys(courseNames).length} courses`);
        }

        // 4. Process Timetable response
        if (timetableRes.status !== 'fulfilled' || timetableRes.value?.status !== 200) {
            const status = timetableRes.status === 'fulfilled' ? timetableRes.value?.status : 'rejected';
            serverLog('ERROR', `Timetable API failed: ${status}`);
            return NextResponse.json({
                success: false,
                error: 'Failed to fetch timetable from university',
                statusCode: status
            }, { status: typeof status === 'number' ? status : 502 });
        }

        const rawData = timetableRes.value.data;
        serverLog('INFO', `Timetable raw: ${Array.isArray(rawData) ? rawData.length : 'N/A'} items`);
        serverLog('INFO', `Timetable preview: ${JSON.stringify(rawData)?.substring(0, 300)}`);

        if (!Array.isArray(rawData) || rawData.length === 0) {
            serverLog('INFO', 'No timetable data — student may not have enrolled');
            return NextResponse.json({ success: true, data: [], semester });
        }

        // 5. Transform Timetable fields → our schema
        const transformed = rawData
            .filter(item => {
                const hasCode = item.coursecode && String(item.coursecode).trim() !== '';
                const hasTime = item.tfrom != null;
                if (!hasCode || !hasTime) {
                    serverLog('DEBUG', `Filtered: coursecode=${item.coursecode}, tfrom=${item.tfrom}`);
                }
                return hasCode && hasTime;
            })
            .map(item => {
                const courseName = courseNames[item.coursecode] || null;
                return {
                    weekday: item.weekday,
                    timefrom: formatTime(item.tfrom, item.mfrom),
                    timeto: formatTime(item.tto, item.mto),
                    subject_id: String(item.coursecode).trim(),
                    subject_name_en: courseName,
                    subject_name_th: null,
                    section: item.sectioncode ? String(item.sectioncode) : null,
                    roomcode: item.roomname || item.roomcode || 'TBA',
                    teach_name: null
                };
            });

        // 6. Zod validation (filter invalid, don't crash)
        const safeItems = transformed.filter(item => {
            const result = ScheduleItemSchema.safeParse(item);
            if (!result.success) {
                serverLog('WARN', `Zod rejected: ${JSON.stringify(item)}`);
                return false;
            }
            return true;
        });

        serverLog('INFO', `Final: ${rawData.length} raw → ${transformed.length} transformed → ${safeItems.length} safe`);

        return NextResponse.json({
            success: true,
            data: safeItems,
            semester
        });

    } catch (error) {
        serverLog('ERROR', `Schedule Fetch Error: ${error.message}`);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch schedule data',
            details: error.message
        }, { status: 500 });
    }
}
