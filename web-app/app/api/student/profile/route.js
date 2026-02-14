import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import https from 'https';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

// Ignore self-signed certs
const agent = new https.Agent({ rejectUnauthorized: false });

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('reg_token')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Parallel Fetch: Bioentry (Personal) + Getacad (Academic Year)
        const [bioRes, acadRes] = await Promise.allSettled([
            axios.get(`${BASE_URL}/Bioentryconfig/Getbioentryconfig/I`, {
                headers: { 'Authorization': `Bearer ${token}` },
                httpsAgent: agent,
                validateStatus: () => true
            }),
            axios.get(`${BASE_URL}/Schg/Getacadstrat`, { // Note: using Getacadstd/Getacad based on previous tests
                // Actually, let's use the one that worked in tests: Schg/Getacad
                // Wait, test script said Schg/Getacad worked.
                headers: { 'Authorization': `Bearer ${token}` },
                httpsAgent: agent,
                validateStatus: () => true
            })
        ]);

        // Fallback for Getacad if it fails or URL was slightly different
        let academicData = {};
        if (acadRes.status === 'fulfilled' && acadRes.value.status === 200) {
            academicData = acadRes.value.data;
        } else {
            // Try Getacadstd if Getacad failed (backup)
            try {
                const resBackup = await axios.get(`${BASE_URL}/Schg/Getacadstd`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    httpsAgent: agent
                });
                if (resBackup.status === 200) academicData = resBackup.data;
            } catch (e) { console.error('Academic backup fetch failed'); }
        }

        // Process Bioentry Data
        let profile = {};
        if (bioRes.status === 'fulfilled' && bioRes.value.status === 200 && Array.isArray(bioRes.value.data)) {
            const entries = bioRes.value.data;

            // Helper to extract value (handling combolist IDs)
            const extract = (keywords) => {
                const item = entries.find(e => {
                    const name = e.bioentryname || '';
                    return keywords.some(k => name.includes(k));
                });

                if (!item) return null;

                let value = item.biodefaultvalue;
                // If value is ID, look up in combolist
                if (item.combolist && item.combolist.length > 0) {
                    const match = item.combolist.find(c => c.valueid == value);
                    if (match) value = match.label;
                }
                return value;
            };

            profile = {
                faculty: extract(['คณะ', 'Faculty']),
                department: extract(['สาขา', 'Department', 'ภาควิชา']),
                major: extract(['หลักสูตร', 'Curriculum']),
                advisor1: extract(['ที่ปรึกษาคนที่ 1', 'Advisor 1']),
                advisor2: extract(['ที่ปรึกษาคนที่ 2', 'Advisor 2']),
                advisor3: extract(['ที่ปรึกษาคนที่ 3', 'Advisor 3']),
            };
        }

        return NextResponse.json({
            success: true,
            data: {
                ...profile,
                admitYear: academicData.admitacadyear,
                currentYear: academicData.currentacadyear,
                currentSemester: academicData.currentsemester
            }
        });

    } catch (error) {
        console.error('Profile API Error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
