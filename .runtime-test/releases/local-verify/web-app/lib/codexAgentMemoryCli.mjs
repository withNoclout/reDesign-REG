import { clampPositiveInteger, sanitizePlainText } from './agentMemoryConfig.mjs';

export function parseCliArgs(argv) {
    const positional = [];
    const options = {};

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) {
            positional.push(token);
            continue;
        }

        const eqIndex = token.indexOf('=');
        if (eqIndex > 2) {
            const name = token.slice(2, eqIndex);
            const value = token.slice(eqIndex + 1);
            options[name] = value === '' ? true : value;
            continue;
        }

        const name = token.slice(2);
        const next = argv[index + 1];
        const forceValue = name === 'graphify-args';
        if (!next || (!forceValue && next.startsWith('--'))) {
            options[name] = true;
            continue;
        }

        options[name] = next;
        index += 1;
    }

    return { positional, options };
}

export function parseListOption(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.map((entry) => sanitizePlainText(entry, 200)).filter(Boolean);
    }

    return String(value)
        .split(',')
        .map((entry) => sanitizePlainText(entry, 200))
        .filter(Boolean);
}

export function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (value == null) return false;
    const normalized = String(value).trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
}

export function buildImpactRequest(options) {
    const explicitTriggerType = sanitizePlainText(options['trigger-type'], 40);
    const explicitTriggerValue = sanitizePlainText(options['trigger-value'], 240);
    const repoName = sanitizePlainText(options.repo, 120) || 'web-app';
    const snapshotId = sanitizePlainText(options['snapshot-id'], 120) || null;
    const notes = sanitizePlainText(options.notes, 4000) || null;

    let triggerType = explicitTriggerType || null;
    let triggerValue = explicitTriggerValue || null;

    const triggerCandidates = [
        ['sourceFile', options.file],
        ['symbol', options.symbol],
        ['nodeKey', options['node-key']],
        ['label', options.label],
    ];

    if (!triggerType || !triggerValue) {
        for (const [candidateType, candidateValue] of triggerCandidates) {
            const cleanValue = sanitizePlainText(candidateValue, 240);
            if (!cleanValue) continue;
            triggerType = triggerType || candidateType;
            triggerValue = triggerValue || cleanValue;
            break;
        }
    }

    if (!triggerType || !triggerValue) {
        throw new Error('Impact command requires one of --file, --symbol, --node-key, --label, or explicit --trigger-type with --trigger-value.');
    }

    return {
        repoName,
        triggerType,
        triggerValue,
        snapshotId,
        maxDepth: clampPositiveInteger(options.depth, 2, 4),
        limit: clampPositiveInteger(options.limit, 10, 25),
        notes,
    };
}

export function buildSearchRequest(options) {
    const query = sanitizePlainText(options.query || options.q, 240);
    if (!query) {
        throw new Error('Search command requires --query.');
    }

    return {
        repoName: sanitizePlainText(options.repo, 120) || 'web-app',
        query,
        kinds: parseListOption(options.kinds),
        limit: clampPositiveInteger(options.limit, 10, 25),
    };
}

export function buildFixOutcomeRequest(options) {
    const finalResolution = sanitizePlainText(options.resolution || options['final-resolution'], 4000);
    if (!finalResolution) {
        throw new Error('record-fix requires --resolution.');
    }

    return {
        assessmentId: sanitizePlainText(options['assessment-id'], 120) || null,
        repoName: sanitizePlainText(options.repo, 120) || 'web-app',
        commitSha: sanitizePlainText(options.commit, 120) || null,
        changedFiles: parseListOption(options['changed-files']),
        testsRun: parseListOption(options.tests),
        failuresFound: parseListOption(options.failures),
        finalResolution,
        createdBy: sanitizePlainText(options['created-by'], 120) || 'codex-cli',
    };
}

