import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildFixOutcomeRequest,
    buildImpactRequest,
    buildJobTriggerPayload,
    buildSearchRequest,
    formatDashboard,
    formatImpact,
    formatJobStatus,
    formatSearchResults,
    parseCliArgs,
    parseListOption,
} from '../lib/codexAgentMemoryCli.mjs';
test('parseCliArgs collects positional args and named flags', () => {
    const parsed = parseCliArgs(['impact', '--file', 'lib/auth.js', '--json', '--limit', '5']);
    assert.deepEqual(parsed.positional, ['impact']);
    assert.equal(parsed.options.file, 'lib/auth.js');
    assert.equal(parsed.options.json, true);
    assert.equal(parsed.options.limit, '5');
});

test('parseCliArgs preserves graphify arg payloads and inline assignments', () => {
    const parsed = parseCliArgs(['refresh', '--graphify-args', '--foo bar', '--repo=web-app']);
    assert.equal(parsed.options['graphify-args'], '--foo bar');
    assert.equal(parsed.options.repo, 'web-app');
});

test('buildImpactRequest infers sourceFile trigger from --file', () => {
    const request = buildImpactRequest({ file: 'lib/auth.js', depth: '3', limit: '7', repo: 'web-app' });
    assert.deepEqual(request, {
        repoName: 'web-app',
        triggerType: 'sourceFile',
        triggerValue: 'lib/auth.js',
        snapshotId: null,
        maxDepth: 3,
        limit: 7,
        notes: null,
    });
});

test('buildSearchRequest and buildFixOutcomeRequest normalize list inputs', () => {
    const search = buildSearchRequest({ query: 'auth regression', kinds: 'fixSummary,incident', limit: '5' });
    assert.deepEqual(search, {
        repoName: 'web-app',
        query: 'auth regression',
        kinds: ['fixSummary', 'incident'],
        limit: 5,
    });

    const fix = buildFixOutcomeRequest({
        resolution: 'Updated cookie handling',
        'assessment-id': 'abc-123',
        'changed-files': 'lib/auth.js,app/api/user/settings/route.js',
        tests: 'scripts/test-auth-flow.js,scripts/test-user-settings.js',
        failures: 'none',
    });
    assert.equal(fix.assessmentId, 'abc-123');
    assert.deepEqual(fix.changedFiles, ['lib/auth.js', 'app/api/user/settings/route.js']);
    assert.deepEqual(fix.testsRun, ['scripts/test-auth-flow.js', 'scripts/test-user-settings.js']);
    assert.deepEqual(fix.failuresFound, ['none']);
});

test('buildJobTriggerPayload prepares refresh and embeddings payloads', () => {
    const refresh = buildJobTriggerPayload('refresh', {
        repo: 'web-app',
        'skip-build': true,
        'skip-ingest': false,
        scope: 'app,lib',
        'stale-ms': '5000',
    });
    assert.equal(refresh.repoName, 'web-app');
    assert.equal(refresh.skipBuild, true);
    assert.equal(refresh.skipIngest, false);
    assert.equal(refresh.staleMs, 5000);

    const embeddings = buildJobTriggerPayload('embeddings', {
        repo: 'web-app',
        kinds: 'fixSummary,incident',
        'dry-run': true,
        limit: '55',
        'batch-size': '12',
    });
    assert.deepEqual(embeddings.kinds, ['fixSummary', 'incident']);
    assert.equal(embeddings.dryRun, true);
    assert.equal(embeddings.limit, 55);
    assert.equal(embeddings.batchSize, 12);
});

test('format helpers emit compact codex-friendly summaries', () => {
    const dashboard = formatDashboard({
        repoName: 'web-app',
        generatedAt: '2026-06-02T00:00:00.000Z',
        graph: { latestSnapshot: { commitSha: 'abc123', createdAt: '2026-06-02T00:00:00.000Z' } },
        memory: { pendingEmbeddings: 14 },
        jobs: {
            refresh: { running: false, status: { state: 'success' } },
            embeddings: { running: true, status: { state: 'running' } },
        },
    });
    assert.match(dashboard, /Latest snapshot: abc123/);
    assert.match(dashboard, /Pending embeddings: 14/);

    const impact = formatImpact({
        snapshot: { commitSha: 'abc123' },
        seedNodes: [{ label: 'getAuthUser()' }],
        riskScore: 0.84,
        directImpact: [{ label: 'GET \/api\/user\/settings' }],
        transitiveImpact: [{ label: 'student_profile' }],
        recommendedTests: ['scripts/test-auth-flow.js'],
        blastRadiusReport: { reportLines: ['Trigger resolved to 1 seed node.'] },
    });
    assert.match(impact, /Risk score: 0.84/);
    assert.match(impact, /Recommended tests: scripts\/test-auth-flow.js/);

    const jobStatus = formatJobStatus('graphify-refresh', {
        running: true,
        status: { state: 'running', updatedAt: '2026-06-02T00:00:00.000Z' },
    });
    assert.match(jobStatus, /graphify-refresh: running \(running\)/);

    const search = formatSearchResults([
        { kind: 'fixSummary', title: 'Auth cookie regression', content: 'Refreshing auth cookies broke student profile requests.' },
    ]);
    assert.match(search, /Auth cookie regression/);
    assert.match(search, /Refreshing auth cookies broke student profile requests/);
});

test('parseListOption handles strings and arrays', () => {
    assert.deepEqual(parseListOption('a,b,c'), ['a', 'b', 'c']);
    assert.deepEqual(parseListOption(['x', 'y']), ['x', 'y']);
});
