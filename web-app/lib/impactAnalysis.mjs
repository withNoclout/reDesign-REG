import {
    AGENT_MEMORY_DIRECT_LIMIT,
    AGENT_MEMORY_TRANSITIVE_LIMIT,
    IMPACT_CONFIDENCE_WEIGHTS,
    IMPACT_RELATION_WEIGHTS,
    sanitizePlainText,
} from './agentMemoryConfig.mjs';

function getRelationWeight(relation) {
    return IMPACT_RELATION_WEIGHTS[relation] ?? 0.55;
}

function getConfidenceWeight(confidence) {
    return IMPACT_CONFIDENCE_WEIGHTS[confidence] ?? 0.6;
}

export function analyzeGraphNeighborhood({
    nodes,
    edges,
    seedNodeRefs,
    maxDepth = 2,
    directLimit = AGENT_MEMORY_DIRECT_LIMIT,
    transitiveLimit = AGENT_MEMORY_TRANSITIVE_LIMIT,
}) {
    const nodeMap = new Map((nodes || []).map((node) => [node.nodeRef, node]));
    const adjacency = new Map();

    for (const edge of edges || []) {
        const forward = {
            neighborRef: edge.targetNodeRef,
            relation: edge.relation,
            confidence: edge.confidence,
            confidenceScore: Number(edge.confidenceScore ?? 0.7),
            weight: Number(edge.weight ?? 1),
            direction: 'outgoing',
            sourceNodeRef: edge.sourceNodeRef,
            targetNodeRef: edge.targetNodeRef,
        };
        const reverse = {
            neighborRef: edge.sourceNodeRef,
            relation: edge.relation,
            confidence: edge.confidence,
            confidenceScore: Number(edge.confidenceScore ?? 0.7),
            weight: Number(edge.weight ?? 1),
            direction: 'incoming',
            sourceNodeRef: edge.sourceNodeRef,
            targetNodeRef: edge.targetNodeRef,
        };

        const outgoing = adjacency.get(edge.sourceNodeRef) || [];
        outgoing.push(forward);
        adjacency.set(edge.sourceNodeRef, outgoing);

        const incoming = adjacency.get(edge.targetNodeRef) || [];
        incoming.push(reverse);
        adjacency.set(edge.targetNodeRef, incoming);
    }

    const queue = [];
    const visited = new Map();
    const impacts = new Map();

    for (const seedNodeRef of seedNodeRefs || []) {
        if (!nodeMap.has(seedNodeRef)) continue;
        visited.set(seedNodeRef, 0);
        queue.push({ nodeRef: seedNodeRef, depth: 0 });
    }

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || current.depth >= maxDepth) continue;

        for (const edge of adjacency.get(current.nodeRef) || []) {
            if (!nodeMap.has(edge.neighborRef)) continue;
            const nextDepth = current.depth + 1;
            const bestDepth = visited.get(edge.neighborRef);
            if (bestDepth != null && bestDepth < nextDepth) continue;
            visited.set(edge.neighborRef, nextDepth);
            queue.push({ nodeRef: edge.neighborRef, depth: nextDepth });

            const score = Number(
                ((getRelationWeight(edge.relation) * getConfidenceWeight(edge.confidence) * edge.confidenceScore * edge.weight) / nextDepth)
                    .toFixed(4)
            );
            const existing = impacts.get(edge.neighborRef);
            if (!existing || existing.score < score) {
                impacts.set(edge.neighborRef, {
                    nodeRef: edge.neighborRef,
                    depth: nextDepth,
                    score,
                    via: {
                        relation: edge.relation,
                        confidence: edge.confidence,
                        sourceNodeRef: edge.sourceNodeRef,
                        targetNodeRef: edge.targetNodeRef,
                        direction: edge.direction,
                    },
                });
            }
        }
    }

    const directImpact = [];
    const transitiveImpact = [];

    for (const impact of impacts.values()) {
        if ((seedNodeRefs || []).includes(impact.nodeRef)) continue;
        const node = nodeMap.get(impact.nodeRef);
        if (!node) continue;
        const entry = {
            nodeRef: impact.nodeRef,
            label: node.label,
            nodeType: node.nodeType,
            sourceFile: node.sourceFile,
            sourceLocation: node.sourceLocation,
            summary: node.summary,
            depth: impact.depth,
            score: impact.score,
            via: impact.via,
        };
        if (impact.depth === 1) {
            directImpact.push(entry);
        } else {
            transitiveImpact.push(entry);
        }
    }

    directImpact.sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));
    transitiveImpact.sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));

    const riskScore = Number(
        Math.min(
            1,
            directImpact.slice(0, 10).reduce((sum, item) => sum + item.score, 0) * 0.08 +
                transitiveImpact.slice(0, 20).reduce((sum, item) => sum + item.score, 0) * 0.03
        ).toFixed(4)
    );

    return {
        directImpact: directImpact.slice(0, directLimit),
        transitiveImpact: transitiveImpact.slice(0, transitiveLimit),
        riskScore,
    };
}

