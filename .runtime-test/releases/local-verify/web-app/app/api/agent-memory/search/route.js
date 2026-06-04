import { success, error, unauthorized, forbidden, validationError } from '@/lib/apiResponse';
import { requireAdminUser } from '@/lib/adminAuth.mjs';
import { searchAgentMemory } from '@/lib/agentMemoryService.mjs';
import { clampPositiveInteger, sanitizePlainText } from '@/lib/agentMemoryConfig.mjs';
import { sanitizeSearchQuery } from '@/lib/sanitize';

export const runtime = 'nodejs';

function parseKinds(value) {
    if (!value) return [];
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
        const q = searchParams.get('q');
        const { valid, sanitized, error: validationMessage } = sanitizeSearchQuery(q, {
            minLength: 2,
            maxLength: 120,
        });
        if (!valid) return validationError(validationMessage);

        const results = await searchAgentMemory({
            repoName: sanitizePlainText(searchParams.get('repoName'), 120) || 'web-app',
            query: sanitized,
            kinds: parseKinds(searchParams.get('kinds')),
            limit: clampPositiveInteger(searchParams.get('limit'), 10, 25),
            embedding: null,
        });

        return success(results);
    } catch (requestError) {
        console.error('[AgentMemory] Search failed:', requestError.message);
        return error(requestError.message || 'Internal server error', 500);
    }
}

export async function POST(request) {
    try {
        const admin = await requireAdminUser();
        if (!admin.userId) return unauthorized();
        if (!admin.allowed) return forbidden('Admin access required');

        const body = await request.json();
        const query = sanitizePlainText(body?.query, 240);
        if (!query && !Array.isArray(body?.embedding)) {
            return validationError('query or embedding is required');
        }

        const results = await searchAgentMemory({
            repoName: sanitizePlainText(body?.repoName, 120) || 'web-app',
            query,
            kinds: Array.isArray(body?.kinds) ? body.kinds : [],
            limit: clampPositiveInteger(body?.limit, 10, 25),
            embedding: Array.isArray(body?.embedding) ? body.embedding : null,
        });

        return success(results);
    } catch (requestError) {
        console.error('[AgentMemory] Semantic search failed:', requestError.message);
        return error(requestError.message || 'Internal server error', 500);
    }
}
