import {
    AGENT_MEMORY_GRAPH_VERSION,
    sanitizePlainText,
} from './agentMemoryConfig.mjs';

const REPORT_SECTION_TITLES = ['God Nodes', 'Surprising Connections', 'Suggested Questions'];

function normalizeMetadata(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry) => sanitizePlainText(entry, 240))
        .filter(Boolean);
}

function inferNodeType(node) {
    const label = sanitizePlainText(node.label || node.id || 'Unknown Node', 160);
    const sourceFile = sanitizePlainText(node.source_file || '', 400);
    const fileType = sanitizePlainText(node.file_type || 'code', 40) || 'code';

    if (sourceFile.includes('/app/api/')) return 'apiRoute';
    if (sourceFile.endsWith('.sql')) return 'dbSchema';
    if (sourceFile.includes('/scripts/')) return 'script';
    if (sourceFile.endsWith('.md') || fileType === 'document') return 'documentConcept';
    if (fileType === 'paper') return 'researchConcept';
    if (fileType === 'image') return 'visualConcept';
    if (label.includes('(') && label.includes(')')) return 'codeSymbol';
    if (/^[A-Z][A-Za-z0-9_]+$/.test(label)) return 'codeSymbol';
    return 'concept';
}

function buildNodeSummary(nodeType, node) {
    const parts = [sanitizePlainText(node.label || node.id || 'Unknown Node', 160), `type: ${nodeType}`];
    if (node.source_file) parts.push(`source: ${sanitizePlainText(node.source_file, 260)}`);
    if (node.source_location) parts.push(`location: ${sanitizePlainText(node.source_location, 120)}`);
    return parts.join(' | ');
}

export function extractReportSections(markdown) {
    const clean = String(markdown || '').replace(/\r\n/g, '\n');
    const sections = {};

    for (let index = 0; index < REPORT_SECTION_TITLES.length; index++) {
        const title = REPORT_SECTION_TITLES[index];
        const nextTitle = REPORT_SECTION_TITLES[index + 1];
        const pattern = nextTitle
            ? new RegExp(`##\\s+${title}\\n([\\s\\S]*?)\\n##\\s+${nextTitle}`)
            : new RegExp(`##\\s+${title}\\n([\\s\\S]*)$`);
        const match = clean.match(pattern);
        if (match?.[1]) {
            sections[title] = match[1].trim();
        }
    }

    return sections;
}

