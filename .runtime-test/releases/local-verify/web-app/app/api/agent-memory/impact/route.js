import { success, error, unauthorized, forbidden, validationError } from '@/lib/apiResponse';
import { requireAdminUser } from '@/lib/adminAuth.mjs';
import { analyzeImpact } from '@/lib/agentMemoryService.mjs';
import { IMPACT_TRIGGER_TYPES, sanitizePlainText } from '@/lib/agentMemoryConfig.mjs';

export const runtime = 'nodejs';

function parseImpactParams(searchParams) {
    return {
        repoName: sanitizePlainText(searchParams.get('repoName'), 120) || 'web-app',
        triggerType: sanitizePlainText(searchParams.get('triggerType'), 40),
        triggerValue: sanitizePlainText(searchParams.get('triggerValue'), 240),
        snapshotId: sanitizePlainText(searchParams.get('snapshotId'), 120) || null,
        maxDepth: searchParams.get('maxDepth'),
        limit: searchParams.get('limit'),
        notes: sanitizePlainText(searchParams.get('notes'), 4000) || null,
    };
}

function validateImpactInput({ triggerType, triggerValue }) {
    if (!IMPACT_TRIGGER_TYPES.has(triggerType)) {
        return 'triggerType must be one of: nodeKey, label, sourceFile, symbol';
    }
    if (!triggerValue) {
        return 'triggerValue is required';
    }
    return null;
}

export async function GET(request) {
    try {
        const admin = await requireAdminUser();
        if (!admin.userId) return unauthorized();
        if (!admin.allowed) return forbidden('Admin access required');

        const payload = parseImpactParams(new URL(request.url).searchParams);
        const validationMessage = validateImpactInput(payload);
        if (validationMessage) return validationError(validationMessage);

        const result = await analyzeImpact({
            ...payload,
            createdBy: admin.userId,
        });

        return success(result);
    } catch (requestError) {
        console.error('[AgentMemory] Impact lookup failed:', requestError.message);
        if (requestError.message.includes('No graph')) {
            return error(requestError.message, 404, 'GRAPH_NOT_FOUND');
        }
        if (requestError.message.includes('No graph node matched')) {
            return error(requestError.message, 404, 'NODE_NOT_FOUND');
        }
        if (requestError.message.includes('snapshotId does not belong')) {
            return validationError(requestError.message);
        }
        return error(requestError.message || 'Internal server error', 500);
    }
}


export async function POST(request) {
    try {
        const admin = await requireAdminUser();
        if (!admin.userId) return unauthorized();
        if (!admin.allowed) return forbidden('Admin access required');

        const body = await request.json();
        const triggerType = sanitizePlainText(body?.triggerType, 40);
        const triggerValue = sanitizePlainText(body?.triggerValue, 240);

        const validationMessage = validateImpactInput({ triggerType, triggerValue });
        if (validationMessage) {
            return validationError(validationMessage);
        }

        const result = await analyzeImpact({
            repoName: sanitizePlainText(body?.repoName, 120) || 'web-app',
            triggerType,
            triggerValue,
            snapshotId: sanitizePlainText(body?.snapshotId, 120) || null,
            maxDepth: body?.maxDepth,
            limit: body?.limit,
            embedding: Array.isArray(body?.embedding) ? body.embedding : null,
            notes: sanitizePlainText(body?.notes, 4000) || null,
            createdBy: admin.userId,
        });

        return success(result);
    } catch (requestError) {
        console.error('[AgentMemory] Impact analysis failed:', requestError.message);
        if (requestError.message.includes('No graph')) {
            return error(requestError.message, 404, 'GRAPH_NOT_FOUND');
        }
        if (requestError.message.includes('No graph node matched')) {
            return error(requestError.message, 404, 'NODE_NOT_FOUND');
        }
        if (requestError.message.includes('snapshotId does not belong')) {
            return validationError(requestError.message);
        }
        return error(requestError.message || 'Internal server error', 500);
    }
}
