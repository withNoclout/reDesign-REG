import fs from 'fs/promises';
import path from 'path';

import { clampPositiveInteger, sanitizePlainText } from './agentMemoryConfig.mjs';
import { analyzeGraphNeighborhood, buildBlastRadiusReport, buildSuggestedTests, pickSeedNodes } from './impactAnalysis.mjs';
import {
    findGraphNodes,
    findRelatedMemoryByNodeRefs,
    getGraphSnapshotById,
    countMemoryItemsWithoutEmbeddings,
    getLatestGraphSnapshot,
    listMemoryItemsWithoutEmbeddings,
    loadSnapshotGraph,
    recordFixOutcome,
    recordImpactAssessment,
    replaceGraphSnapshot,
    searchMemoryItems,
    upsertMemoryEmbeddings,
} from './agentMemoryStore.mjs';
import { readJobStatus } from './agentMemoryJobs.mjs';

async function collectTestFiles(rootDir) {
    const candidateDirectories = ['scripts'];
    const results = [];

    for (const relativeDir of candidateDirectories) {
        const absoluteDir = path.join(rootDir, relativeDir);
        let entries = [];
        try {
            entries = await fs.readdir(absoluteDir, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            if (entry.isFile() && /^test-.*\.(c?js|mjs)$/.test(entry.name)) {
                results.push(`${relativeDir}/${entry.name}`);
            }
        }
    }

    try {
        const rootEntries = await fs.readdir(rootDir, { withFileTypes: true });
        for (const entry of rootEntries) {
            if (entry.isFile() && /^test.*\.(c?js|mjs)$/.test(entry.name)) {
                results.push(entry.name);
            }
        }
    } catch {
        return results;
    }

    return results;
}

function dedupeById(items) {
    const seen = new Set();
    return items.filter((item) => {
        const key = item.id || item.nodeRef || item.memoryKey || JSON.stringify(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export async function ingestGraphSnapshot(payload) {
    return replaceGraphSnapshot(payload);
}

export async function analyzeImpact({
    repoName,
    triggerType,
    triggerValue,
    snapshotId = null,
    maxDepth = 2,
    limit = 10,
    embedding = null,
    notes = null,
    createdBy = null,
}) {
    const requestedRepoName = sanitizePlainText(repoName, 120) || 'web-app';
    const snapshot = snapshotId
        ? await getGraphSnapshotById(snapshotId)
        : await getLatestGraphSnapshot(requestedRepoName);
    if (!snapshot?.id) {
        throw new Error('No graph snapshot is available for impact analysis.');
    }
    if (snapshotId && requestedRepoName && snapshot.repoName !== requestedRepoName) {
        throw new Error('snapshotId does not belong to the requested repo.');
    }

    const candidates = await findGraphNodes({
        snapshotId: snapshot.id,
        triggerType,
        triggerValue,
        limit: clampPositiveInteger(limit, 5, 25),
    });
    if (candidates.length === 0) {
        throw new Error('No graph node matched the requested trigger.');
    }

    const graph = await loadSnapshotGraph(snapshot.id);
    const pickedSeeds = pickSeedNodes({
        nodes: graph.nodes,
        triggerType,
        triggerValue,
    });
    const seedNodes = pickedSeeds.length > 0 ? pickedSeeds : candidates;
    const seedNodeRefs = seedNodes.map((node) => node.nodeRef);

    const neighborhood = analyzeGraphNeighborhood({
        nodes: graph.nodes,
        edges: graph.edges,
        seedNodeRefs,
        maxDepth: clampPositiveInteger(maxDepth, 2, 4),
    });

    const relatedNodeRefs = dedupeById([
        ...seedNodes,
        ...neighborhood.directImpact,
        ...neighborhood.transitiveImpact,
    ]).map((item) => item.nodeRef);

    const [relationMemories, semanticMemories, availableTests] = await Promise.all([
        findRelatedMemoryByNodeRefs({
            repoName: snapshot.repoName,
            sourceNodeRefs: relatedNodeRefs,
            limit: 12,
        }),
        searchMemoryItems({
            repoName: snapshot.repoName,
            query: triggerValue,
            embedding,
            limit: 8,
        }),
        collectTestFiles(process.cwd()),
    ]);

    const relatedMemories = dedupeById([...relationMemories, ...semanticMemories]);
    const historicalRisk = relatedMemories
        .filter((item) => ['fixSummary', 'dependencyRisk', 'incident', 'graphReportSection'].includes(item.kind))
        .slice(0, 8);

    const recommendedTests = buildSuggestedTests({
        impactedNodes: [...seedNodes, ...neighborhood.directImpact, ...neighborhood.transitiveImpact],
        availableTests,
        triggerValue,
    });

    const blastRadiusReport = buildBlastRadiusReport({
        triggerValue,
        seedNodes,
        directImpact: neighborhood.directImpact,
        transitiveImpact: neighborhood.transitiveImpact,
        relatedMemories,
        historicalRisk,
        recommendedTests,
        riskScore: neighborhood.riskScore,
    });

    const assessment = await recordImpactAssessment({
        repoName: snapshot.repoName,
        snapshotId: snapshot.id,
        triggerType,
        triggerValue,
        directImpact: neighborhood.directImpact,
        transitiveImpact: neighborhood.transitiveImpact,
        historicalRisk,
        relatedMemories,
        recommendedTests,
        riskScore: neighborhood.riskScore,
        notes,
        createdBy,
    });

    return {
        snapshot,
        candidateMatches: candidates,
        seedNodes,
        directImpact: neighborhood.directImpact,
        transitiveImpact: neighborhood.transitiveImpact,
        relatedMemories,
        historicalRisk,
        recommendedTests,
        riskScore: neighborhood.riskScore,
        blastRadiusReport,
        assessment,
    };
}

export async function searchAgentMemory({ repoName, query, kinds, limit, embedding }) {
    return searchMemoryItems({ repoName, query, kinds, limit, embedding });
}

export async function storeFixOutcome(payload) {
    return recordFixOutcome(payload);
}

export async function getEmbeddingBackfillBatch({ repoName, kinds, limit }) {
    return listMemoryItemsWithoutEmbeddings({
        repoName,
        kinds,
        limit: clampPositiveInteger(limit, 20, 100),
    });
}

export async function applyMemoryEmbeddings({ repoName, items }) {
    return upsertMemoryEmbeddings({ repoName, items });
}

export async function getAgentMemoryDashboard({ repoName = 'web-app' } = {}) {
    const cleanRepoName = sanitizePlainText(repoName, 120) || 'web-app';
    const [refreshJob, embeddingsJob, latestSnapshot, pendingEmbeddings] = await Promise.all([
        readJobStatus('graphify-refresh'),
        readJobStatus('agent-memory-embeddings'),
        getLatestGraphSnapshot(cleanRepoName),
        countMemoryItemsWithoutEmbeddings({ repoName: cleanRepoName }),
    ]);

    return {
        repoName: cleanRepoName,
        jobs: {
            refresh: refreshJob,
            embeddings: embeddingsJob,
        },
        graph: {
            latestSnapshot,
        },
        memory: {
            pendingEmbeddings,
        },
        generatedAt: new Date().toISOString(),
    };
}
