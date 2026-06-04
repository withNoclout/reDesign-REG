import { success, unauthorized, error as errorResponse } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import { buildStudentLoanDashboard } from '@/lib/studentLoanService';

export async function GET() {
    try {
        const authContext = await getAuthContext();
        if (!authContext?.userId) {
            return unauthorized();
        }

        const dashboard = await buildStudentLoanDashboard(authContext);
        return success(dashboard);
    } catch (cause) {
        console.error('[api/student-loan/dashboard] Failed to build dashboard:', cause);
        return errorResponse('Failed to load student loan dashboard', 502, 'STUDENT_LOAN_DASHBOARD_FAILED');
    }
}
