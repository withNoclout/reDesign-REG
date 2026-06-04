import { spawn } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { sanitizePlainText } from '../lib/agentMemoryConfig.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

function getFlag(name, fallback = null) {
    const index = process.argv.indexOf(`--${name}`);
    if (index === -1) return fallback;
    return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}

function requireEnv(name, errors) {
    if (!process.env[name] || !String(process.env[name]).trim()) {
        errors.push(`Missing ${name}`);
    }
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

function validatePrerequisites({ runEmbeddings }) {
    const errors = [];

    if (!fs.existsSync(envPath)) {
        errors.push(`Missing ${envPath}`);
    }

    requireEnv('DATABASE_URL', errors);
    requireEnv('ADMIN_USER_ID', errors);

    if (runEmbeddings) {
        requireEnv('AGENT_MEMORY_EMBEDDING_ENDPOINT', errors);
    }

    return errors;
}

async function main() {
    const skipSetup = hasFlag('skip-setup');
    const skipRefresh = hasFlag('skip-refresh');
    const skipEmbeddings = hasFlag('skip-embeddings');
    const installServices = hasFlag('install-services');
    const printOnly = hasFlag('print-only');
    const embeddingEndpoint = sanitizePlainText(getFlag('embedding-endpoint', process.env.AGENT_MEMORY_EMBEDDING_ENDPOINT), 400);

    if (embeddingEndpoint) {
        process.env.AGENT_MEMORY_EMBEDDING_ENDPOINT = embeddingEndpoint;
    }

    const validationErrors = validatePrerequisites({ runEmbeddings: !skipEmbeddings });
    if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('; '));
    }

    const plan = [];
    if (!skipSetup) {
        plan.push({
            label: 'Apply agent-memory schema',
            command: 'npm',
            args: ['run', 'memory:setup'],
        });
    }

    if (!skipRefresh) {
        plan.push({
            label: 'Build and ingest graphify snapshot',
            command: 'npm',
            args: ['run', 'graphify:refresh'],
        });
    }

    if (!skipEmbeddings) {
        const args = ['run', 'memory:embeddings:backfill'];
        if (embeddingEndpoint) {
            args.push('--', '--endpoint', embeddingEndpoint);
        }
        plan.push({
            label: 'Backfill agent-memory embeddings',
            command: 'npm',
            args,
        });
    }

    if (installServices) {
        plan.push({
            label: 'Install agent-memory systemd services',
            command: hasFlag('use-sudo') ? 'sudo' : 'npm',
            args: hasFlag('use-sudo')
                ? ['npm', 'run', 'memory:services:install']
                : ['run', 'memory:services:install'],
        });
    }

    if (printOnly) {
        for (const step of plan) {
            console.log(`${step.label}: ${step.command} ${step.args.join(' ')}`);
        }
        return;
    }

    for (const step of plan) {
        console.log(`\n==> ${step.label}`);
        await run(step.command, step.args, { cwd: process.cwd() });
    }

    console.log('\nAgent memory bootstrap completed.');
}

main().catch((error) => {
    console.error('Agent memory bootstrap failed:', error.message);
    process.exit(1);
});
