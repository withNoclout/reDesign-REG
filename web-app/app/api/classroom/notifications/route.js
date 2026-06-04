import { error as errorResponse, success } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import { canUseGoogleClassroomMailFlow, getGoogleClassroomMailNotificationFeed } from '@/lib/googleClassroomMailService';

export async function GET(request) {
    try {
        const authContext = await getAuthContext();
        if (!authContext?.userId) {
            return success({
                configured: canUseGoogleClassroomMailFlow(),
                connected: false,
                reconnectRequired: false,
                authRequired: true,
                userCode: null,
                notifications: [],
                unreadCount: 0,
                lastSyncedAt: null,
                lastSyncError: null,
                mode: 'gmail-poc',
            });
        }

        const force = request.nextUrl.searchParams.get('force') === '1';
        const feed = await getGoogleClassroomMailNotificationFeed(String(authContext.userId), { force, limit: 20 });
        return success({ ...feed, authRequired: false, userCode: String(authContext.userId) });
    } catch (cause) {
        console.error('[api/classroom/notifications] Failed to load Gmail-backed Classroom notifications:', cause);
        return errorResponse(cause.message || 'Failed to load Gmail-backed Classroom notifications', 502, 'GOOGLE_CLASSROOM_NOTIFICATIONS_FAILED');
    }
}
