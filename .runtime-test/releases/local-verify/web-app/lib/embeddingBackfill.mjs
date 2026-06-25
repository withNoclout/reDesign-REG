import { AGENT_MEMORY_EMBEDDING_MODEL, sanitizePlainText } from './agentMemoryConfig.mjs';

export function buildEmbeddingInput(item) {
    const title = sanitizePlainText(item?.title, 240);
    const content = sanitizePlainText(item?.content, 6000);
    const scope = sanitizePlainText(item?.scope, 40);
    const kind = sanitizePlainText(item?.kind, 80);

    return [
        title ? `Title: ${title}` : null,
        kind ? `Kind: ${kind}` : null,
        scope ? `Scope: ${scope}` : null,
        content ? `Content: ${content}` : null,
    ].filter(Boolean).join('\n');
}

export function buildEmbeddingRequest({ model = AGENT_MEMORY_EMBEDDING_MODEL, inputs }) {
    const sanitizedInputs = Array.isArray(inputs)
        ? inputs.map((input) => sanitizePlainText(input, 7000)).filter(Boolean)
        : [];
    if (sanitizedInputs.length === 0) {
        throw new Error('At least one embedding input is required.');
    }

    return {
        model: sanitizePlainText(model, 120) || AGENT_MEMORY_EMBEDDING_MODEL,
        input: sanitizedInputs,
        encoding_format: 'float',
    };
}

export function parseEmbeddingResponse(payload, expectedCount) {
    const data = Array.isArray(payload?.data) ? payload.data : null;
    if (!data) {
        throw new Error('Embedding response must contain a data array.');
    }
    if (typeof expectedCount === 'number' && data.length !== expectedCount) {
        throw new Error(`Expected ${expectedCount} embeddings, received ${data.length}.`);
    }

    const expectedSize = typeof expectedCount === 'number' ? expectedCount : data.length;
    const vectors = new Array(expectedSize);

    data.forEach((entry, fallbackIndex) => {
        const index = Number.isInteger(entry?.index) ? entry.index : fallbackIndex;
        if (index < 0 || index >= expectedSize) {
            throw new Error(`Embedding index ${index} is out of range.`);
        }
        if (vectors[index]) {
            throw new Error(`Duplicate embedding index ${index} in provider response.`);
        }
        if (!Array.isArray(entry?.embedding) || entry.embedding.length === 0) {
            throw new Error(`Embedding at index ${index} is missing or empty.`);
        }

        vectors[index] = entry.embedding.map((value) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) {
                throw new Error(`Embedding at index ${index} contains a non-numeric value.`);
            }
            return numeric;
        });
    });

    if (vectors.some((vector) => !Array.isArray(vector))) {
        throw new Error('Embedding response is missing one or more indices.');
    }

    return vectors;
}
