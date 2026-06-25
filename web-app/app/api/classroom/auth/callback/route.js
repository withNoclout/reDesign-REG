import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { error, validationError } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import {
    clearGoogleClassroomFlowCookie,
    GOOGLE_CLASSROOM_FLOW_COOKIE_NAME,
    sanitizeReturnTo,
    verifyGoogleClassroomFlowCookie,
} from '@/lib/googleClassroom';
import { canUseGoogleClassroomMailFlow, completeGoogleClassroomMailAuthorization } from '@/lib/googleClassroomMailService';

function buildRedirectResponse(request, returnTo, params = {}) {
    const redirectTarget = new URL(sanitizeReturnTo(returnTo), request.nextUrl.origin);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            redirectTarget.searchParams.set(key, String(value));
        }
    });
    return NextResponse.redirect(redirectTarget);
}

export async function GET(request) {
    if (!canUseGoogleClassroomMailFlow()) {
        return error('Google Classroom Gmail POC is not configured', 503, 'GOOGLE_CLASSROOM_NOT_CONFIGURED');
    }

    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    if (!code || !state) {
        return validationError('Missing Google OAuth code or state');
    }

    const cookieStore = await cookies();
    const flowCookie = cookieStore.get(GOOGLE_CLASSROOM_FLOW_COOKIE_NAME)?.value;
    if (!flowCookie) {
        return error('Google OAuth flow cookie is missing or expired', 400, 'GOOGLE_CLASSROOM_FLOW_EXPIRED');
    }

    let flowState;
    try {
        flowState = verifyGoogleClassroomFlowCookie(flowCookie, state);
    } catch (verifyError) {
        return error(verifyError.message, 400, 'GOOGLE_CLASSROOM_STATE_INVALID');
    }

    const authContext = await getAuthContext();
    if (!authContext?.userId) {
        const response = buildRedirectResponse(request, flowState.returnTo, { classroomError: 'auth' });
        clearGoogleClassroomFlowCookie(response);
        return response;
    }

    if (String(authContext.userId) !== String(flowState.userCode)) {
        const response = buildRedirectResponse(request, flowState.returnTo, { classroomError: 'user-mismatch' });
        clearGoogleClassroomFlowCookie(response);
        return response;
    }

    try {
        await completeGoogleClassroomMailAuthorization({
            userCode: String(authContext.userId),
            code,
            codeVerifier: flowState.codeVerifier,
        });
        const response = buildRedirectResponse(request, flowState.returnTo, { classroomConnected: '1' });
        clearGoogleClassroomFlowCookie(response);
        return response;
    } catch (connectError) {
        console.error('[api/classroom/auth/callback] Gmail-backed Classroom callback failed:', connectError);
        const response = buildRedirectResponse(request, flowState.returnTo, { classroomError: 'connect-failed' });
        clearGoogleClassroomFlowCookie(response);
        return response;
    }
}
