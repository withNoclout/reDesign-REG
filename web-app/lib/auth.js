
import { cookies } from 'next/headers';
import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

// In-memory cache for token validation (avoids hitting external API on every request)
const _authCache = new Map();
const AUTH_CACHE_TTL = 30_000; // 30 seconds — safe because REG tokens expire in ~55 min

function _getCachedAuth(token) {
    const entry = _authCache.get(token);
    if (entry && Date.now() - entry.time < AUTH_CACHE_TTL) return entry.result;
    return undefined;
}

function _setCachedAuth(token, result) {
    _authCache.set(token, { result, time: Date.now() });
    // Evict stale entries periodically (keep map small)
    if (_authCache.size > 200) {
        const now = Date.now();
        for (const [k, v] of _authCache) {
            if (now - v.time > AUTH_CACHE_TTL) _authCache.delete(k);
        }
    }
}

/**
 * Retrieves the authenticated user's ID (Student Code or User Code).
 * Validates session against the external REG API, then retrieves user ID
 * from the std_code cookie (set during login).
 * Results are cached for 30s per token to avoid redundant external API calls.
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

    // 3. Check cache first
    const cached = _getCachedAuth(token);
    if (cached !== undefined) return cached;

    try {
        // Validate token is still active by hitting the REG API
        const authRes = await axios.get(`${BASE_URL}/Schg/Getacadstd`, {
            headers: { 'Authorization': `Bearer ${token}` },
            validateStatus: status => status < 500
        });

        if (authRes.status !== 200) {
            console.log(`[Auth] External API rejected token. Status: ${authRes.status}`);
            _setCachedAuth(token, null);
            return null;
        }

        // Token is valid — get user ID from std_code cookie (set during login)
        const userId = cookieStore.get('std_code')?.value;
        if (!userId) {
            console.warn('[Auth] Token valid but std_code cookie missing');
            _setCachedAuth(token, null);
            return null;
        }

        _setCachedAuth(token, userId);
        return userId;
    } catch (err) {
        console.error('[Auth] Check failed:', err.message);
        return null;
    }
}
