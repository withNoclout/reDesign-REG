import { success, error, unauthorized, forbidden, validationError } from '@/lib/apiResponse';
import { requireAdminUser } from '@/lib/adminAuth.mjs';
import { storeFixOutcome } from '@/lib/agentMemoryService.mjs';
import { sanitizePlainText } from '@/lib/agentMemoryConfig.mjs';

export const runtime = 'nodejs';

export async function POST(request) {
    try {
        const admin = await requireAdminUser();
        if (!admin.userId) return unauthorized();
        if (!admin.allowed) return forbidden('Admin access required');

        const body = await request.json();
        const finalResolution = sanitizePlainText(body?.finalResolution, 4000);
        if (!finalResolution) return validationError('finalResolution is required');

        const result = await storeFixOutcome({
            assessmentId: sanitizePlainText(body?.assessmentId, 120) || null,
            repoName: sanitizePlainText(body?.repoName, 120) || 'web-app',
            commitSha: sanitizePlainText(body?.commitSha, 120) || null,
            changedFiles: Array.isArray(body?.changedFiles) ? body.changedFiles : [],
            testsRun: Array.isArray(body?.testsRun) ? body.testsRun : [],
            failuresFound: Array.isArray(body?.failuresFound) ? body.failuresFound : [],
            finalResolution,
            createdBy: admin.userId,
        });

        return success(result, 201);
    } catch (requestError) {
        console.error('[AgentMemory] Fix outcome failed:', requestError.message);
        return error(requestError.message || 'Internal server error', 500);
    }
}
