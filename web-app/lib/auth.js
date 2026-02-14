
import { cookies } from 'next/headers';
import axios from 'axios';

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

/**
 * Retrieves the authenticated user's ID (Student Code or User Code).
 * Supports MOCK_AUTH=true in .env to bypass external API checks during dev.
 * 
 * @returns {Promise<string|null>} The user ID if authenticated, or null.
 */
export async function getAuthUser() {
    // 1. Check for Mock Mode (Dev Only)
    // Note: In production, ensure MOCK_AUTH is NOT set or set to false.
    if (process.env.MOCK_AUTH === 'true') {
        console.warn('[Auth] ⚠️ Using MOCK_AUTH mode. Bypassing external API.');
        const mockId = '00000000-0000-0000-0000-000000000067'; // Valid UUID for testing
        return mockId;
    }

    // 2. Real Auth Check
    const cookieStore = await cookies();
    const token = cookieStore.get('reg_token')?.value;

    if (!token) {
        console.log('[Auth] No token found in cookies');
        return null;
    }

    try {
        // console.log(`[Auth] Verifying token against: ${BASE_URL}/Schg/Getacadstd`);
        const authRes = await axios.get(`${BASE_URL}/Schg/Getacadstd`, {
            headers: { 'Authorization': `Bearer ${token}` },
            validateStatus: status => status < 500
        });

        if (authRes.status !== 200 || !authRes.data) {
            console.log(`[Auth] External API rejected token. Status: ${authRes.status}`);
            return null;
        }

        const userId = authRes.data.studentCode || authRes.data.usercode || authRes.data.studentId;
        return userId;
    } catch (err) {
        console.error('[Auth] Check failed:', err.message);
        return null;
    }
}
