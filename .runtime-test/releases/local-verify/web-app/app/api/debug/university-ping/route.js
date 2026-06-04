import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

/**
 * GET /api/debug/university-ping
 * Tests connectivity to the University API endpoints.
 * SECURITY: requires a valid reg_token cookie.
 */
export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('reg_token')?.value;

    if (!token) {
        return NextResponse.json({ error: 'Need reg_token cookie' }, { status: 401 });
    }

    const results = {};

    // Test 1: Bio endpoint
    try {
        const start1 = Date.now();
        const bioRes = await axios.get(`${BASE_URL}/Bioentryconfig/Getbioentryconfig/I`, {
            headers: { 'Authorization': `Bearer ${token}` },
            timeout: 12000,
            validateStatus: () => true
        });
        results.bio = {
            status: bioRes.status,
            elapsed: Date.now() - start1,
            dataKeys: Object.keys(bioRes.data || {}),
            entriesIsArray: Array.isArray(bioRes.data?.data),
            entriesLength: Array.isArray(bioRes.data?.data) ? bioRes.data.data.length : null,
            firstEntryName: Array.isArray(bioRes.data?.data) ? bioRes.data.data[0]?.bioentryname : null,
            hasFaculty: Array.isArray(bioRes.data?.data)
                ? !!bioRes.data.data.find(e => (e.bioentryname || '').includes('คณะ'))
                : false,
        };
    } catch (e) {
        results.bio = { error: e.message, code: e.code };
    }

    // Test 2: ID endpoint
    try {
        const start2 = Date.now();
        const idRes = await axios.get(`${BASE_URL}/Schg/Getacadstd`, {
            headers: { 'Authorization': `Bearer ${token}` },
            timeout: 12000,
            validateStatus: () => true
        });
        results.id = {
            status: idRes.status,
            elapsed: Date.now() - start2,
            studentCode: idRes.data?.studentCode || idRes.data?.usercode || null,
            dataKeys: Object.keys(idRes.data || {}),
        };
    } catch (e) {
        results.id = { error: e.message, code: e.code };
    }

    return NextResponse.json({ results }, { status: 200 });
}
