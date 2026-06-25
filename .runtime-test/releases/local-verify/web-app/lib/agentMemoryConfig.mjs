export const AGENT_MEMORY_EMBEDDING_DIMENSIONS = 384;
export const AGENT_MEMORY_EMBEDDING_MODEL = 'Supabase/gte-small';
export const AGENT_MEMORY_GRAPH_VERSION = '1';
export const AGENT_MEMORY_DEFAULT_REPO = 'web-app';
export const AGENT_MEMORY_DIRECT_LIMIT = 25;
export const AGENT_MEMORY_TRANSITIVE_LIMIT = 40;

export const IMPACT_TRIGGER_TYPES = new Set(['nodeKey', 'label', 'sourceFile', 'symbol']);

export const IMPACT_CONFIDENCE_WEIGHTS = {
    EXTRACTED: 1,
    INFERRED: 0.7,
    AMBIGUOUS: 0.35,
};

export const IMPACT_RELATION_WEIGHTS = {
    calls: 1,
    imports: 0.92,
    implements: 0.9,
    references: 0.85,
    shares_data_with: 0.82,
    cites: 0.7,
    conceptually_related_to: 0.6,
    semantically_similar_to: 0.52,
};

export function normalizeComparableUserId(value) {
    if (!value) return null;
    return String(value).trim().replace(/^s/i, '') || null;
}

export function clampPositiveInteger(value, fallback, max = fallback) {
    const numeric = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
    return Math.min(numeric, max);
}

export function sanitizePlainText(value, maxLength = 4000) {
    if (value == null) return '';
    return String(value)
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

export function toVectorLiteral(embedding, dimensions = AGENT_MEMORY_EMBEDDING_DIMENSIONS) {
    if (!Array.isArray(embedding) || embedding.length !== dimensions) {
        throw new Error(`Embedding must contain exactly ${dimensions} dimensions.`);
    }
    const normalized = embedding.map((value) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new Error('Embedding values must be finite numbers.');
        }
        return Number(value);
    });
    return `[${normalized.join(',')}]`;
}
