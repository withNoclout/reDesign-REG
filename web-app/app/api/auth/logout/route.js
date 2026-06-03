import { cookies } from 'next/headers';
import { success } from '@/lib/apiResponse';
import { AUTH_IDENTITY_COOKIE_NAME } from '@/lib/auth';
import {
    clearKmutnbSsoCookies,
    KMUTNB_SSO_SESSION_COOKIE_NAME,
    verifyKmutnbSsoSessionCookie,
} from '@/lib/kmutnbSso';
import { revokeKmutnbSsoSession } from '@/lib/kmutnbSsoSessionStore';

export async function POST() {
    const response = success({ message: 'ออกจากระบบสำเร็จ' });

    response.cookies.set('reg_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
        maxAge: 0
    });

    response.cookies.set(AUTH_IDENTITY_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
        maxAge: 0
    });

    response.cookies.set('std_code', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
        maxAge: 0
    });

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
