import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { error, validationError } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import {
    clearInstagramPocFlowCookie,
    completeInstagramPocAuthorization,
    INSTAGRAM_POC_FLOW_COOKIE_NAME,
    isInstagramPocConfigured,
    verifyInstagramPocFlowCookie,
} from '@/lib/instagramPocService';
import { sanitizeReturnTo } from '@/lib/kmutnbSso';

export const runtime = 'nodejs';

function buildRedirectResponse(request, returnTo, params = {}) {
    const redirectTarget = new URL(sanitizeReturnTo(returnTo || '/settings/line'), request.nextUrl.origin);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            redirectTarget.searchParams.set(key, String(value));
        }
    });
    return NextResponse.redirect(redirectTarget);
}

export async function GET(request) {
    const origin = request.nextUrl.origin;
    if (!isInstagramPocConfigured(origin)) {
        return error('Instagram POC is not configured', 503, 'INSTAGRAM_NOT_CONFIGURED');
    }

    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    if (!code || !state) {
        return validationError('Missing Instagram OAuth code or state');
    }

    const cookieStore = await cookies();
    const flowCookie = cookieStore.get(INSTAGRAM_POC_FLOW_COOKIE_NAME)?.value;
    if (!flowCookie) {
        return error('Instagram OAuth flow cookie is missing or expired', 400, 'INSTAGRAM_FLOW_EXPIRED');
    }

    let flowState;
    try {
        flowState = verifyInstagramPocFlowCookie(flowCookie, state);
    } catch (verifyError) {
        return error(verifyError.message, 400, 'INSTAGRAM_STATE_INVALID');
    }

    const authContext = await getAuthContext();
    if (!authContext?.userId) {
        const response = buildRedirectResponse(request, flowState.returnTo, { instagramError: 'auth' });
        clearInstagramPocFlowCookie(response);
        return response;
    }

    if (String(authContext.userId) !== String(flowState.userCode)) {
        const response = buildRedirectResponse(request, flowState.returnTo, { instagramError: 'user-mismatch' });
        clearInstagramPocFlowCookie(response);
        return response;
    }

    try {
        await completeInstagramPocAuthorization({
            userCode: String(authContext.userId),
            code,
            origin,
        });
        const response = buildRedirectResponse(request, flowState.returnTo, { instagramConnected: '1' });
        clearInstagramPocFlowCookie(response);
        return response;
    } catch (connectError) {
        console.error('[api/instagram/link/callback] Instagram callback failed:', connectError);
        const response = buildRedirectResponse(request, flowState.returnTo, { instagramError: 'connect-failed' });
        clearInstagramPocFlowCookie(response);
        return response;
    }
}
