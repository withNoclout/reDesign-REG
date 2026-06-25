import { success, error, unauthorized, forbidden, validationError } from '@/lib/apiResponse';
import { requireAdminUser } from '@/lib/adminAuth.mjs';
import { applyMemoryEmbeddings, getEmbeddingBackfillBatch } from '@/lib/agentMemoryService.mjs';
import { clampPositiveInteger, sanitizePlainText } from '@/lib/agentMemoryConfig.mjs';

export const runtime = 'nodejs';

function parseKinds(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.map((entry) => sanitizePlainText(entry, 80)).filter(Boolean);
    }
    return String(value)
        .split(',')
        .map((entry) => sanitizePlainText(entry, 80))
        .filter(Boolean);
}

export async function GET(request) {
    try {
        const admin = await requireAdminUser();
        if (!admin.userId) return unauthorized();
        if (!admin.allowed) return forbidden('Admin access required');

        const { searchParams } = new URL(request.url);
        const items = await getEmbeddingBackfillBatch({
            repoName: sanitizePlainText(searchParams.get('repoName'), 120) || 'web-app',
            kinds: parseKinds(searchParams.get('kinds')),
            limit: clampPositiveInteger(searchParams.get('limit'), 20, 100),
        });

        return success({ items, count: items.length });
    } catch (requestError) {
        console.error('[AgentMemory] Embedding batch lookup failed:', requestError.message);
        return error(requestError.message || 'Internal server error', 500);
    }
}

export async function POST(request) {
    try {
        const admin = await requireAdminUser();
        if (!admin.userId) return unauthorized();
        if (!admin.allowed) return forbidden('Admin access required');

        const body = await request.json();
        if (!Array.isArray(body?.items) || body.items.length === 0) {
            return validationError('items is required and must be a non-empty array');
        }

        const result = await applyMemoryEmbeddings({
            repoName: sanitizePlainText(body?.repoName, 120) || 'web-app',
            items: body.items,
        });

        return success({
            applied: result.applied,
            missing: result.missing,
            appliedCount: result.applied.length,
            missingCount: result.missing.length,
        });
    } catch (requestError) {
        console.error('[AgentMemory] Embedding backfill failed:', requestError.message);
        return error(requestError.message || 'Internal server error', 500);
    }
}
