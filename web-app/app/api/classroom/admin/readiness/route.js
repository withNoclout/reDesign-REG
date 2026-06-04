import { success, unauthorized, forbidden, validationError, error as errorResponse } from '@/lib/apiResponse';
import { requireAdminUser } from '@/lib/adminAuth.mjs';
import { evaluateGoogleClassroomReadiness } from '@/lib/googleClassroomReadiness';

export async function GET(request) {
    try {
        const admin = await requireAdminUser();
        if (!admin.userId) return unauthorized();
        if (!admin.allowed) return forbidden('Admin access required');

        const userCode = request.nextUrl.searchParams.get('userCode')?.trim();
        if (!userCode) {
            return validationError('userCode is required');
        }

        const readiness = await evaluateGoogleClassroomReadiness(userCode);
        return success(readiness);
    } catch (cause) {
        console.error('[api/classroom/admin/readiness] Failed to evaluate readiness:', cause);
        return errorResponse(cause.message || 'Failed to evaluate Google Classroom readiness', 500, 'GOOGLE_CLASSROOM_ADMIN_READINESS_FAILED');
    }
}
