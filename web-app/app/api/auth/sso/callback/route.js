import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { error, success, validationError } from '@/lib/apiResponse';
import {
    applyKmutnbSsoSessionCookie,
    clearKmutnbSsoCookies,
    createKmutnbSsoSessionCookie,
    exchangeKmutnbSsoAuthorizationCode,
    fetchKmutnbSsoUserInfo,
    getMissingKmutnbSsoConfig,
    isKmutnbSsoConfigured,
    isKmutnbSsoLoginEnabled,
    KMUTNB_SSO_FLOW_COOKIE_NAME,
    normalizeKmutnbSsoUserInfo,
    sanitizeReturnTo,
    verifyKmutnbSsoFlowCookie,
} from '@/lib/kmutnbSso';
import { createKmutnbSsoSession } from '@/lib/kmutnbSsoSessionStore';

export async function GET(request) {
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

    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const wantsJson = request.nextUrl.searchParams.get('format') === 'json';

    if (!code || !state) {
        return validationError('Missing KMUTNB SSO code or state');
    }

    const cookieStore = await cookies();
    const flowCookie = cookieStore.get(KMUTNB_SSO_FLOW_COOKIE_NAME)?.value;
    if (!flowCookie) {
        return error('KMUTNB SSO flow cookie is missing or expired', 400, 'SSO_FLOW_EXPIRED');
    }

    let flowState;
    try {
        flowState = verifyKmutnbSsoFlowCookie(flowCookie, state);
    } catch (verifyError) {
        return error(verifyError.message, 400, 'SSO_STATE_INVALID');
    }

    try {
        const tokenBundle = await exchangeKmutnbSsoAuthorizationCode(code, flowState.codeVerifier);
        const rawUserInfo = tokenBundle.userInfoFromToken || await fetchKmutnbSsoUserInfo(tokenBundle.accessToken);
        const normalizedUser = normalizeKmutnbSsoUserInfo(rawUserInfo);

        if (!normalizedUser.subject) {
            return error('KMUTNB SSO user info did not include a subject identifier', 502, 'SSO_SUBJECT_MISSING');
        }

        const session = await createKmutnbSsoSession({
            subject: normalizedUser.subject,
            userCode: normalizedUser.userCode,
            accessToken: tokenBundle.accessToken,
            refreshToken: tokenBundle.refreshToken,
            idToken: tokenBundle.idToken,
            scope: tokenBundle.scope,
            tokenType: tokenBundle.tokenType,
            accessTokenExpiresAt: tokenBundle.accessTokenExpiresAt,
            userInfo: normalizedUser.raw,
        });

        if (wantsJson) {
            const response = success({
                session: {
                    sessionId: session.sessionId,
                    subject: session.subject,
                    userCode: session.userCode,
                    accountType: normalizedUser.accountType,
                    accessTokenExpiresAt: session.accessTokenExpiresAt,
                    scope: session.scope,
                },
                user: normalizedUser,
            });
            clearKmutnbSsoCookies(response);
            applyKmutnbSsoSessionCookie(response, createKmutnbSsoSessionCookie(session));
            return response;
        }

        const redirectTarget = new URL(sanitizeReturnTo(flowState.returnTo), request.nextUrl.origin);
        const response = NextResponse.redirect(redirectTarget);
        clearKmutnbSsoCookies(response);
        applyKmutnbSsoSessionCookie(response, createKmutnbSsoSessionCookie(session));
        return response;
    } catch (ssoError) {
        return error(ssoError.message || 'KMUTNB SSO callback failed', ssoError.status || 500, ssoError.code || 'SSO_CALLBACK_FAILED');
    }
}
