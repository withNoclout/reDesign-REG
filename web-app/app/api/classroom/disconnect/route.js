import { error as errorResponse, success, unauthorized } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import { disconnectGoogleClassroomMail } from '@/lib/googleClassroomMailService';

export async function POST() {
    try {
        const authContext = await getAuthContext();
        if (!authContext?.userId) return unauthorized();
        return success(await disconnectGoogleClassroomMail(String(authContext.userId)));
    } catch (cause) {
        console.error('[api/classroom/disconnect] Failed to disconnect Gmail-backed Classroom:', cause);
        return errorResponse(cause.message || 'Failed to disconnect Gmail-backed Classroom', 500, 'GOOGLE_CLASSROOM_DISCONNECT_FAILED');
    }
}
