import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    analyzeImpact,
    getAgentMemoryDashboard,
    searchAgentMemory,
    storeFixOutcome,
} from '../lib/agentMemoryService.mjs';
import { readJobStatus, spawnDetachedNodeJob } from '../lib/agentMemoryJobs.mjs';
import {
    buildFixOutcomeRequest,
    buildImpactRequest,
    buildJobTriggerPayload,
    buildSearchRequest,
    formatDashboard,
    formatFixOutcome,
    formatImpact,
    formatJobStatus,
    formatSearchResults,
    parseCliArgs,
} from '../lib/codexAgentMemoryCli.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

function printUsage() {
    console.log(`Usage:
  node scripts/codex-agent-memory.mjs dashboard [--repo web-app] [--json]
  node scripts/codex-agent-memory.mjs impact --file <path> [--depth 2] [--limit 10] [--json]
  node scripts/codex-agent-memory.mjs impact --symbol <name> [--json]
  node scripts/codex-agent-memory.mjs search --query <text> [--kinds kind1,kind2] [--json]
  node scripts/codex-agent-memory.mjs refresh [--repo web-app] [--skip-build] [--json]
  node scripts/codex-agent-memory.mjs embeddings [--repo web-app] [--limit 100] [--json]
  node scripts/codex-agent-memory.mjs jobs [--json]
  node scripts/codex-agent-memory.mjs record-fix --resolution <text> [--assessment-id id] [--json]
`);
}

function emit(value, asJson) {
    if (asJson) {
        console.log(JSON.stringify(value, null, 2));
        return;
    }
    console.log(value);
}

async function runDashboard(options) {
    const result = await getAgentMemoryDashboard({ repoName: options.repo });
    emit(options.json ? result : formatDashboard(result), options.json);
}

async function runImpact(options) {
    const result = await analyzeImpact({
        ...buildImpactRequest(options),
        createdBy: options['created-by'] || 'codex-cli',
    });
    emit(options.json ? result : formatImpact(result), options.json);
}

async function runSearch(options) {
    const result = await searchAgentMemory(buildSearchRequest(options));
    emit(options.json ? result : formatSearchResults(result), options.json);
}

async function runJobs(options) {
    const [refresh, embeddings] = await Promise.all([
        readJobStatus('graphify-refresh'),
        readJobStatus('agent-memory-embeddings'),
    ]);
    const result = { refresh, embeddings };
    emit(options.json ? result : [formatJobStatus('graphify-refresh', refresh), formatJobStatus('agent-memory-embeddings', embeddings)].join('\n'), options.json);
}

async function runRecordFix(options) {
    const result = await storeFixOutcome(buildFixOutcomeRequest(options));
    emit(options.json ? result : formatFixOutcome(result), options.json);
}

async function runJobTrigger(command, options) {
    const payload = buildJobTriggerPayload(command, options);
    const scriptRelativePath = command === 'refresh'
        ? 'scripts/graphify-refresh.mjs'
        : 'scripts/backfill-agent-memory-embeddings.mjs';
    const env = {};
    if (payload.createdBy) {
        env.AGENT_MEMORY_CREATED_BY = payload.createdBy;
    }
    if (payload.endpoint) {
        env.AGENT_MEMORY_EMBEDDING_ENDPOINT = payload.endpoint;
    }
    if (payload.apiKey) {
        env.AGENT_MEMORY_EMBEDDING_API_KEY = payload.apiKey;
    }

    const metadata = command === 'refresh'
        ? {
            repoName: payload.repoName,
            requestedBy: options['created-by'] || 'codex-cli',
            skipBuild: payload.skipBuild,
            skipIngest: payload.skipIngest,
        }
        : {
            repoName: payload.repoName,
            requestedBy: options['created-by'] || 'codex-cli',
            model: payload.model,
            limit: payload.limit,
            batchSize: payload.batchSize,
            dryRun: payload.dryRun,
            kinds: payload.kinds,
        };

    const args = [];
    if (command === 'refresh') {
        if (payload.graphPath) args.push('--graph', payload.graphPath);
        if (payload.reportPath) args.push('--report', payload.reportPath);
        if (payload.repoName) args.push('--repo', payload.repoName);
        if (payload.commitSha) args.push('--commit', payload.commitSha);
        if (payload.branchName) args.push('--branch', payload.branchName);
        if (payload.scope) args.push('--scope', payload.scope);
        if (payload.createdBy) args.push('--created-by', payload.createdBy);
        if (payload.graphifyArgs) args.push('--graphify-args', payload.graphifyArgs);
        if (payload.python) args.push('--python', payload.python);
        if (payload.skipBuild) args.push('--skip-build');
        if (payload.skipIngest) args.push('--skip-ingest');
    } else {
        if (payload.repoName) args.push('--repo', payload.repoName);
        if (payload.model) args.push('--model', payload.model);
        if (payload.endpoint) args.push('--endpoint', payload.endpoint);
        if (payload.limit) args.push('--limit', String(payload.limit));
        if (payload.batchSize) args.push('--batch-size', String(payload.batchSize));
        if (Array.isArray(payload.kinds) && payload.kinds.length > 0) args.push('--kinds', payload.kinds.join(','));
        if (payload.dryRun) args.push('--dry-run');
    }

    const result = await spawnDetachedNodeJob({
        jobName: command === 'refresh' ? 'graphify-refresh' : 'agent-memory-embeddings',
        scriptRelativePath,
        args,
        repoName: payload.repoName,
        staleMs: payload.staleMs,
        metadata,
        env,
    });

    emit(options.json ? result : `${command} queued with pid ${result.pid}`, options.json);
}

async function main() {
    const { positional, options } = parseCliArgs(process.argv.slice(2));
    const command = positional[0];
    if (!command || command === 'help' || command === '--help') {
        printUsage();
        return;
    }

    switch (command) {
        case 'dashboard':
            await runDashboard(options);
            return;
        case 'impact':
            await runImpact(options);
            return;
        case 'search':
            await runSearch(options);
            return;
        case 'jobs':
            await runJobs(options);
            return;
        case 'record-fix':
            await runRecordFix(options);
            return;
        case 'refresh':
        case 'embeddings':
            await runJobTrigger(command, options);
            return;
        default:
            throw new Error(`Unknown command: ${command}`);
    }
}

main().catch((error) => {
    console.error('Codex agent-memory command failed:', error.message);
    process.exit(1);
});
