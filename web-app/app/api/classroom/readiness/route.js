import { success, unauthorized, error as errorResponse } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import { evaluateGoogleClassroomReadiness } from '@/lib/googleClassroomReadiness';

export async function GET() {
    try {
        const authContext = await getAuthContext();
        if (!authContext?.userId) {
            return unauthorized();
        }

        const readiness = await evaluateGoogleClassroomReadiness(String(authContext.userId));
        return success(readiness);
    } catch (cause) {
        console.error('[api/classroom/readiness] Failed to evaluate readiness:', cause);
        return errorResponse(cause.message || 'Failed to evaluate Google Classroom readiness', 500, 'GOOGLE_CLASSROOM_READINESS_FAILED');
    }
}
