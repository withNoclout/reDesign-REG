import { success, unauthorized, validationError, error as errorResponse } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import { actOnUnifiedNotification } from '@/lib/notificationCenterService';

export async function POST(request) {
    try {
        const authContext = await getAuthContext();
        if (!authContext?.userId) {
            return unauthorized();
        }

        const body = await request.json();
        const notificationId = typeof body?.notificationId === 'string' ? body.notificationId.trim() : '';
        if (!notificationId) {
            return validationError('Notification ID is required');
        }

        const result = await actOnUnifiedNotification(String(authContext.userId), notificationId);
        return success({ notificationId, ...result });
    } catch (cause) {
        console.error('[api/notifications/act] Failed to process notification action:', cause);
        return errorResponse(cause.message || 'Failed to process notification action', 500, 'NOTIFICATION_ACTION_FAILED');
    }
}