export function buildGraphRecords({
    snapshotId,
    repoName,
    commitSha,
    graph,
    reportMarkdown,
    graphVersion = AGENT_MEMORY_GRAPH_VERSION,
    createdBy = null,
}) {
    if (!snapshotId) throw new Error('snapshotId is required.');
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
        throw new Error('graph must contain nodes[] and edges[].');
    }

    const nodeKeys = new Set();
    const nodes = [];
    const memoryItems = [];

    for (const rawNode of graph.nodes) {
        const nodeKey = sanitizePlainText(rawNode?.id, 240);
        if (!nodeKey || nodeKeys.has(nodeKey)) continue;
        nodeKeys.add(nodeKey);

        const nodeType = inferNodeType(rawNode || {});
        const nodeRef = `${snapshotId}:${nodeKey}`;
        const label = sanitizePlainText(rawNode?.label || rawNode?.id || 'Unknown Node', 160);
        const sourceFile = sanitizePlainText(rawNode?.source_file || '', 400) || null;
        const sourceLocation = sanitizePlainText(rawNode?.source_location || '', 160) || null;
        const fileType = sanitizePlainText(rawNode?.file_type || 'code', 40) || 'code';
        const metadata = normalizeMetadata(rawNode?.metadata);
        const summary = buildNodeSummary(nodeType, rawNode || {});

        nodes.push({
            nodeRef,
            nodeKey,
            label,
            nodeType,
            fileType,
            sourceFile,
            sourceLocation,
            summary,
            metadata,
        });

        memoryItems.push({
            repoName,
            memoryKey: `snapshot:${snapshotId}:node:${nodeKey}`,
            scope: 'node',
            kind: 'graphNodeSummary',
            title: label,
            content: summary,
            sourceNodeRefs: [nodeRef],
            provenance: {
                commitSha: sanitizePlainText(commitSha, 120) || null,
                graphVersion: sanitizePlainText(graphVersion, 40) || AGENT_MEMORY_GRAPH_VERSION,
                sourceFile,
            },
            metadata: {
                nodeType,
                fileType,
            },
            createdBy,
        });
    }

    const nodeRefByKey = new Map(nodes.map((node) => [node.nodeKey, node.nodeRef]));
    const edgeDedup = new Set();
    const edges = [];

    for (const rawEdge of graph.edges) {
        const sourceKey = sanitizePlainText(rawEdge?.source, 240);
        const targetKey = sanitizePlainText(rawEdge?.target, 240);
        const sourceNodeRef = nodeRefByKey.get(sourceKey);
        const targetNodeRef = nodeRefByKey.get(targetKey);
        if (!sourceNodeRef || !targetNodeRef) continue;

        const relation = sanitizePlainText(rawEdge?.relation || 'related_to', 80) || 'related_to';
        const confidence = sanitizePlainText(rawEdge?.confidence || 'INFERRED', 20) || 'INFERRED';
        const sourceFile = sanitizePlainText(rawEdge?.source_file || '', 400) || null;
        const dedupKey = `${sourceNodeRef}|${targetNodeRef}|${relation}|${sourceFile || ''}`;
        if (edgeDedup.has(dedupKey)) continue;
        edgeDedup.add(dedupKey);

        const confidenceScore = Number.isFinite(Number(rawEdge?.confidence_score))
            ? Number(rawEdge.confidence_score)
            : confidence === 'EXTRACTED'
                ? 1
                : 0.7;
        const weight = Number.isFinite(Number(rawEdge?.weight)) ? Number(rawEdge.weight) : 1;

        edges.push({
            sourceNodeRef,
            targetNodeRef,
            relation,
            confidence,
            confidenceScore,
            sourceFile,
            weight,
            metadata: normalizeMetadata(rawEdge?.metadata),
        });
    }

    const hyperedges = [];
    const hyperedgeNodes = [];
    if (Array.isArray(graph.hyperedges)) {
        for (const rawHyperedge of graph.hyperedges) {
            const hyperedgeKey = sanitizePlainText(rawHyperedge?.id, 240);
            if (!hyperedgeKey) continue;
            const hyperedgeId = `${snapshotId}:${hyperedgeKey}`;
            const nodeRefs = normalizeStringArray(rawHyperedge?.nodes)
                .map((nodeKey) => nodeRefByKey.get(nodeKey))
                .filter(Boolean);
            if (nodeRefs.length < 2) continue;

            hyperedges.push({
                hyperedgeId,
                hyperedgeKey,
                label: sanitizePlainText(rawHyperedge?.label || hyperedgeKey, 160),
                relation: sanitizePlainText(rawHyperedge?.relation || 'participate_in', 80) || 'participate_in',
                confidence: sanitizePlainText(rawHyperedge?.confidence || 'INFERRED', 20) || 'INFERRED',
                confidenceScore: Number.isFinite(Number(rawHyperedge?.confidence_score))
                    ? Number(rawHyperedge.confidence_score)
                    : 0.7,
                sourceFile: sanitizePlainText(rawHyperedge?.source_file || '', 400) || null,
                metadata: normalizeMetadata(rawHyperedge?.metadata),
            });

            nodeRefs.forEach((nodeRef, ordinal) => {
                hyperedgeNodes.push({ hyperedgeId, nodeRef, ordinal });
            });
        }
    }

    const reportSections = extractReportSections(reportMarkdown);
    for (const [title, body] of Object.entries(reportSections)) {
        memoryItems.push({
            repoName,
            memoryKey: `snapshot:${snapshotId}:report:${title.toLowerCase().replace(/\s+/g, '-')}`,
            scope: 'repo',
            kind: 'graphReportSection',
            title,
            content: sanitizePlainText(body, 8000),
            sourceNodeRefs: [],
            provenance: {
                commitSha: sanitizePlainText(commitSha, 120) || null,
                graphVersion: sanitizePlainText(graphVersion, 40) || AGENT_MEMORY_GRAPH_VERSION,
            },
            metadata: {
                section: title,
            },
            createdBy,
        });
    }

    return {
        nodes,
        edges,
        hyperedges,
        hyperedgeNodes,
        memoryItems,
        graphStats: {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            hyperedgeCount: hyperedges.length,
            memoryItemCount: memoryItems.length,
        },
    };
}
