import { cookies } from 'next/headers';
import { success } from '@/lib/apiResponse';
import { AUTH_IDENTITY_COOKIE_NAME } from '@/lib/auth';
import { buildAuthCookieOptions } from '@/lib/authCookiePolicy.mjs';
import {
    clearKmutnbSsoCookies,
    KMUTNB_SSO_SESSION_COOKIE_NAME,
    verifyKmutnbSsoSessionCookie,
} from '@/lib/kmutnbSso';
import { revokeKmutnbSsoSession } from '@/lib/kmutnbSsoSessionStore';
export async function POST(request) {
    const response = success({ message: 'ออกจากระบบสำเร็จ' });
    const clearedAuthCookieOptions = buildAuthCookieOptions(request, 0);

    response.cookies.set('reg_token', '', clearedAuthCookieOptions);
    response.cookies.set(AUTH_IDENTITY_COOKIE_NAME, '', clearedAuthCookieOptions);
    response.cookies.set('std_code', '', clearedAuthCookieOptions);

    const cookieStore = await cookies();
    const ssoSessionCookie = cookieStore.get(KMUTNB_SSO_SESSION_COOKIE_NAME)?.value;
    if (ssoSessionCookie) {
        try {
            const payload = verifyKmutnbSsoSessionCookie(ssoSessionCookie);
            if (payload?.sessionId) {
                await revokeKmutnbSsoSession(payload.sessionId);
            }
        } catch (error) {
            console.warn('[Auth] Failed to revoke KMUTNB SSO session during logout:', error.message);
        }
    }

    clearKmutnbSsoCookies(response);
    return response;
}
