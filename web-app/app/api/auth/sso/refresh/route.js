import { cookies } from 'next/headers';
import { error, success, unauthorized } from '@/lib/apiResponse';
import {
    getMissingKmutnbSsoConfig,
    introspectKmutnbSsoAccessToken,
    isKmutnbSsoConfigured,
    isKmutnbSsoLoginEnabled,
    KMUTNB_SSO_SESSION_COOKIE_NAME,
    normalizeKmutnbSsoUserInfo,
    refreshKmutnbSsoTokenBundle,
    verifyKmutnbSsoSessionCookie,
} from '@/lib/kmutnbSso';
import { getKmutnbSsoSession, refreshKmutnbSsoSession } from '@/lib/kmutnbSsoSessionStore';

export async function POST() {
    if (!isKmutnbSsoLoginEnabled()) {
        return error('KMUTNB SSO login is disabled', 503, 'SSO_DISABLED');
    }

    if (!isKmutnbSsoConfigured()) {
        return error(
            `KMUTNB SSO backend is not configured: ${getMissingKmutnbSsoConfig().join(', ')}`,
            503,
            'SSO_NOT_CONFIGURED'
        );
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(KMUTNB_SSO_SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) {
        return unauthorized('KMUTNB SSO session is missing');
    }

    let cookiePayload;
    try {
        cookiePayload = verifyKmutnbSsoSessionCookie(sessionCookie);
    } catch {
        return unauthorized('KMUTNB SSO session cookie is invalid');
    }

    try {
        const existingSession = await getKmutnbSsoSession(cookiePayload.sessionId);
        if (!existingSession) {
            return unauthorized('KMUTNB SSO session was not found');
        }
        if (!existingSession.refreshToken) {
            return error('KMUTNB SSO session has no refresh token', 409, 'SSO_REFRESH_UNAVAILABLE');
        }

        const refreshedTokens = await refreshKmutnbSsoTokenBundle(existingSession.refreshToken);
        const refreshedUserInfo = refreshedTokens.userInfoFromToken || existingSession.userInfo;
        const normalizedUser = normalizeKmutnbSsoUserInfo(refreshedUserInfo);

        const updatedSession = await refreshKmutnbSsoSession(existingSession.sessionId, {
            provider: existingSession.provider,
            subject: normalizedUser.subject || existingSession.subject,
            userCode: normalizedUser.userCode || existingSession.userCode,
            accessToken: refreshedTokens.accessToken,
            refreshToken: refreshedTokens.refreshToken || existingSession.refreshToken,
            idToken: refreshedTokens.idToken || existingSession.idToken,
            scope: refreshedTokens.scope || existingSession.scope,
            tokenType: refreshedTokens.tokenType || existingSession.tokenType,
            accessTokenExpiresAt: refreshedTokens.accessTokenExpiresAt,
            userInfo: refreshedUserInfo,
        });

        const introspection = await introspectKmutnbSsoAccessToken(updatedSession.accessToken);

        return success({
            session: {
                sessionId: updatedSession.sessionId,
                subject: updatedSession.subject,
                userCode: updatedSession.userCode,
                accessTokenExpiresAt: updatedSession.accessTokenExpiresAt,
                scope: updatedSession.scope,
                lastRefreshedAt: updatedSession.lastRefreshedAt,
            },
            introspection,
        });
    } catch (refreshError) {
        return error(refreshError.message || 'KMUTNB SSO refresh failed', refreshError.status || 500, refreshError.code || 'SSO_REFRESH_FAILED');
    }
}
