import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { clearStudentEvaluationCache, getStudentEvaluationList } from '@/lib/studentEvaluationService';

export function clearEvalCache(userId) {
    clearStudentEvaluationCache(userId);
}

export async function GET() {
    try {
        const authContext = await getAuthContext();
        if (!authContext) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const evaluations = await getStudentEvaluationList(authContext);
        const response = NextResponse.json({ success: true, data: evaluations });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        return response;
    } catch (error) {
        console.error('[Evaluation API Error]:', error.message);
        const status = Number.isInteger(error?.status) ? error.status : 500;
        const message = status === 500 ? 'Internal Server Error' : 'Failed to fetch evaluation list';
        return NextResponse.json({ success: false, message }, { status });
    }
}
