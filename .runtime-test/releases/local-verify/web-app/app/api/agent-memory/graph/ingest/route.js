import { success, error, unauthorized, forbidden, validationError } from '@/lib/apiResponse';
import { requireAdminUser } from '@/lib/adminAuth.mjs';
import { ingestGraphSnapshot } from '@/lib/agentMemoryService.mjs';
import { sanitizePlainText } from '@/lib/agentMemoryConfig.mjs';

export const runtime = 'nodejs';

export async function POST(request) {
    try {
        const admin = await requireAdminUser();
        if (!admin.userId) return unauthorized();
        if (!admin.allowed) return forbidden('Admin access required');

        const body = await request.json();
        if (!body?.graph || !Array.isArray(body.graph.nodes) || !Array.isArray(body.graph.edges)) {
            return validationError('graph.nodes and graph.edges are required');
        }

        const commitSha = sanitizePlainText(body.commitSha, 120);
        if (!commitSha) return validationError('commitSha is required');

        const result = await ingestGraphSnapshot({
            repoName: sanitizePlainText(body.repoName, 120) || 'web-app',
            branchName: sanitizePlainText(body.branchName, 120) || null,
            commitSha,
            graphVersion: sanitizePlainText(body.graphVersion, 40) || '1',
            sourceScope: Array.isArray(body.sourceScope) ? body.sourceScope : [],
            graphJsonPath: sanitizePlainText(body.graphJsonPath, 260) || null,
            reportPath: sanitizePlainText(body.reportPath, 260) || null,
            createdBy: sanitizePlainText(body.createdBy, 120) || admin.userId,
            graph: body.graph,
            reportMarkdown: typeof body.reportMarkdown === 'string' ? body.reportMarkdown : '',
            memoryEmbeddings: Array.isArray(body.memoryEmbeddings) ? body.memoryEmbeddings : [],
        });

        return success(result, 201);
    } catch (requestError) {
        console.error('[AgentMemory] Graph ingest failed:', requestError.message);
        return error(requestError.message || 'Internal server error', 500);
    }
}
