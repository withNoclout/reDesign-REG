import { NextResponse } from 'next/server';
import { error, unauthorized } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import {
    applyInstagramPocFlowCookie,
    buildInstagramAuthorizeUrl,
    createInstagramPocFlow,
    getInstagramPocMissingConfig,
    isInstagramPocConfigured,
} from '@/lib/instagramPocService';

export const runtime = 'nodejs';

export async function GET(request) {
    const origin = request.nextUrl.origin;
    if (!isInstagramPocConfigured(origin)) {
        return error(
            `Instagram POC is not configured: ${getInstagramPocMissingConfig(origin).join(', ')}`,
            503,
            'INSTAGRAM_NOT_CONFIGURED'
        );
    }

    const authContext = await getAuthContext();
    if (!authContext?.userId) {
        return unauthorized();
    }

    const returnTo = request.nextUrl.searchParams.get('returnTo') || '/settings/classroom';
    const flow = createInstagramPocFlow(String(authContext.userId), returnTo);
    const response = NextResponse.redirect(buildInstagramAuthorizeUrl(flow, origin));
    applyInstagramPocFlowCookie(response, flow.cookieValue);
    return response;
}
