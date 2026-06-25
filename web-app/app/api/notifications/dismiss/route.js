import { success, unauthorized, validationError, error as errorResponse } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import { dismissUnifiedNotificationPrompt } from '@/lib/notificationCenterService';

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

        const result = await dismissUnifiedNotificationPrompt(String(authContext.userId), notificationId);
        return success(result);
    } catch (cause) {
        console.error('[api/notifications/dismiss] Failed to dismiss notification:', cause);
        return errorResponse(cause.message || 'Failed to dismiss notification', 500, 'NOTIFICATION_DISMISS_FAILED');
    }
}
