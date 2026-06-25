import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import pg from 'pg';
import { spawn } from 'child_process';

import { sanitizePlainText } from './agentMemoryConfig.mjs';

const { Pool } = pg;
const DEFAULT_STALE_MS = 2 * 60 * 60 * 1000;

function getConfiguredRuntimeRoot() {
    return typeof process.env.REDESIGN_REG_AGENT_MEMORY_DIR === 'string' && process.env.REDESIGN_REG_AGENT_MEMORY_DIR.trim()
        ? process.env.REDESIGN_REG_AGENT_MEMORY_DIR.trim()
        : null;
}

function getRuntimeRoot() {
    return getConfiguredRuntimeRoot() ?? path.join(/* turbopackIgnore: true */ process.cwd(), '.agent-memory');
}

function getJobFilePath(jobName, suffix) {
    const cleanJobName = sanitizePlainText(jobName, 120).replace(/[^a-z0-9_-]+/gi, '-');
    const fileName = `${cleanJobName}.${suffix}.json`;
    return getConfiguredRuntimeRoot()
        ? path.join(getConfiguredRuntimeRoot(), fileName)
        : path.join(/* turbopackIgnore: true */ process.cwd(), '.agent-memory', fileName);
}

function resolveJobScriptPath(scriptRelativePath) {
    const normalized = String(scriptRelativePath || '').trim().replaceAll('\\', '/');
    if (!normalized.startsWith('scripts/') || normalized.split('/').includes('..')) {
        throw new Error('Job script must be inside the scripts directory.');
    }
    return path.join(/* turbopackIgnore: true */ process.cwd(), 'scripts', normalized.slice('scripts/'.length));
}


function parseJsonSafely(raw) {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function ensureRuntimeRoot() {
    await fs.mkdir(/* turbopackIgnore: true */ getRuntimeRoot(), { recursive: true });
}

function isProcessAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error?.code === 'EPERM';
    }
}

async function readJsonFile(filePath) {
    try {
        return parseJsonSafely(await fs.readFile(/* turbopackIgnore: true */ filePath, 'utf8'));
    } catch {
        return null;
    }
}

