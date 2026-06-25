import { cookies } from 'next/headers';
import { success } from '@/lib/apiResponse';
import {
    clearKmutnbSsoCookies,
    getMissingKmutnbSsoConfig,
    introspectKmutnbSsoAccessToken,
    isKmutnbSsoConfigured,
    isKmutnbSsoLoginEnabled,
    KMUTNB_SSO_SESSION_COOKIE_NAME,
    normalizeKmutnbSsoUserInfo,
    verifyKmutnbSsoSessionCookie,
} from '@/lib/kmutnbSso';
import { getKmutnbSsoSession } from '@/lib/kmutnbSsoSessionStore';

export async function GET(request) {
    const enabled = isKmutnbSsoLoginEnabled();
    const configured = enabled && isKmutnbSsoConfigured();
    const missingConfig = enabled && !configured ? getMissingKmutnbSsoConfig() : [];
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(KMUTNB_SSO_SESSION_COOKIE_NAME)?.value;
    const wantsValidation = request.nextUrl.searchParams.get('validate') === 'true';

    if (!enabled) {
        return success({
            enabled,
            configured: false,
            missingConfig: [],
            session: null,
        });
    }

    if (!sessionCookie) {
        return success({
            enabled,
            configured,
            missingConfig,
            session: null,
        });
    }

    let cookiePayload;
    try {
        cookiePayload = verifyKmutnbSsoSessionCookie(sessionCookie);
    } catch {
        const response = success({
            enabled,
            configured,
            missingConfig,
            session: null,
            cookieInvalid: true,
        });
        clearKmutnbSsoCookies(response);
        return response;
    }

    try {
        const session = await getKmutnbSsoSession(cookiePayload.sessionId);
        if (!session) {
            const response = success({
                enabled,
                configured,
                missingConfig,
                session: null,
                sessionMissing: true,
            });
            clearKmutnbSsoCookies(response);
            return response;
        }

        const normalizedUser = normalizeKmutnbSsoUserInfo(session.userInfo || {});
        const data = {
            enabled,
            configured,
            missingConfig,
            session: {
                sessionId: session.sessionId,
                subject: session.subject,
                userCode: session.userCode,
                scope: session.scope,
                accessTokenExpiresAt: session.accessTokenExpiresAt,
                lastRefreshedAt: session.lastRefreshedAt,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
            },
            user: {
                subject: normalizedUser.subject,
                username: normalizedUser.username,
                displayName: normalizedUser.displayName,
                nameEn: normalizedUser.nameEn,
                email: normalizedUser.email,
                emailVerified: normalizedUser.emailVerified,
                accountType: normalizedUser.accountType,
                userCode: normalizedUser.userCode,
                studentInfo: normalizedUser.studentInfo,
                personnelInfo: normalizedUser.personnelInfo,
            },
            legacyRegBridgeReady: false,
        };

        if (wantsValidation && configured && session.accessToken) {
            data.introspection = await introspectKmutnbSsoAccessToken(session.accessToken);
        }

        return success(data);
    } catch (sessionError) {
        return success({
            enabled,
            configured,
            missingConfig,
            session: null,
            storageError: sessionError.message,
        }, sessionError.status || 500);
    }
}
