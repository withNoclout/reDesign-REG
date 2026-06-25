import { error as errorResponse, success, unauthorized } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import { getGoogleClassroomMailSettingsSummary, syncGoogleClassroomMailNotifications } from '@/lib/googleClassroomMailService';

export async function POST() {
    try {
        const authContext = await getAuthContext();
        if (!authContext?.userId) return unauthorized();
        await syncGoogleClassroomMailNotifications(String(authContext.userId), { force: true });
        return success(await getGoogleClassroomMailSettingsSummary(String(authContext.userId)));
    } catch (cause) {
        console.error('[api/classroom/sync] Failed to sync Gmail-backed Classroom:', cause);
        return errorResponse(cause.message || 'Failed to sync Gmail-backed Classroom notifications', 500, 'GOOGLE_CLASSROOM_SYNC_FAILED');
    }
}
