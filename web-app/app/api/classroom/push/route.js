import { error, success, validationError } from '@/lib/apiResponse';
import { getGoogleClassroomPushConfig } from '@/lib/googleClassroom';
import { processGoogleClassroomPushEvent } from '@/lib/googleClassroomService';

function decodePubSubMessageData(value) {
    if (typeof value !== 'string' || !value.trim()) return null;

    try {
        const raw = Buffer.from(value, 'base64').toString('utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export async function POST(request) {
    const pushConfig = getGoogleClassroomPushConfig();
    const requestToken = request.nextUrl.searchParams.get('token');

    if (!pushConfig.pushToken || requestToken !== pushConfig.pushToken) {
        return error('Invalid Google Classroom push token', 403, 'GOOGLE_CLASSROOM_PUSH_FORBIDDEN');
    }

    try {
        const body = await request.json();
        const registrationId = body?.message?.attributes?.registrationId;
        const payload = decodePubSubMessageData(body?.message?.data);

        if (!registrationId) {
            return validationError('Google Classroom push message is missing registrationId');
        }

        if (!payload) {
            return validationError('Google Classroom push message payload is invalid');
        }

        const result = await processGoogleClassroomPushEvent(registrationId, payload);
        return success(result);
    } catch (cause) {
        console.error('[api/classroom/push] Failed to process push notification:', cause);
        return error('Failed to process Google Classroom push notification', 500, 'GOOGLE_CLASSROOM_PUSH_FAILED');
    }
}
