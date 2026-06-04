import { NextResponse } from 'next/server';
import { error, unauthorized } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import {
    applyGoogleClassroomFlowCookie,
    buildGoogleClassroomAuthorizeUrl,
    createGoogleClassroomFlow,
} from '@/lib/googleClassroom';
import { getGoogleClassroomMailConnectScopes, getGoogleClassroomMailMissingConfig, canUseGoogleClassroomMailFlow } from '@/lib/googleClassroomMailService';
import { getGoogleClassroomRolloutState } from '@/lib/googleClassroomRollout';

export async function GET(request) {
    if (!canUseGoogleClassroomMailFlow()) {
        return error(
            `Google Classroom Gmail POC is not configured: ${getGoogleClassroomMailMissingConfig().join(', ')}`,
            503,
            'GOOGLE_CLASSROOM_NOT_CONFIGURED'
        );
    }

    const authContext = await getAuthContext();
    if (!authContext?.userId) {
        return unauthorized();
    }

    const rollout = getGoogleClassroomRolloutState(String(authContext.userId));
    if (!rollout.enabled) {
        return error(
            rollout.reason === 'pilot_restricted'
                ? 'Google Classroom Gmail POC is currently limited to pilot users.'
                : 'Google Classroom Gmail POC rollout is currently disabled.',
            403,
            'GOOGLE_CLASSROOM_ROLLOUT_RESTRICTED'
        );
    }

    const returnTo = request.nextUrl.searchParams.get('returnTo');
    const flow = createGoogleClassroomFlow(authContext.userId, returnTo);
    const response = NextResponse.redirect(buildGoogleClassroomAuthorizeUrl(flow, { scopes: getGoogleClassroomMailConnectScopes() }));
    applyGoogleClassroomFlowCookie(response, flow.cookieValue);
    return response;
}
