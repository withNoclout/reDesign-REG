import { success, unauthorized, validationError, error as errorResponse } from '@/lib/apiResponse';
import { getAuthContext } from '@/lib/auth';
import { saveStudentLoanProfile } from '@/lib/studentLoanCentralService';

const BORROWER_TYPES = new Set(['new', 'continuing']);
const EDUCATION_LEVELS = new Set(['vocational', 'bachelor']);

export async function POST(request) {
    try {
        const authContext = await getAuthContext();
        if (!authContext?.userId) {
            return unauthorized();
        }

        const body = await request.json();
        const borrowerType = typeof body?.borrowerType === 'string' ? body.borrowerType : null;
        const educationLevel = typeof body?.educationLevel === 'string' ? body.educationLevel : null;

        if (!BORROWER_TYPES.has(borrowerType) || !EDUCATION_LEVELS.has(educationLevel)) {
            return validationError('Borrower type and education level are required');
        }

        const profile = await saveStudentLoanProfile(String(authContext.userId), {
            borrowerType,
            educationLevel,
            source: 'manual',
        });

        return success({ profile });
    } catch (cause) {
        console.error('[api/student-loan/profile] Failed to save profile:', cause);
        return errorResponse('Failed to save student loan profile', 500, 'STUDENT_LOAN_PROFILE_SAVE_FAILED');
    }
}
