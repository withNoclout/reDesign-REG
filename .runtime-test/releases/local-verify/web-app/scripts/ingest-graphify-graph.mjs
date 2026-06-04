import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import { ingestGraphSnapshot } from '../lib/agentMemoryService.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

function getFlag(name, fallback = null) {
    const index = process.argv.indexOf(`--${name}`);
    if (index === -1) return fallback;
    return process.argv[index + 1] ?? fallback;
}

async function readIfExists(filePath) {
    if (!filePath) return null;
    try {
        return await fs.readFile(filePath, 'utf8');
    } catch {
        return null;
    }
}

async function main() {
    const graphPath = path.resolve(process.cwd(), getFlag('graph', 'graphify-out/graph.json'));
    const reportPath = path.resolve(process.cwd(), getFlag('report', 'graphify-out/GRAPH_REPORT.md'));
    const repoName = getFlag('repo', path.basename(process.cwd()));
    const commitSha = getFlag('commit', process.env.GIT_COMMIT_SHA || 'workspace');
    const branchName = getFlag('branch', process.env.GIT_BRANCH || null);
    const createdBy = getFlag('created-by', process.env.AGENT_MEMORY_CREATED_BY || 'graphify-ingest');
    const scopeArg = getFlag('scope', 'app,lib,deploy/database,scripts');

    const graphJson = await fs.readFile(graphPath, 'utf8');
    const reportMarkdown = await readIfExists(reportPath);
    const graph = JSON.parse(graphJson);

    const result = await ingestGraphSnapshot({
        repoName,
        branchName,
        commitSha,
        graphVersion: getFlag('graph-version', '1'),
        sourceScope: scopeArg.split(',').map((entry) => entry.trim()).filter(Boolean),
        graphJsonPath: graphPath,
        reportPath: reportMarkdown ? reportPath : null,
        createdBy,
        graph,
        reportMarkdown: reportMarkdown || '',
    });

    console.log(JSON.stringify({
        snapshotId: result.snapshot.id,
        commitSha: result.snapshot.commitSha,
        counts: result.counts,
    }, null, 2));
}

main().catch((error) => {
    console.error('Failed to ingest graphify graph:', error.message);
    process.exit(1);
});