async function writeJsonFile(filePath, payload) {
    await fs.writeFile(/* turbopackIgnore: true */ filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function hasJobDatabase() {
    return Boolean(process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim());
}

function getDatabaseUrl() {
    if (!hasJobDatabase()) {
        throw new Error('Missing DATABASE_URL for persistent job operations.');
    }
    return process.env.DATABASE_URL;
}

function getSslConfig() {
    const sslMode = String(process.env.PGSSLMODE || '').toLowerCase();
    if (sslMode === 'disable') return false;

    try {
        const databaseUrl = new URL(getDatabaseUrl());
        if (['localhost', '127.0.0.1'].includes(databaseUrl.hostname)) {
            return false;
        }
    } catch {
        // Fall back to TLS for remote URLs we cannot parse.
    }

    return { rejectUnauthorized: true };
}

function getJobDatabasePool() {
    if (globalThis.__agentMemoryJobPool) return globalThis.__agentMemoryJobPool;

    const pool = new Pool({
        connectionString: getDatabaseUrl(),
        ssl: getSslConfig(),
        max: 3,
    });

    globalThis.__agentMemoryJobPool = pool;
    return pool;
}

function buildLockId() {
    return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeStaleMs(value, fallback = DEFAULT_STALE_MS) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
    return Math.max(1000, Math.trunc(numeric));
}

function isTimestampStale(timestamp, staleMs) {
    const timestampMs = timestamp ? Date.parse(timestamp) : Number.NaN;
    if (!Number.isFinite(timestampMs)) return true;
    return Date.now() - timestampMs > normalizeStaleMs(staleMs, DEFAULT_STALE_MS);
}

function isLockPayloadActive(lockPayload) {
    if (!lockPayload) return false;
    const staleMs = normalizeStaleMs(lockPayload.staleAfterMs, DEFAULT_STALE_MS);
    if (isTimestampStale(lockPayload.startedAt || lockPayload.updatedAt, staleMs)) return false;
    return lockPayload.pid ? isProcessAlive(lockPayload.pid) : false;
}

async function wait(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function recoverInactiveLock(lockPath, options = {}) {
    const recoveryPath = `${lockPath}.recover`;
    const staleMs = normalizeStaleMs(options.staleMs, DEFAULT_STALE_MS);
    const recoveryPayload = {
        pid: process.pid,
        startedAt: new Date().toISOString(),
        staleAfterMs: staleMs,
    };

    try {
        const recoveryHandle = await fs.open(/* turbopackIgnore: true */ recoveryPath, 'wx');
        try {
            await recoveryHandle.writeFile(`${JSON.stringify(recoveryPayload, null, 2)}\n`, 'utf8');
            const latest = await readJsonFile(lockPath);
            if (!latest || !isLockPayloadActive(latest)) {
                await fs.rm(/* turbopackIgnore: true */ lockPath, { force: true });
            }
        } finally {
            await recoveryHandle.close();
            await fs.rm(/* turbopackIgnore: true */ recoveryPath, { force: true });
        }
    } catch (error) {
        if (error?.code !== 'EEXIST') throw error;

        const recoveryState = await readJsonFile(recoveryPath);
        if (!isLockPayloadActive(recoveryState)) {
            await fs.rm(/* turbopackIgnore: true */ recoveryPath, { force: true });
            return recoverInactiveLock(lockPath, options);
        }

        await wait(Math.max(25, Number.parseInt(String(options.retryDelayMs ?? 50), 10) || 50));
    }
}

function mapPersistentJobRow(row) {
    if (!row) return null;
    return {
        jobName: row.job_name,
        repoName: row.repo_name,
        state: row.state,
        lockId: row.lock_id,
        pid: row.pid,
        hostname: row.hostname,
        metadata: row.metadata || {},
        result: row.result || null,
        error: row.error || null,
        staleAfterMs: Number(row.stale_after_ms ?? DEFAULT_STALE_MS),
        queuedAt: row.queued_at,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        updatedAt: row.updated_at,
    };
}

function isPersistentJobActive(job) {
    if (!job || !job.lockId) return false;
    if (!['queued', 'running'].includes(job.state)) return false;
    return !isTimestampStale(job.updatedAt || job.startedAt || job.queuedAt, job.staleAfterMs || DEFAULT_STALE_MS);
}

async function readPersistentJob(jobName) {
    const result = await getJobDatabasePool().query(
        `SELECT *
         FROM public.agent_memory_jobs
         WHERE job_name = $1
         LIMIT 1`,
        [sanitizePlainText(jobName, 120)]
    );
    return mapPersistentJobRow(result.rows[0]);
}

async function acquirePersistentJobLock(jobName, options = {}) {
    const cleanJobName = sanitizePlainText(jobName, 120);
    const cleanRepoName = sanitizePlainText(options.repoName, 120) || 'web-app';
    const lockId = buildLockId();
    const staleMs = normalizeStaleMs(options.staleMs, DEFAULT_STALE_MS);
    const metadata = options.metadata && typeof options.metadata === 'object' && !Array.isArray(options.metadata)
        ? options.metadata
        : {};
    const nowIso = new Date().toISOString();

    const result = await getJobDatabasePool().query(
        `INSERT INTO public.agent_memory_jobs (
            job_name,
            repo_name,
            state,
            lock_id,
            pid,
            hostname,
            metadata,
            result,
            error,
            stale_after_ms,
            queued_at,
            started_at,
            finished_at,
            updated_at
        ) VALUES (
            $1,
            $2,
            'queued',
            $3,
            $4,
            $5,
            $6::jsonb,
            '{}'::jsonb,
            '{}'::jsonb,
            $7,
            $8::timestamptz,
            NULL,
            NULL,
            NOW()
        )
        ON CONFLICT (job_name) DO UPDATE SET
            repo_name = EXCLUDED.repo_name,
            state = EXCLUDED.state,
            lock_id = EXCLUDED.lock_id,
            pid = EXCLUDED.pid,
            hostname = EXCLUDED.hostname,
            metadata = EXCLUDED.metadata,
            result = '{}'::jsonb,
            error = '{}'::jsonb,
            stale_after_ms = EXCLUDED.stale_after_ms,
            queued_at = EXCLUDED.queued_at,
            started_at = NULL,
            finished_at = NULL,
            updated_at = NOW()
        WHERE public.agent_memory_jobs.lock_id IS NULL
           OR public.agent_memory_jobs.state IN ('success', 'failed')
           OR public.agent_memory_jobs.updated_at <= NOW() - ((GREATEST(public.agent_memory_jobs.stale_after_ms, EXCLUDED.stale_after_ms))::text || ' milliseconds')::interval
        RETURNING *`,
        [
            cleanJobName,
            cleanRepoName,
            lockId,
            process.pid,
            os.hostname(),
            JSON.stringify(metadata),
            staleMs,
            nowIso,
        ]
    );

    if (result.rowCount === 0) {
        const existing = await readPersistentJob(cleanJobName);
        const busyError = new Error(`${cleanJobName} is already running.`);
        busyError.code = 'JOB_LOCKED';
        busyError.lock = existing;
        throw busyError;
    }

    return {
        backend: 'database',
        jobName: cleanJobName,
        lockId,
        staleMs,
        repoName: cleanRepoName,
        metadata,
        payload: mapPersistentJobRow(result.rows[0]),
    };
}

async function writePersistentJobStatus(jobName, payload = {}) {
    const cleanJobName = sanitizePlainText(jobName, 120);
    const cleanRepoName = sanitizePlainText(payload.repoName, 120) || 'web-app';
    const result = await getJobDatabasePool().query(
        `INSERT INTO public.agent_memory_jobs (
            job_name,
            repo_name,
            state,
            lock_id,
            pid,
            hostname,
            metadata,
            result,
            error,
            stale_after_ms,
            queued_at,
            started_at,
            finished_at,
            updated_at
        ) VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7::jsonb,
            $8::jsonb,
            $9::jsonb,
            $10,
            $11::timestamptz,
            $12::timestamptz,
            $13::timestamptz,
            NOW()
        )
        ON CONFLICT (job_name) DO UPDATE SET
            repo_name = EXCLUDED.repo_name,
            state = EXCLUDED.state,
            lock_id = EXCLUDED.lock_id,
            pid = EXCLUDED.pid,
            hostname = EXCLUDED.hostname,
            metadata = EXCLUDED.metadata,
            result = EXCLUDED.result,
            error = EXCLUDED.error,
            stale_after_ms = EXCLUDED.stale_after_ms,
            queued_at = COALESCE(EXCLUDED.queued_at, public.agent_memory_jobs.queued_at),
            started_at = COALESCE(EXCLUDED.started_at, public.agent_memory_jobs.started_at),
            finished_at = EXCLUDED.finished_at,
            updated_at = NOW()
        WHERE public.agent_memory_jobs.lock_id IS NULL
           OR EXCLUDED.lock_id IS NULL
           OR public.agent_memory_jobs.lock_id = EXCLUDED.lock_id
        RETURNING *`,
        [
            cleanJobName,
            cleanRepoName,
            sanitizePlainText(payload.state, 40) || 'queued',
            payload.lockId ?? null,
            Number.isInteger(payload.pid) ? payload.pid : null,
            sanitizePlainText(payload.hostname, 120) || os.hostname(),
            JSON.stringify(payload.metadata || {}),
            JSON.stringify(payload.result || {}),
            JSON.stringify(payload.error || {}),
            normalizeStaleMs(payload.staleAfterMs, DEFAULT_STALE_MS),
            payload.queuedAt || null,
            payload.startedAt || null,
            payload.finishedAt || null,
        ]
    );

    return mapPersistentJobRow(result.rows[0]);
}

async function reassignPersistentJobLock(lockHandle, pid) {
    if (!lockHandle?.jobName || !lockHandle?.lockId || !Number.isInteger(pid) || pid <= 0) return;
    await getJobDatabasePool().query(
        `UPDATE public.agent_memory_jobs
         SET pid = $3,
             hostname = $4,
             updated_at = NOW()
         WHERE job_name = $1
           AND lock_id = $2`,
        [lockHandle.jobName, lockHandle.lockId, pid, os.hostname()]
    );
}

async function releasePersistentJobLock(lockHandle) {
    if (!lockHandle?.jobName || !lockHandle?.lockId) return;
    await getJobDatabasePool().query(
        `UPDATE public.agent_memory_jobs
         SET lock_id = NULL,
             pid = NULL,
             updated_at = NOW()
         WHERE job_name = $1
           AND lock_id = $2`,
        [lockHandle.jobName, lockHandle.lockId]
    );
}

function readPreAcquiredLockFromEnv(jobName) {
    if (process.env.AGENT_MEMORY_JOB_NAME !== jobName) return null;
    const lockId = sanitizePlainText(process.env.AGENT_MEMORY_JOB_LOCK_ID, 200);
    if (!lockId) return null;

    if (process.env.AGENT_MEMORY_JOB_BACKEND === 'database' && hasJobDatabase()) {
        return {
            backend: 'database',
            jobName,
            lockId,
            staleMs: normalizeStaleMs(process.env.AGENT_MEMORY_JOB_STALE_MS, DEFAULT_STALE_MS),
            repoName: sanitizePlainText(process.env.AGENT_MEMORY_JOB_REPO, 120) || 'web-app',
        };
    }

    const lockPath = sanitizePlainText(process.env.AGENT_MEMORY_JOB_LOCK_PATH, 400);
    if (!lockPath) return null;
    return { backend: 'file', lockPath, lockId, staleMs: normalizeStaleMs(process.env.AGENT_MEMORY_JOB_STALE_MS, DEFAULT_STALE_MS) };
}

async function acquireFileLock(jobName, options = {}) {
    const staleMs = normalizeStaleMs(options.staleMs, DEFAULT_STALE_MS);
    const now = Date.now();
    const lockPath = getJobFilePath(jobName, 'lock');
    const lockId = buildLockId();
    const payload = {
        jobName: sanitizePlainText(jobName, 120),
        lockId,
        pid: process.pid,
        hostname: os.hostname(),
        startedAt: new Date(now).toISOString(),
        staleAfterMs: staleMs,
    };

    await ensureRuntimeRoot();

    try {
        const handle = await fs.open(/* turbopackIgnore: true */ lockPath, 'wx');
        try {
            await handle.writeFile(`${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        } finally {
            await handle.close();
        }
        return { backend: 'file', lockPath, lockId, staleMs, payload };
    } catch (error) {
        if (error?.code !== 'EEXIST') throw error;

        const existing = await readJsonFile(lockPath);
        if (!existing) {
            try {
                const stats = await fs.stat(/* turbopackIgnore: true */ lockPath);
                if (now - stats.mtimeMs <= staleMs) {
                    const busyError = new Error(`${jobName} is already running.`);
                    busyError.code = 'JOB_LOCKED';
                    throw busyError;
                }
            } catch (statError) {
                if (statError?.code !== 'ENOENT') throw statError;
            }

            await recoverInactiveLock(lockPath, { staleMs });
            return acquireFileLock(jobName, options);
        }

        if (!isLockPayloadActive(existing)) {
            await recoverInactiveLock(lockPath, { staleMs });
            return acquireFileLock(jobName, options);
        }

        const busyError = new Error(`${jobName} is already running.`);
        busyError.code = 'JOB_LOCKED';
        busyError.lock = existing;
        throw busyError;
    }
}

async function writeFileJobStatus(jobName, payload) {
    await ensureRuntimeRoot();
    const statusPath = getJobFilePath(jobName, 'status');
    await writeJsonFile(statusPath, {
        ...payload,
        jobName: sanitizePlainText(jobName, 120),
        updatedAt: new Date().toISOString(),
    });
    return statusPath;
}

async function readFileJobStatus(jobName) {
    const lockPath = getJobFilePath(jobName, 'lock');
    let lock = await readJsonFile(lockPath);
    if (lock && !isLockPayloadActive(lock)) {
        await recoverInactiveLock(lockPath, { staleMs: normalizeStaleMs(lock.staleAfterMs, DEFAULT_STALE_MS) });
        lock = await readJsonFile(lockPath);
        if (lock && !isLockPayloadActive(lock)) {
            lock = null;
        }
    }

    const status = await readJsonFile(getJobFilePath(jobName, 'status'));
    return {
        jobName: sanitizePlainText(jobName, 120),
        running: Boolean(lock),
        lock,
        status,
    };
}

async function releaseFileJobLock(lockHandle) {
    if (!lockHandle?.lockPath) return;
    const current = await readJsonFile(lockHandle.lockPath);
    if (current?.lockId && current.lockId !== lockHandle.lockId) {
        return;
    }
    await fs.rm(/* turbopackIgnore: true */ lockHandle.lockPath, { force: true });
}

async function reassignFileJobLock(lockHandle, pid) {
    if (!lockHandle?.lockPath || !Number.isInteger(pid) || pid <= 0) return;
    const current = await readJsonFile(lockHandle.lockPath);
    if (!current?.lockId || current.lockId !== lockHandle.lockId) {
        return;
    }
    current.pid = pid;
    await writeJsonFile(lockHandle.lockPath, current);
}

export async function acquireJobLock(jobName, options = {}) {
    if (hasJobDatabase()) {
        return acquirePersistentJobLock(jobName, options);
    }
    return acquireFileLock(jobName, options);
}

export async function releaseJobLock(lockHandle) {
    if (!lockHandle) return;
    if (lockHandle.backend === 'database') {
        await releasePersistentJobLock(lockHandle);
        return;
    }
    await releaseFileJobLock(lockHandle);
}

export async function reassignJobLock(lockHandle, pid) {
    if (!lockHandle) return;
    if (lockHandle.backend === 'database') {
        await reassignPersistentJobLock(lockHandle, pid);
        return;
    }
    await reassignFileJobLock(lockHandle, pid);
}

export async function writeJobStatus(jobName, payload) {
    if (hasJobDatabase()) {
        return writePersistentJobStatus(jobName, payload);
    }
    return writeFileJobStatus(jobName, payload);
}

export async function readJobStatus(jobName) {
    if (hasJobDatabase()) {
        const job = await readPersistentJob(jobName);
        return {
            jobName: sanitizePlainText(jobName, 120),
            running: isPersistentJobActive(job),
            lock: job?.lockId ? {
                lockId: job.lockId,
                pid: job.pid,
                hostname: job.hostname,
                updatedAt: job.updatedAt,
                staleAfterMs: job.staleAfterMs,
            } : null,
            status: job,
        };
    }
    return readFileJobStatus(jobName);
}

export async function runWithRetries(work, options = {}) {
    const attempts = Math.max(1, Number.parseInt(String(options.attempts ?? 1), 10) || 1);
    const delayMs = Math.max(0, Number.parseInt(String(options.delayMs ?? 1000), 10) || 0);
    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await work(attempt);
        } catch (error) {
            lastError = error;
            if (attempt >= attempts) break;
            if (delayMs > 0) {
                await wait(delayMs * attempt);
            }
        }
    }

    throw lastError;
}

export async function runJobWithLock(jobName, options = {}, work) {
    const startedAt = new Date().toISOString();
    const staleMs = normalizeStaleMs(options.staleMs, DEFAULT_STALE_MS);
    const preAcquiredLock = readPreAcquiredLockFromEnv(jobName);
    const lockHandle = preAcquiredLock || await acquireJobLock(jobName, {
        staleMs,
        repoName: options.repoName,
        metadata: options.metadata,
    });

    if (preAcquiredLock) {
        await reassignJobLock(lockHandle, process.pid);
    }

    await writeJobStatus(jobName, {
        repoName: options.repoName,
        state: 'running',
        lockId: lockHandle.lockId,
        pid: process.pid,
        startedAt,
        queuedAt: options.queuedAt || null,
        staleAfterMs: staleMs,
        metadata: options.metadata || {},
    });

    try {
        const result = await work(lockHandle);
        await writeJobStatus(jobName, {
            repoName: options.repoName,
            state: 'success',
            lockId: lockHandle.lockId,
            pid: process.pid,
            startedAt,
            finishedAt: new Date().toISOString(),
            staleAfterMs: staleMs,
            metadata: options.metadata || {},
            result: result || null,
        });
        return result;
    } catch (error) {
        await writeJobStatus(jobName, {
            repoName: options.repoName,
            state: 'failed',
            lockId: lockHandle.lockId,
            pid: process.pid,
            startedAt,
            finishedAt: new Date().toISOString(),
            staleAfterMs: staleMs,
            metadata: options.metadata || {},
            error: {
                message: error?.message || 'Unknown error',
                code: error?.code || null,
            },
        });
        throw error;
    } finally {
        await releaseJobLock(lockHandle);
    }
}

export async function spawnDetachedNodeJob({
    jobName,
    scriptRelativePath,
    args = [],
    env = {},
    staleMs = DEFAULT_STALE_MS,
    repoName = 'web-app',
    metadata = {},
}) {
    const normalizedStaleMs = normalizeStaleMs(staleMs, DEFAULT_STALE_MS);
    const lockHandle = await acquireJobLock(jobName, {
        staleMs: normalizedStaleMs,
        repoName,
        metadata,
    });

    const queuedAt = new Date().toISOString();
    await writeJobStatus(jobName, {
        repoName,
        state: 'queued',
        lockId: lockHandle.lockId,
        pid: process.pid,
        queuedAt,
        staleAfterMs: normalizedStaleMs,
        metadata,
    });

    let child = null;
    try {
        const scriptPath = resolveJobScriptPath(scriptRelativePath);
        child = spawn(process.execPath, [scriptPath, ...args], {
            cwd: process.cwd(),
            detached: true,
            stdio: 'ignore',
            env: {
                ...process.env,
                ...env,
                AGENT_MEMORY_JOB_BACKEND: lockHandle.backend || 'file',
                AGENT_MEMORY_JOB_NAME: jobName,
                AGENT_MEMORY_JOB_LOCK_ID: lockHandle.lockId,
                AGENT_MEMORY_JOB_STALE_MS: String(normalizedStaleMs),
                AGENT_MEMORY_JOB_REPO: repoName,
                ...(lockHandle.lockPath ? { AGENT_MEMORY_JOB_LOCK_PATH: lockHandle.lockPath } : {}),
            },
        });
        child.unref();
        try {
            await reassignJobLock(lockHandle, child.pid);
        } catch {
            // The child reassigns the pre-acquired lock again at startup.
        }

        return {
            jobName,
            pid: child.pid,
            status: 'queued',
        };
    } catch (error) {
        if (!child) {
            await writeJobStatus(jobName, {
                repoName,
                state: 'failed',
                lockId: lockHandle.lockId,
                finishedAt: new Date().toISOString(),
                staleAfterMs: normalizedStaleMs,
                metadata,
                error: {
                    message: error?.message || 'Unknown error',
                    code: error?.code || null,
                },
            });
            await releaseJobLock(lockHandle);
        }
        throw error;
    }
}
