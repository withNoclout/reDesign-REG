import { success, unauthorized, validationError, error as errorResponse } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import { markUnifiedNotificationsSeen } from '@/lib/notificationCenterService';

export async function POST(request) {
    try {
        const authContext = await getAuthContext();
        if (!authContext?.userId) {
            return unauthorized();
        }

        const body = await request.json();
        const notificationIds = Array.isArray(body?.notificationIds)
            ? body.notificationIds.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
            : (typeof body?.notificationId === 'string' && body.notificationId.trim() ? [body.notificationId.trim()] : []);

        if (notificationIds.length === 0) {
            return validationError('At least one notification ID is required');
        }

        const result = await markUnifiedNotificationsSeen(String(authContext.userId), notificationIds);
        return success(result);
    } catch (cause) {
        console.error('[api/notifications/seen] Failed to mark notifications as seen:', cause);
        return errorResponse(cause.message || 'Failed to update notifications', 500, 'NOTIFICATION_SEEN_FAILED');
    }
}
