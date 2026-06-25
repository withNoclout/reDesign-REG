import { error as errorResponse, success, unauthorized, validationError } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import {
    getGoogleClassroomMailSettingsSummary,
    saveGoogleClassroomMailSettingsSummary,
} from '@/lib/googleClassroomMailService';

function normalizeSelectedFeatures(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return {
        announcements: Boolean(value.announcements),
        coursework: Boolean(value.coursework),
        returnedWork: Boolean(value.returnedWork),
        pushSync: Boolean(value.pushSync),
    };
}

export async function GET() {
    try {
        const authContext = await getAuthContext();
        if (!authContext?.userId) return unauthorized();
        return success(await getGoogleClassroomMailSettingsSummary(String(authContext.userId)));
    } catch (cause) {
        console.error('[api/classroom/settings] Failed to load settings:', cause);
        return errorResponse(cause.message || 'Failed to load Google Classroom Gmail POC settings', 500, 'GOOGLE_CLASSROOM_SETTINGS_FAILED');
    }
}

export async function POST(request) {
    try {
        const authContext = await getAuthContext();
        if (!authContext?.userId) return unauthorized();
        const body = await request.json();
        const selectedFeatures = normalizeSelectedFeatures(body?.selectedFeatures);
        if (!selectedFeatures) return validationError('Selected features are required');
        return success(await saveGoogleClassroomMailSettingsSummary(String(authContext.userId), selectedFeatures));
    } catch (cause) {
        console.error('[api/classroom/settings] Failed to save settings:', cause);
        return errorResponse(cause.message || 'Failed to save Google Classroom Gmail POC settings', 500, 'GOOGLE_CLASSROOM_SETTINGS_SAVE_FAILED');
    }
}
