import { success, error as errorResponse } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import { getUnifiedNotificationsFeed } from '@/lib/notificationCenterService';

export async function GET() {
    try {
        const authContext = await getAuthContext().catch(() => null);
        const feed = await getUnifiedNotificationsFeed(authContext);
        return success(feed);
    } catch (cause) {
        console.error('[api/notifications] Failed to build unified notification feed:', cause);
        return errorResponse('Failed to load notifications', 502, 'NOTIFICATION_FEED_FAILED');
    }
}