export function pickSeedNodes({ nodes, triggerType, triggerValue }) {
    const query = sanitizePlainText(triggerValue, 240).toLowerCase();
    if (!query) return [];
    const normalizedNodes = nodes || [];

    const exact = normalizedNodes.filter((node) => {
        if (triggerType === 'nodeKey') return node.nodeKey.toLowerCase() === query;
        if (triggerType === 'sourceFile') return (node.sourceFile || '').toLowerCase() === query;
        return false;
    });
    if (exact.length > 0) return exact;

    return normalizedNodes
        .map((node) => {
            const haystacks = [node.nodeKey, node.label, node.sourceFile, node.summary]
                .filter(Boolean)
                .map((value) => String(value).toLowerCase());
            const score = haystacks.reduce((total, haystack) => total + (haystack.includes(query) ? 1 : 0), 0);
            return { node, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || left.node.label.localeCompare(right.node.label))
        .slice(0, 5)
        .map((entry) => entry.node);
}


function summarizeByKey(items, keySelector, scoreSelector) {
    const summary = new Map();

    for (const item of items || []) {
        const key = keySelector(item);
        if (!key) continue;
        const existing = summary.get(key) || { key, count: 0, maxScore: 0, labels: [] };
        existing.count += 1;
        existing.maxScore = Math.max(existing.maxScore, Number(scoreSelector(item) || 0));
        if (item.label && existing.labels.length < 5 && !existing.labels.includes(item.label)) {
            existing.labels.push(item.label);
        }
        summary.set(key, existing);
    }

    return [...summary.values()].sort((left, right) => right.maxScore - left.maxScore || right.count - left.count || left.key.localeCompare(right.key));
}

export function buildBlastRadiusReport({
    triggerValue,
    seedNodes,
    directImpact,
    transitiveImpact,
    relatedMemories,
    historicalRisk,
    recommendedTests,
    riskScore,
}) {
    const direct = Array.isArray(directImpact) ? directImpact : [];
    const transitive = Array.isArray(transitiveImpact) ? transitiveImpact : [];
    const allImpacts = [...direct, ...transitive];
    const seeds = Array.isArray(seedNodes) ? seedNodes : [];
    const memories = Array.isArray(relatedMemories) ? relatedMemories : [];
    const risks = Array.isArray(historicalRisk) ? historicalRisk : [];
    const tests = Array.isArray(recommendedTests) ? recommendedTests : [];

    const impactedFiles = summarizeByKey(
        allImpacts.filter((item) => item.sourceFile),
        (item) => item.sourceFile,
        (item) => item.score
    ).map((entry) => ({
        sourceFile: entry.key,
        count: entry.count,
        maxScore: Number(entry.maxScore.toFixed(4)),
        labels: entry.labels,
    }));

    const relationSummary = summarizeByKey(
        allImpacts.filter((item) => item.via?.relation),
        (item) => item.via.relation,
        (item) => item.score
    ).map((entry) => ({
        relation: entry.key,
        count: entry.count,
        maxScore: Number(entry.maxScore.toFixed(4)),
        labels: entry.labels,
    }));

    const nodeTypeSummary = summarizeByKey(
        allImpacts.filter((item) => item.nodeType),
        (item) => item.nodeType,
        (item) => item.score
    ).map((entry) => ({
        nodeType: entry.key,
        count: entry.count,
        maxScore: Number(entry.maxScore.toFixed(4)),
        labels: entry.labels,
    }));

    const reportLines = [
        `Trigger ${sanitizePlainText(triggerValue, 120) || 'unknown'} resolves to ${seeds.length} seed node(s).`,
        `Direct impact: ${direct.length} node(s); transitive impact: ${transitive.length} node(s).`,
        `Related memories: ${memories.length}; historical risk memories: ${risks.length}; recommended tests: ${tests.length}.`,
        `Overall risk score: ${Number(Number(riskScore || 0).toFixed(4))}.`,
    ];

    if (impactedFiles[0]) {
        reportLines.push(`Highest-risk file: ${impactedFiles[0].sourceFile}.`);
    }
    if (relationSummary[0]) {
        reportLines.push(`Dominant relation: ${relationSummary[0].relation}.`);
    }

    return {
        totals: {
            seedCount: seeds.length,
            directCount: direct.length,
            transitiveCount: transitive.length,
            relatedMemoryCount: memories.length,
            historicalRiskCount: risks.length,
            recommendedTestCount: tests.length,
            riskScore: Number(Number(riskScore || 0).toFixed(4)),
        },
        impactedFiles: impactedFiles.slice(0, 15),
        relationSummary: relationSummary.slice(0, 10),
        nodeTypeSummary: nodeTypeSummary.slice(0, 10),
        reportLines,
    };
}

export function buildSuggestedTests({ impactedNodes, availableTests, triggerValue }) {
    const tests = Array.isArray(availableTests) ? availableTests : [];
    if (tests.length === 0) return [];

    const triggerKeyword = sanitizePlainText(triggerValue, 80).toLowerCase();
    const keywords = new Set();
    keywords.add(triggerKeyword);

    for (const node of impactedNodes || []) {
        const sourceFile = sanitizePlainText(node.sourceFile || '', 200).toLowerCase();
        const label = sanitizePlainText(node.label || '', 120).toLowerCase();
        if (sourceFile) {
            sourceFile.split(/[\/_.-]/).forEach((part) => part.length >= 3 && keywords.add(part));
        }
        if (label) {
            label.split(/[^a-z0-9]+/).forEach((part) => part.length >= 3 && keywords.add(part));
        }
    }

    return tests
        .map((testFile) => {
            const lowered = testFile.toLowerCase();
            let score = 0;
            if (triggerKeyword && lowered.includes(triggerKeyword)) score += 3;
            for (const keyword of keywords) {
                if (!keyword || keyword === triggerKeyword) continue;
                if (lowered.includes(keyword)) score += 1;
            }
            return { testFile, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || left.testFile.localeCompare(right.testFile))
        .slice(0, 10)
        .map((entry) => entry.testFile);
}
