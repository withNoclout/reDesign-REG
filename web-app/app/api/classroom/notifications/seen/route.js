import { error as errorResponse, success, unauthorized, validationError } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import { markGoogleClassroomMailNotificationsSeenForUser } from '@/lib/googleClassroomMailService';

const NOTIFICATION_ID_PATTERN = /^[A-Za-z0-9:._-]{1,250}$/;

function sanitizeNotificationIds(value) {
    const source = Array.isArray(value) ? value : (typeof value === 'string' && value.trim() ? [value] : []);
    return Array.from(new Set(source
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item && NOTIFICATION_ID_PATTERN.test(item)))).slice(0, 50);
}

export async function POST(request) {
    try {
        const authContext = await getAuthContext();
        if (!authContext?.userId) return unauthorized();
        const body = await request.json();
        const notificationIds = sanitizeNotificationIds(body?.notificationIds || body?.notificationId);
        if (notificationIds.length === 0) return validationError('At least one valid notification ID is required');
        const result = await markGoogleClassroomMailNotificationsSeenForUser(String(authContext.userId), notificationIds);
        return success({ notificationIds, unreadCount: result.unreadCount });
    } catch (cause) {
        console.error('[api/classroom/notifications/seen] Failed to mark Gmail-backed Classroom notifications as seen:', cause);
        return errorResponse(cause.message || 'Failed to update Gmail-backed Classroom notifications', 500, 'GOOGLE_CLASSROOM_NOTIFICATIONS_SEEN_FAILED');
    }
}
