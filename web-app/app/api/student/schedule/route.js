import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import https from 'https';
import axios from 'axios';

// Disable SSL verification for the uni API
const agent = new https.Agent({
    rejectUnauthorized: false
});

export async function GET() {
    const cookieStore = cookies();
    const token = cookieStore.get('token');

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. Fetch Schedule Data (Enroll/Week)
        const scheduleResponse = await axios.get('https://reg4.kmutnb.ac.th/regapiweb2/api/th/Enroll/Week', {
            headers: {
                'Authorization': `Bearer ${token.value}`,
                'Content-Type': 'application/json'
            },
            httpsAgent: agent
        });

        const rawData = scheduleResponse.data;

        // 2. Transform Data (Optional: Enhance with day names, sorting)
        // The raw data usually comes as an array of slots.
        // keys: roomcode, weekday (int), weekcalllong (string), row, order...
        // We can pass it through or structure it better.
        // Let's pass it through for now, but maybe add a "dayKey" for easier grouping.

        const daysMap = {
            1: 'sunday',
            2: 'monday',
            3: 'tuesday',
            4: 'wednesday',
            5: 'thursday',
            6: 'friday',
            7: 'saturday'
        };

        const enhancedData = Array.isArray(rawData) ? rawData.map(item => ({
            ...item,
            dayKey: daysMap[item.weekday] || 'unknown',
            // Ensure time is formatted if needed, or rely on 'row'/'order'
        })) : [];

        return NextResponse.json({
            success: true,
            data: enhancedData,
            semester: '2/2568' // Mock or fetch dynamically if possible
        });

    } catch (error) {
        console.error('Schedule Fetch Error:', error.message);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch schedule data',
            details: error.response?.data || error.message
        }, { status: 500 });
    }
}
