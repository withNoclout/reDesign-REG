
import { cookies } from 'next/headers';
import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

/**
 * Retrieves the authenticated user's ID (Student Code or User Code).
 * Validates session against the external REG API, then retrieves user ID
 * from the std_code cookie (set during login).
 * 
 * @returns {Promise<string|null>} The user ID if authenticated, or null.
 */
export async function getAuthUser() {
    // 1. Check for Mock Mode (Dev Only)
    if (process.env.MOCK_AUTH === 'true') {
        console.warn('[Auth] ⚠️ Using MOCK_AUTH mode. Bypassing external API.');
        const mockId = '00000000-0000-0000-0000-000000000067';
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
        // Validate token is still active by hitting the REG API
        const authRes = await axios.get(`${BASE_URL}/Schg/Getacadstd`, {
            headers: { 'Authorization': `Bearer ${token}` },
            validateStatus: status => status < 500
        });

        if (authRes.status !== 200) {
            console.log(`[Auth] External API rejected token. Status: ${authRes.status}`);
            return null;
        }

        // Token is valid — get user ID from std_code cookie (set during login)
        const userId = cookieStore.get('std_code')?.value;
        if (!userId) {
            console.warn('[Auth] Token valid but std_code cookie missing');
            return null;
        }

        return userId;
    } catch (err) {
        console.error('[Auth] Check failed:', err.message);
        return null;
    }
}
