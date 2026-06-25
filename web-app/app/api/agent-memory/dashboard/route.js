import { success, error, unauthorized, forbidden } from '@/lib/apiResponse';
import { requireAdminUser } from '@/lib/adminAuth.mjs';
import { getAgentMemoryDashboard } from '@/lib/agentMemoryService.mjs';
import { sanitizePlainText } from '@/lib/agentMemoryConfig.mjs';

export const runtime = 'nodejs';

export async function GET(request) {
    try {
        const admin = await requireAdminUser();
        if (!admin.userId) return unauthorized();
        if (!admin.allowed) return forbidden('Admin access required');

        const { searchParams } = new URL(request.url);
        const result = await getAgentMemoryDashboard({
            repoName: sanitizePlainText(searchParams.get('repoName'), 120) || 'web-app',
        });

        return success(result);
    } catch (requestError) {
        console.error('[AgentMemory] Dashboard lookup failed:', requestError.message);
        return error(requestError.message || 'Internal server error', 500);
    }
}