export function buildJobTriggerPayload(command, options) {
    const repoName = sanitizePlainText(options.repo, 120) || 'web-app';
    const staleMs = clampPositiveInteger(options['stale-ms'], 7200000, 86400000);

    if (command === 'refresh') {
        return {
            repoName,
            staleMs,
            graphPath: sanitizePlainText(options['graph-path'], 260) || null,
            reportPath: sanitizePlainText(options['report-path'], 260) || null,
            commitSha: sanitizePlainText(options.commit, 120) || null,
            branchName: sanitizePlainText(options.branch, 120) || null,
            scope: sanitizePlainText(options.scope, 260) || null,
            createdBy: sanitizePlainText(options['created-by'], 120) || 'codex-cli',
            graphifyArgs: sanitizePlainText(options['graphify-args'], 400) || null,
            python: sanitizePlainText(options.python, 200) || null,
            skipBuild: toBoolean(options['skip-build']),
            skipIngest: toBoolean(options['skip-ingest']),
        };
    }

    if (command === 'embeddings') {
        return {
            repoName,
            staleMs,
            model: sanitizePlainText(options.model, 120) || null,
            endpoint: sanitizePlainText(options.endpoint, 400) || null,
            limit: clampPositiveInteger(options.limit, 100, 500),
            batchSize: clampPositiveInteger(options['batch-size'], 20, 100),
            kinds: parseListOption(options.kinds),
            dryRun: toBoolean(options['dry-run']),
            apiKey: sanitizePlainText(options['api-key'], 400) || null,
        };
    }

    throw new Error(`Unsupported job trigger command: ${command}`);
}

export function formatDashboard(result) {
    const snapshot = result?.graph?.latestSnapshot;
    const refresh = result?.jobs?.refresh;
    const embeddings = result?.jobs?.embeddings;
    const lines = [
        `Repo: ${result?.repoName || 'web-app'}`,
        `Generated: ${result?.generatedAt || 'unknown'}`,
        `Latest snapshot: ${snapshot?.commitSha || 'none'}${snapshot?.createdAt ? ` @ ${snapshot.createdAt}` : ''}`,
        `Pending embeddings: ${result?.memory?.pendingEmbeddings ?? 0}`,
        `Refresh job: ${refresh?.status?.state || 'unknown'}${refresh?.running ? ' (running)' : ''}`,
        `Embeddings job: ${embeddings?.status?.state || 'unknown'}${embeddings?.running ? ' (running)' : ''}`,
    ];
    return lines.join('\n');
}

export function formatImpact(result) {
    const report = result?.blastRadiusReport;
    const seeds = Array.isArray(result?.seedNodes) ? result.seedNodes : [];
    const direct = Array.isArray(result?.directImpact) ? result.directImpact : [];
    const transitive = Array.isArray(result?.transitiveImpact) ? result.transitiveImpact : [];
    const tests = Array.isArray(result?.recommendedTests) ? result.recommendedTests : [];
    const lines = [
        `Snapshot: ${result?.snapshot?.commitSha || 'unknown'}`,
        `Seed nodes: ${seeds.map((node) => node.label).join(', ') || 'none'}`,
        `Risk score: ${result?.riskScore ?? 0}`,
        `Direct impact (${direct.length}): ${direct.slice(0, 5).map((item) => item.label).join(', ') || 'none'}`,
        `Transitive impact (${transitive.length}): ${transitive.slice(0, 5).map((item) => item.label).join(', ') || 'none'}`,
        `Recommended tests: ${tests.join(', ') || 'none'}`,
    ];

    if (Array.isArray(report?.reportLines)) {
        lines.push('', ...report.reportLines);
    }

    return lines.join('\n');
}

export function formatSearchResults(results) {
    const lines = [];
    for (const item of results || []) {
        lines.push(`- [${item.kind}] ${item.title}`);
        if (item.content) {
            lines.push(`  ${sanitizePlainText(item.content, 240)}`);
        }
    }
    return lines.join('\n') || 'No matching memory items found.';
}

export function formatJobStatus(jobName, status) {
    const state = status?.status?.state || 'unknown';
    const running = status?.running ? 'running' : 'idle';
    const updatedAt = status?.status?.updatedAt || 'unknown';
    return `${jobName}: ${state} (${running}) @ ${updatedAt}`;
}

export function formatFixOutcome(result) {
    return [
        `Recorded fix outcome ${result?.id || 'unknown'}`,
        `Repo: ${result?.repoName || 'web-app'}`,
        `Commit: ${result?.commitSha || 'none'}`,
        `Resolution: ${sanitizePlainText(result?.finalResolution, 240)}`,
    ].join('\n');
}
