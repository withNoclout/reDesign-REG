import { success, unauthorized, error as errorResponse } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import { buildStudentLoanNotificationFeed } from '@/lib/studentLoanService';

export async function GET() {
    try {
        const authContext = await getAuthContext();
        if (!authContext?.userId) {
            return unauthorized();
        }

        const feed = await buildStudentLoanNotificationFeed(authContext);
        return success(feed);
    } catch (cause) {
        console.error('[api/student-loan/notifications] Failed to load notifications:', cause);
        return errorResponse('Failed to load student loan notifications', 502, 'STUDENT_LOAN_NOTIFICATIONS_FAILED');
    }
}
