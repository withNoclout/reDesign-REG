import { cookies } from 'next/headers';
import { success } from '@/lib/apiResponse';
import {
    clearKmutnbSsoCookies,
    getMissingKmutnbSsoConfig,
    introspectKmutnbSsoAccessToken,
    isKmutnbSsoConfigured,
    KMUTNB_SSO_SESSION_COOKIE_NAME,
    verifyKmutnbSsoSessionCookie,
} from '@/lib/kmutnbSso';
import { getKmutnbSsoSession } from '@/lib/kmutnbSsoSessionStore';

export async function GET(request) {
    const configured = isKmutnbSsoConfigured();
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(KMUTNB_SSO_SESSION_COOKIE_NAME)?.value;
    const wantsValidation = request.nextUrl.searchParams.get('validate') === 'true';

    if (!sessionCookie) {
        return success({
            configured,
            missingConfig: configured ? [] : getMissingKmutnbSsoConfig(),
            session: null,
        });
    }

    let cookiePayload;
    try {
        cookiePayload = verifyKmutnbSsoSessionCookie(sessionCookie);
    } catch {
        const response = success({
            configured,
            missingConfig: configured ? [] : getMissingKmutnbSsoConfig(),
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
                configured,
                missingConfig: configured ? [] : getMissingKmutnbSsoConfig(),
                session: null,
                sessionMissing: true,
            });
            clearKmutnbSsoCookies(response);
            return response;
        }

        const data = {
            configured,
            missingConfig: configured ? [] : getMissingKmutnbSsoConfig(),
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
        };

        if (wantsValidation && configured && session.accessToken) {
            data.introspection = await introspectKmutnbSsoAccessToken(session.accessToken);
        }

        return success(data);
    } catch (sessionError) {
        return success({
            configured,
            missingConfig: configured ? [] : getMissingKmutnbSsoConfig(),
            session: null,
            storageError: sessionError.message,
        }, sessionError.status || 500);
    }
}
