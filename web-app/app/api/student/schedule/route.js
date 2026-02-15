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

// Disable SSL verification for the uni API
const agent = new https.Agent({
    rejectUnauthorized: false
});

// Zod Schema for Schedule Item Validation
const ScheduleItemSchema = z.object({
    weekday: z.number().min(1).max(7),
    timefrom: z.string().optional().nullable(),
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

    // Check for MOCK_AUTH mode or missing token -> Return Mock Data
    if (process.env.MOCK_AUTH === 'true' || !token) {
        const reason = !token ? 'no token in cookie' : 'MOCK_AUTH enabled';
        serverLog('WARN', `Serving Mock Data. Reason: ${reason}`);
        // Shortened mock data for brevity, ensuring it matches schema
        const mockSchedule = [
            {
                "weekday": 2, // Monday
                "timefrom": "09:00",
                "timeto": "12:00",
                "subject_id": "010123102",
                "subject_name_th": "การเขียนโปรแกรมคอมพิวเตอร์",
                "subject_name_en": "Computer Programming",
                "section": "1",
                "roomcode": "TB-402",
                "teach_name": "Dr. Somchai"
            },
            // ... add more if needed
        ];
        return NextResponse.json({
            success: true,
            data: mockSchedule,
            semester: '2/2568'
        });
    }

    try {
        // 1. Fetch Schedule Data (Enroll/Week)
        serverLog('INFO', 'Calling External API: Enroll/Week...');
        const scheduleResponse = await axios.get('https://reg4.kmutnb.ac.th/regapiweb2/api/th/Enroll/Week', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            httpsAgent: agent,
            validateStatus: () => true
        });

        serverLog('INFO', `External API Status: ${scheduleResponse.status}`);
        serverLog('INFO', `Response preview: ${JSON.stringify(scheduleResponse.data)?.substring(0, 300)}`);

        if (scheduleResponse.status !== 200) {
            serverLog('ERROR', `Upstream Error: ${scheduleResponse.status} - ${JSON.stringify(scheduleResponse.data)?.substring(0, 200)}`);
            return NextResponse.json({ 
                success: false, 
                error: 'Failed to fetch schedule from university',
                statusCode: scheduleResponse.status
            }, { status: scheduleResponse.status });
        }

        const rawData = scheduleResponse.data;

        if (!Array.isArray(rawData)) {
            serverLog('WARN', `Non-array response: ${typeof rawData}`);
            return NextResponse.json({ success: true, data: [], semester: 'Unknown' });
        }

        serverLog('INFO', `Raw data: ${rawData.length} items`);

        // 2. Filter & Validate
        const validItems = rawData
            .filter(item => {
                const hasSubject = item.subject_id && item.subject_id.trim() !== '';
                const hasTime = item.timefrom && item.timefrom.trim() !== '';
                if (!hasSubject || !hasTime) {
                    serverLog('DEBUG', `Filtered out: subject_id=${item.subject_id}, timefrom=${item.timefrom}`);
                }
                return hasSubject && hasTime;
            })
            .map(item => {
                // Normalize data if needed
                return {
                    ...item,
                    subject_id: item.subject_id?.trim(),
                    roomcode: item.roomcode || 'TBA',
                    // Any other normalization
                };
            });

        // Optional: Run Zod parse for strict type safety logging (don't crash, just filter)
        const safeItems = validItems.filter(item => {
            const result = ScheduleItemSchema.safeParse(item);
            if (!result.success) {
                serverLog('WARN', `Invalid Item Filtered: ${JSON.stringify(item)}`);
                return false;
            }
            return true;
        });

        serverLog('INFO', `Final result: ${rawData.length} raw → ${validItems.length} valid → ${safeItems.length} safe`);

        return NextResponse.json({
            success: true,
            data: safeItems,
            semester: '2/2568' // Mock or fetch dynamically if possible
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
