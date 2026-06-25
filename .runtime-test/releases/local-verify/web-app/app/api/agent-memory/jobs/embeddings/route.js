import { success, error, unauthorized, forbidden, validationError } from '@/lib/apiResponse';
import { requireAdminUser } from '@/lib/adminAuth.mjs';
import { readJobStatus, spawnDetachedNodeJob } from '@/lib/agentMemoryJobs.mjs';
import { sanitizePlainText } from '@/lib/agentMemoryConfig.mjs';

export const runtime = 'nodejs';

function parseArgs(body) {
    const args = [];
    const repoName = sanitizePlainText(body?.repoName, 120);
    const model = sanitizePlainText(body?.model, 120);
    const endpoint = sanitizePlainText(body?.endpoint, 400);
    const limit = sanitizePlainText(body?.limit, 20);
    const batchSize = sanitizePlainText(body?.batchSize, 20);
    const kinds = Array.isArray(body?.kinds)
        ? body.kinds.map((entry) => sanitizePlainText(entry, 80)).filter(Boolean).join(',')
        : sanitizePlainText(body?.kinds, 200);

    if (repoName) args.push('--repo', repoName);
    if (model) args.push('--model', model);
    if (endpoint) args.push('--endpoint', endpoint);
    if (limit) args.push('--limit', limit);
    if (batchSize) args.push('--batch-size', batchSize);
    if (kinds) args.push('--kinds', kinds);
    if (body?.dryRun) args.push('--dry-run');
    return args;
}

function buildMetadata(body, adminUserId) {
    const repoName = sanitizePlainText(body?.repoName, 120) || 'web-app';
    const kinds = Array.isArray(body?.kinds)
        ? body.kinds.map((entry) => sanitizePlainText(entry, 80)).filter(Boolean)
        : String(sanitizePlainText(body?.kinds, 200) || '')
            .split(',')
            .map((entry) => sanitizePlainText(entry, 80))
            .filter(Boolean);

    return {
        repoName,
        requestedBy: adminUserId,
        model: sanitizePlainText(body?.model, 120) || sanitizePlainText(process.env.AGENT_MEMORY_EMBEDDING_MODEL, 120) || null,
        limit: sanitizePlainText(body?.limit, 20) || null,
        batchSize: sanitizePlainText(body?.batchSize, 20) || null,
        dryRun: Boolean(body?.dryRun),
        kinds,
    };
}


export async function GET() {
    try {
        const admin = await requireAdminUser();
        if (!admin.userId) return unauthorized();
        if (!admin.allowed) return forbidden('Admin access required');

        const status = await readJobStatus('agent-memory-embeddings');
        return success(status);
    } catch (requestError) {
        console.error('[AgentMemory] Embedding job status failed:', requestError.message);
        return error(requestError.message || 'Internal server error', 500);
    }
}

export async function POST(request) {
    try {
        const admin = await requireAdminUser();
        if (!admin.userId) return unauthorized();
        if (!admin.allowed) return forbidden('Admin access required');

        const body = await request.json().catch(() => ({}));
        const endpoint = sanitizePlainText(body?.endpoint, 400) || sanitizePlainText(process.env.AGENT_MEMORY_EMBEDDING_ENDPOINT, 400);
        if (!endpoint) {
            return validationError('Embedding endpoint is required. Set AGENT_MEMORY_EMBEDDING_ENDPOINT or pass endpoint.');
        }

        const metadata = buildMetadata(body, admin.userId);
        const job = await spawnDetachedNodeJob({
            jobName: 'agent-memory-embeddings',
            scriptRelativePath: 'scripts/backfill-agent-memory-embeddings.mjs',
            args: parseArgs(body),
            repoName: metadata.repoName,
            staleMs: Number.parseInt(String(body?.staleMs ?? ''), 10) || undefined,
            metadata,
            env: {
                ...(endpoint ? { AGENT_MEMORY_EMBEDDING_ENDPOINT: endpoint } : {}),
                ...(body?.apiKey ? { AGENT_MEMORY_EMBEDDING_API_KEY: String(body.apiKey) } : {}),
            },
        });

        return success(job, 202);
    } catch (requestError) {
        console.error('[AgentMemory] Embedding trigger failed:', requestError.message);
        if (requestError.code === 'JOB_LOCKED') {
            return error(requestError.message, 409, 'JOB_LOCKED');
        }
        return error(requestError.message || 'Internal server error', 500);
    }
}
