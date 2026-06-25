import { success, unauthorized, validationError, error as errorResponse } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import { acknowledgeStudentLoanNotificationClick } from '@/lib/studentLoanCentralService';

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

        const result = await acknowledgeStudentLoanNotificationClick(String(authContext.userId), notificationId);
        return success({ notificationId, ...result });
    } catch (cause) {
        console.error('[api/student-loan/notifications/click] Failed to record click:', cause);
        return errorResponse('Failed to record notification click', 500, 'STUDENT_LOAN_NOTIFICATION_CLICK_FAILED');
    }
}
