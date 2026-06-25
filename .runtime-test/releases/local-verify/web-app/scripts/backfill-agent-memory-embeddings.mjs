import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { AGENT_MEMORY_EMBEDDING_MODEL, clampPositiveInteger, sanitizePlainText } from '../lib/agentMemoryConfig.mjs';
import { getEmbeddingBackfillBatch, applyMemoryEmbeddings } from '../lib/agentMemoryService.mjs';
import { buildEmbeddingInput, buildEmbeddingRequest, parseEmbeddingResponse } from '../lib/embeddingBackfill.mjs';
import { runJobWithLock, runWithRetries } from '../lib/agentMemoryJobs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

function getFlag(name, fallback = null) {
    const index = process.argv.indexOf(`--${name}`);
    if (index === -1) return fallback;
    return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}

function getRequiredEndpoint() {
    const endpoint = sanitizePlainText(getFlag('endpoint', process.env.AGENT_MEMORY_EMBEDDING_ENDPOINT), 400);
    if (!endpoint) {
        throw new Error('Missing embedding endpoint. Set AGENT_MEMORY_EMBEDDING_ENDPOINT or pass --endpoint.');
    }
    return endpoint;
}

async function fetchEmbeddings({ endpoint, apiKey, model, items }) {
    const inputs = items.map((item) => buildEmbeddingInput(item));
    const payload = buildEmbeddingRequest({ model, inputs });
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(`Embedding provider error (${response.status}): ${JSON.stringify(json || {})}`);
    }

    return parseEmbeddingResponse(json, items.length);
}

function getRetryAttempts() {
    return Number.parseInt(String(getFlag('retry-attempts', process.env.AGENT_MEMORY_JOB_RETRY_ATTEMPTS || '3')), 10) || 3;
}

function getRetryDelayMs() {
    return Number.parseInt(String(getFlag('retry-delay-ms', process.env.AGENT_MEMORY_JOB_RETRY_DELAY_MS || '2000')), 10) || 2000;
}


async function main() {
    const repoName = sanitizePlainText(getFlag('repo', 'web-app'), 120) || 'web-app';
    const model = sanitizePlainText(getFlag('model', process.env.AGENT_MEMORY_EMBEDDING_MODEL), 120) || AGENT_MEMORY_EMBEDDING_MODEL;
    const apiKey = sanitizePlainText(getFlag('api-key', process.env.AGENT_MEMORY_EMBEDDING_API_KEY), 400) || null;
    const endpoint = getRequiredEndpoint();
    const limit = clampPositiveInteger(getFlag('limit', '100'), 100, 500);
    const batchSize = clampPositiveInteger(getFlag('batch-size', '20'), 20, 100);
    const dryRun = hasFlag('dry-run');
    const retryAttempts = getRetryAttempts();
    const retryDelayMs = getRetryDelayMs();
    const kinds = sanitizePlainText(getFlag('kinds', ''), 200)
        .split(',')
        .map((entry) => sanitizePlainText(entry, 80))
        .filter(Boolean);

    return runJobWithLock('agent-memory-embeddings', {
        repoName,
        staleMs: 2 * 60 * 60 * 1000,
        metadata: {
            repoName,
            model,
            limit,
            batchSize,
            kinds,
            dryRun,
        },
    }, async () => {
        let processed = 0;
        let applied = 0;

        while (processed < limit) {
            const remaining = Math.min(batchSize, limit - processed);
            const items = await getEmbeddingBackfillBatch({ repoName, kinds, limit: remaining });
            if (items.length === 0) break;

            if (dryRun) {
                console.log(JSON.stringify({ repoName, pending: items.length, sampleMemoryKeys: items.slice(0, 5).map((item) => item.memoryKey) }, null, 2));
                return { repoName, processed: 0, applied: 0, dryRun: true };
            }

            const embeddings = await runWithRetries(
                async () => fetchEmbeddings({ endpoint, apiKey, model, items }),
                { attempts: retryAttempts, delayMs: retryDelayMs }
            );
            const result = await runWithRetries(
                async () => applyMemoryEmbeddings({
                    repoName,
                    items: items.map((item, index) => ({
                        memoryKey: item.memoryKey,
                        model,
                        embedding: embeddings[index],
                    })),
                }),
                { attempts: retryAttempts, delayMs: retryDelayMs }
            );

            processed += items.length;
            applied += result.applied.length;
            console.log(JSON.stringify({
                batchRequested: items.length,
                applied: result.applied.length,
                missing: result.missing.length,
                processed,
            }));

            if (items.length < remaining) break;
        }

        const summary = { repoName, processed, applied, model };
        console.log(JSON.stringify(summary, null, 2));
        return summary;
    });
}

main().catch((error) => {
    console.error('Failed to backfill agent memory embeddings:', error.message);
    process.exit(1);
});
