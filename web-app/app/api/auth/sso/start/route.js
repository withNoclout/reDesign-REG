import { NextResponse } from 'next/server';
import { error } from '@/lib/apiResponse';
import {
    applyKmutnbSsoFlowCookie,
    buildKmutnbSsoAuthorizeUrl,
    createKmutnbSsoFlow,
    getMissingKmutnbSsoConfig,
    isKmutnbSsoConfigured,
    sanitizeReturnTo,
} from '@/lib/kmutnbSso';

export async function GET(request) {
    if (!isKmutnbSsoConfigured()) {
        return error(
            `KMUTNB SSO backend is not configured: ${getMissingKmutnbSsoConfig().join(', ')}`,
            503,
            'SSO_NOT_CONFIGURED'
        );
    }

    const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'));
    const flow = createKmutnbSsoFlow(returnTo);
    const response = NextResponse.redirect(buildKmutnbSsoAuthorizeUrl(flow));
    applyKmutnbSsoFlowCookie(response, flow.cookieValue);
    return response;
}
