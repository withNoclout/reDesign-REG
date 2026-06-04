import { error, success, unauthorized, validationError } from '@/lib/apiResponse';
import {
    STUDENT_LOAN_PILOT_CLOSING_PREVIEW_NOW,
    STUDENT_LOAN_PILOT_OPEN_PREVIEW_NOW,
    syncStudentLoanCentralState,
} from '@/lib/studentLoanCentralService';

function readSyncSecret(request) {
    const bearer = request.headers.get('authorization');
    if (typeof bearer === 'string' && bearer.startsWith('Bearer ')) {
        return bearer.slice('Bearer '.length).trim();
    }

    return request.headers.get('x-student-loan-sync-secret')?.trim() || '';
}

function resolvePilotPreviewNow(body) {
    const explicit = typeof body?.pilotPreviewNow === 'string' ? body.pilotPreviewNow.trim() : '';
    if (explicit) return explicit;

    if (body?.pilotPreviewPhase === 'closingSoon') {
        return STUDENT_LOAN_PILOT_CLOSING_PREVIEW_NOW;
    }

    return STUDENT_LOAN_PILOT_OPEN_PREVIEW_NOW;
}

export async function POST(request) {
    const expectedSecret = process.env.STUDENT_LOAN_SYNC_SECRET;
    if (!expectedSecret) {
        return error('STUDENT_LOAN_SYNC_SECRET is not configured', 500, 'STUDENT_LOAN_SYNC_SECRET_MISSING');
    }

    const providedSecret = readSyncSecret(request);
    if (!providedSecret || providedSecret !== expectedSecret) {
        return unauthorized('Invalid student loan sync secret');
    }

    try {
        const body = await request.json().catch(() => ({}));
        const userCodes = Array.isArray(body?.userCodes)
            ? body.userCodes.map((value) => String(value).trim()).filter(Boolean)
            : null;
        const pilotMode = body?.pilotMode === 'live' ? 'live' : 'preview';
        const pilotPreviewNow = resolvePilotPreviewNow(body);

        if (pilotMode === 'preview' && Number.isNaN(new Date(pilotPreviewNow).getTime())) {
            return validationError('pilotPreviewNow must be a valid ISO date when pilotMode is preview');
        }

        const result = await syncStudentLoanCentralState({
            seedPilot: body?.seedPilot !== false,
            pilotMode,
            pilotPreviewNow,
            userCodes,
            resetNotificationState: body?.resetNotificationState === true,
        });

        return success({
            ...result,
            pilotMode,
            pilotPreviewNow: pilotMode === 'preview' ? pilotPreviewNow : null,
            userCodes,
        });
    } catch (cause) {
        console.error('[api/student-loan/admin/sync] Failed to sync student loan state:', cause);
        return error('Failed to sync student loan state', 500, 'STUDENT_LOAN_SYNC_FAILED');
    }
}
