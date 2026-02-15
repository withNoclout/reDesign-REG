import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import https from 'https';
import axios from 'axios';
import { z } from 'zod';

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

    // Check for MOCK_AUTH mode or missing token -> Return Mock Data
    if (process.env.MOCK_AUTH === 'true' || !token) {
        // ... (Keep existing Mock Logic for dev if needed, or simplify)
        console.log('[Schedule API] Serving Mock Data (Auth bypassed or missing token)');
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
        const scheduleResponse = await axios.get('https://reg4.kmutnb.ac.th/regapiweb2/api/th/Enroll/Week', {
            headers: {
                'Authorization': `Bearer ${token}`, // Use Bearer as proven in probe
                'Content-Type': 'application/json'
            },
            httpsAgent: agent,
            validateStatus: () => true
        });

        if (scheduleResponse.status !== 200) {
            console.warn('[Schedule API] Upstream Error:', scheduleResponse.status);
            return NextResponse.json({ success: false, error: 'Failed to fetch schedule from university' }, { status: scheduleResponse.status });
        }

        const rawData = scheduleResponse.data;

        if (!Array.isArray(rawData)) {
            return NextResponse.json({ success: true, data: [], semester: 'Unknown' });
        }

        // 2. Filter & Validate
        const validItems = rawData
            .filter(item => {
                // Critical Filter: Must have a subject_id AND a roomcode (or at least not be completely empty)
                // The issue was items with null roomcode/subject_id being returned for empty slots
                return item.subject_id && item.subject_id.trim() !== '' &&
                    item.timefrom && item.timefrom.trim() !== '';
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
                console.warn('[Schedule API] Invalid Item Filtered:', item, result.error.format());
                return false;
            }
            return true;
        });

        return NextResponse.json({
            success: true,
            data: safeItems,
            semester: '2/2568' // Mock or fetch dynamically if possible
        });

    } catch (error) {
        console.error('Schedule Fetch Error:', error.message);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch schedule data',
            details: error.message
        }, { status: 500 });
    }
}
