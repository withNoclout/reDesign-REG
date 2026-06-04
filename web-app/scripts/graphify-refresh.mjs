import { spawn } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { sanitizePlainText } from '../lib/agentMemoryConfig.mjs';
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

function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: options.cwd || process.cwd(),
            stdio: 'inherit',
            env: { ...process.env, ...(options.env || {}) },
        });
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${command} exited with code ${code}`));
        });
        child.on('error', reject);
    });
}

async function getGitValue(args) {
    return new Promise((resolve) => {
        const child = spawn('git', args, { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] });
        let output = '';
        child.stdout.on('data', (chunk) => {
            output += chunk.toString();
        });
        child.on('exit', (code) => {
            resolve(code === 0 ? output.trim() : null);
        });
        child.on('error', () => resolve(null));
    });
}

function getPythonCommand() {
    return sanitizePlainText(getFlag('python', process.env.AGENT_MEMORY_GRAPHIFY_PYTHON || 'python3'), 200) || 'python3';
}

async function canImportGraphify(pythonCommand) {
    return new Promise((resolve) => {
        const child = spawn(pythonCommand, ['-c', 'import graphify'], {
            cwd: process.cwd(),
            stdio: ['ignore', 'ignore', 'ignore'],
        });
        child.on('exit', (code) => resolve(code === 0));
        child.on('error', () => resolve(false));
    });
}

async function ensureGraphifyInstalled(pythonCommand) {
    if (await canImportGraphify(pythonCommand)) return;
    await run(pythonCommand, ['-m', 'pip', 'install', 'graphifyy']);
    if (!(await canImportGraphify(pythonCommand))) {
        throw new Error('graphifyy installation completed but graphify could not be imported.');
    }
}

function getRetryAttempts() {
    return Number.parseInt(String(getFlag('retry-attempts', process.env.AGENT_MEMORY_JOB_RETRY_ATTEMPTS || '3')), 10) || 3;
}

function getRetryDelayMs() {
    return Number.parseInt(String(getFlag('retry-delay-ms', process.env.AGENT_MEMORY_JOB_RETRY_DELAY_MS || '2000')), 10) || 2000;
}



async function main() {
    const graphPath = getFlag('graph', 'graphify-out/graph.json');
    const reportPath = getFlag('report', 'graphify-out/GRAPH_REPORT.md');
    const repoName = sanitizePlainText(getFlag('repo', path.basename(process.cwd())), 120) || path.basename(process.cwd());
    const scope = getFlag('scope', 'app,lib,deploy/database,scripts');
    const createdBy = sanitizePlainText(getFlag('created-by', process.env.AGENT_MEMORY_CREATED_BY || 'graphify-refresh'), 120) || 'graphify-refresh';
    const pythonCommand = getPythonCommand();
    const graphifyArgs = ['-m', 'graphify', getFlag('path', '.'), '--no-viz'];
    const extraGraphifyArgs = String(getFlag('graphify-args', '') || '')
        .split(' ')
        .map((entry) => entry.trim())
        .filter(Boolean);
    graphifyArgs.push(...extraGraphifyArgs);

    const commitSha = sanitizePlainText(getFlag('commit', await getGitValue(['rev-parse', 'HEAD']) || 'workspace'), 120) || 'workspace';
    const branchName = sanitizePlainText(getFlag('branch', await getGitValue(['rev-parse', '--abbrev-ref', 'HEAD']) || ''), 120) || null;
    const retryAttempts = getRetryAttempts();
    const retryDelayMs = getRetryDelayMs();

    return runJobWithLock('graphify-refresh', {
        repoName,
        staleMs: 2 * 60 * 60 * 1000,
        metadata: {
            repoName,
            graphPath,
            reportPath,
            skipBuild: hasFlag('skip-build'),
            skipIngest: hasFlag('skip-ingest'),
        },
    }, async () => {
        if (!hasFlag('skip-build')) {
            await runWithRetries(async () => {
                await ensureGraphifyInstalled(pythonCommand);
                await run(pythonCommand, graphifyArgs);
            }, { attempts: retryAttempts, delayMs: retryDelayMs });
        }

        if (!hasFlag('skip-ingest')) {
            await runWithRetries(async () => {
                await run(process.execPath, [
                    'scripts/ingest-graphify-graph.mjs',
                    '--graph', graphPath,
                    '--report', reportPath,
                    '--repo', repoName,
                    '--commit', commitSha,
                    '--scope', scope,
                    '--created-by', createdBy,
                    ...(branchName ? ['--branch', branchName] : []),
                ]);
            }, { attempts: retryAttempts, delayMs: retryDelayMs });
        }

        return {
            repoName,
            commitSha,
            branchName,
            graphPath,
            reportPath,
        };
    });
}

main().catch((error) => {
    console.error('Failed to refresh graphify memory:', error.message);
    process.exit(1);
});
