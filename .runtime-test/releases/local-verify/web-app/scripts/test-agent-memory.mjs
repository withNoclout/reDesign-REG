import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGraphRecords, extractReportSections } from '../lib/graphifyMemory.mjs';
import { buildEmbeddingInput, buildEmbeddingRequest, parseEmbeddingResponse } from '../lib/embeddingBackfill.mjs';
import { analyzeGraphNeighborhood, buildBlastRadiusReport, buildSuggestedTests, pickSeedNodes } from '../lib/impactAnalysis.mjs';

const snapshotId = '11111111-1111-1111-1111-111111111111';

const sampleGraph = {
    nodes: [
        {
            id: 'auth_getAuthUser',
            label: 'getAuthUser()' ,
            file_type: 'code',
            source_file: 'lib/auth.js',
            source_location: 'line 140',
        },
        {
            id: 'profile_route',
            label: 'GET /api/student/profile',
            file_type: 'code',
            source_file: 'app/api/student/profile/route.js',
            source_location: 'line 12',
        },
        {
            id: 'settings_route',
            label: 'GET /api/user/settings',
            file_type: 'code',
            source_file: 'app/api/user/settings/route.js',
            source_location: 'line 6',
        },
    ],
    edges: [
        {
            source: 'profile_route',
            target: 'auth_getAuthUser',
            relation: 'calls',
            confidence: 'EXTRACTED',
            confidence_score: 1,
            weight: 1,
        },
        {
            source: 'settings_route',
            target: 'auth_getAuthUser',
            relation: 'calls',
            confidence: 'INFERRED',
            confidence_score: 0.8,
            weight: 1,
        },
    ],
    hyperedges: [
        {
            id: 'auth_flow',
            label: 'Authentication Flow',
            nodes: ['profile_route', 'settings_route', 'auth_getAuthUser'],
            relation: 'participate_in',
            confidence: 'INFERRED',
            confidence_score: 0.75,
        },
    ],
};

const sampleReport = `## God Nodes\n- getAuthUser()\n\n## Surprising Connections\n- profile route and settings route both depend on auth.\n\n## Suggested Questions\n- What breaks if auth validation changes?\n`;

test('extractReportSections keeps only the requested graph report sections', () => {
    const sections = extractReportSections(sampleReport);
    assert.deepEqual(Object.keys(sections), ['God Nodes', 'Surprising Connections', 'Suggested Questions']);
    assert.match(sections['God Nodes'], /getAuthUser/);
});

test('buildGraphRecords normalizes graph nodes, edges, hyperedges, and report memories', () => {
    const records = buildGraphRecords({
        snapshotId,
        repoName: 'web-app',
        commitSha: 'abc123',
        graph: sampleGraph,
        reportMarkdown: sampleReport,
        graphVersion: '1',
        createdBy: 'tester',
    });

    assert.equal(records.nodes.length, 3);
    assert.equal(records.edges.length, 2);
    assert.equal(records.hyperedges.length, 1);
    assert.equal(records.hyperedgeNodes.length, 3);
    assert.ok(records.memoryItems.some((item) => item.kind === 'graphNodeSummary'));
    assert.ok(records.memoryItems.some((item) => item.kind === 'graphReportSection' && item.title === 'God Nodes'));
});

test('pickSeedNodes and analyzeGraphNeighborhood produce direct and transitive impact lists', () => {
    const records = buildGraphRecords({
        snapshotId,
        repoName: 'web-app',
        commitSha: 'abc123',
        graph: sampleGraph,
        reportMarkdown: sampleReport,
    });

    const seeds = pickSeedNodes({
        nodes: records.nodes,
        triggerType: 'sourceFile',
        triggerValue: 'lib/auth.js',
    });
    assert.equal(seeds.length, 1);

    const analysis = analyzeGraphNeighborhood({
        nodes: records.nodes,
        edges: records.edges,
        seedNodeRefs: seeds.map((node) => node.nodeRef),
        maxDepth: 2,
    });

    assert.equal(analysis.directImpact.length, 2);
    assert.equal(analysis.transitiveImpact.length, 0);
    assert.ok(analysis.riskScore > 0);
    assert.equal(analysis.directImpact[0].via.direction, 'incoming');
});

test('buildSuggestedTests prioritizes relevant test scripts from impacted nodes', () => {
    const impactedNodes = [
        {
            label: 'GET /api/student/profile',
            sourceFile: 'app/api/student/profile/route.js',
        },
        {
            label: 'getAuthUser()',
            sourceFile: 'lib/auth.js',
        },
    ];

    const suggestions = buildSuggestedTests({
        impactedNodes,
        availableTests: [
            'scripts/test-student-profile.js',
            'scripts/test-auth-flow.js',
            'scripts/test-schedule-api.js',
        ],
        triggerValue: 'auth',
    });

    assert.deepEqual(suggestions.slice(0, 2), [
        'scripts/test-auth-flow.js',
        'scripts/test-student-profile.js',
    ]);
});

test('buildBlastRadiusReport groups impact by file and relation for surgical fixes', () => {
    const records = buildGraphRecords({
        snapshotId,
        repoName: 'web-app',
        commitSha: 'abc123',
        graph: sampleGraph,
        reportMarkdown: sampleReport,
    });
    const seeds = pickSeedNodes({
        nodes: records.nodes,
        triggerType: 'sourceFile',
        triggerValue: 'lib/auth.js',
    });
    const analysis = analyzeGraphNeighborhood({
        nodes: records.nodes,
        edges: records.edges,
        seedNodeRefs: seeds.map((node) => node.nodeRef),
        maxDepth: 2,
    });

    const report = buildBlastRadiusReport({
        triggerValue: 'lib/auth.js',
        seedNodes: seeds,
        directImpact: analysis.directImpact,
        transitiveImpact: analysis.transitiveImpact,
        relatedMemories: [{ kind: 'fixSummary' }, { kind: 'graphReportSection' }],
        historicalRisk: [{ kind: 'fixSummary' }],
        recommendedTests: ['scripts/test-auth-flow.js'],
        riskScore: analysis.riskScore,
    });

    assert.equal(report.totals.seedCount, 1);
    assert.equal(report.totals.directCount, 2);
    assert.equal(report.impactedFiles[0].sourceFile, 'app/api/student/profile/route.js');
    assert.equal(report.relationSummary[0].relation, 'calls');
    assert.match(report.reportLines[0], /lib\/auth\.js/);
});

test('embedding helpers produce request payloads and parse OpenAI-compatible responses', () => {
    const input = buildEmbeddingInput({
        title: 'Fix outcome for auth regression',
        kind: 'fixSummary',
        scope: 'fix',
        content: 'Refreshing auth cookies invalidated student profile requests.',
    });
    assert.match(input, /Title: Fix outcome for auth regression/);
    assert.match(input, /Content: Refreshing auth cookies/);

    const payload = buildEmbeddingRequest({
        model: 'text-embedding-3-small',
        inputs: [input],
    });
    assert.equal(payload.model, 'text-embedding-3-small');
    assert.equal(payload.input.length, 1);
    assert.match(payload.input[0], /Title: Fix outcome for auth regression/);
    assert.match(payload.input[0], /Content: Refreshing auth cookies invalidated student profile requests\./);

    const vectors = parseEmbeddingResponse({
        data: [
            { index: 1, embedding: [0.4, 0.5, 0.6] },
            { index: 0, embedding: [0.1, 0.2, 0.3] },
        ],
    }, 2);
    assert.deepEqual(vectors, [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
    ]);
});
