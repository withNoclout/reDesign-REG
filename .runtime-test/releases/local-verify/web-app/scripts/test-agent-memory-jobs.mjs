import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { acquireJobLock, readJobStatus, releaseJobLock, runJobWithLock, runWithRetries, writeJobStatus } from '../lib/agentMemoryJobs.mjs';

async function withTempCwd(work) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-memory-jobs-'));
    const originalCwd = process.cwd();
    process.chdir(tempDir);
    try {
        return await work(tempDir);
    } finally {
        process.chdir(originalCwd);
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

test('acquireJobLock prevents concurrent execution and readJobStatus reflects running state', async () => {
    await withTempCwd(async () => {
        const lock = await acquireJobLock('refresh-job', { staleMs: 1000 });
        const statusWhileRunning = await readJobStatus('refresh-job');
        assert.equal(statusWhileRunning.running, true);
        assert.equal(statusWhileRunning.lock.pid, process.pid);

        await assert.rejects(
            acquireJobLock('refresh-job', { staleMs: 1000 }),
            /already running/
        );

        await releaseJobLock(lock);
        const statusAfterRelease = await readJobStatus('refresh-job');
        assert.equal(statusAfterRelease.running, false);
    });
});

test('acquireJobLock recovers inactive lock files without reporting the job as running', async () => {
    await withTempCwd(async (tempDir) => {
        const runtimeDir = path.join(tempDir, '.agent-memory');
        await fs.mkdir(runtimeDir, { recursive: true });
        await fs.writeFile(path.join(runtimeDir, 'stale-job.lock.json'), JSON.stringify({
            jobName: 'stale-job',
            lockId: 'stale-lock',
            pid: 999999,
            startedAt: '2000-01-01T00:00:00.000Z',
            staleAfterMs: 1000,
        }));

        const lock = await acquireJobLock('stale-job', { staleMs: 1000 });
        const status = await readJobStatus('stale-job');
        assert.equal(status.running, true);
        assert.equal(status.lock.lockId, lock.lockId);

        await releaseJobLock(lock);
        const releasedStatus = await readJobStatus('stale-job');
        assert.equal(releasedStatus.running, false);
    });
});

test('runJobWithLock writes success status and releases the lock', async () => {
    await withTempCwd(async () => {
        const result = await runJobWithLock('embedding-job', { metadata: { batchSize: 20 } }, async () => ({ applied: 7 }));
        assert.deepEqual(result, { applied: 7 });

        const status = await readJobStatus('embedding-job');
        assert.equal(status.running, false);
        assert.equal(status.status.state, 'success');
        assert.equal(status.status.result.applied, 7);
        assert.equal(status.status.metadata.batchSize, 20);
    });
});

test('runJobWithLock adopts a pre-acquired lock from the environment', async () => {
    await withTempCwd(async () => {
        const lock = await acquireJobLock('preacquired-job', { staleMs: 1000 });
        const previousEnv = {
            AGENT_MEMORY_JOB_BACKEND: process.env.AGENT_MEMORY_JOB_BACKEND,
            AGENT_MEMORY_JOB_NAME: process.env.AGENT_MEMORY_JOB_NAME,
            AGENT_MEMORY_JOB_LOCK_ID: process.env.AGENT_MEMORY_JOB_LOCK_ID,
            AGENT_MEMORY_JOB_LOCK_PATH: process.env.AGENT_MEMORY_JOB_LOCK_PATH,
            AGENT_MEMORY_JOB_STALE_MS: process.env.AGENT_MEMORY_JOB_STALE_MS,
            AGENT_MEMORY_JOB_REPO: process.env.AGENT_MEMORY_JOB_REPO,
        };

        Object.assign(process.env, {
            AGENT_MEMORY_JOB_BACKEND: 'file',
            AGENT_MEMORY_JOB_NAME: 'preacquired-job',
            AGENT_MEMORY_JOB_LOCK_ID: lock.lockId,
            AGENT_MEMORY_JOB_LOCK_PATH: lock.lockPath,
            AGENT_MEMORY_JOB_STALE_MS: '1000',
            AGENT_MEMORY_JOB_REPO: 'web-app',
        });

        try {
            const result = await runJobWithLock('preacquired-job', { repoName: 'web-app' }, async () => 'done');
            assert.equal(result, 'done');
            const status = await readJobStatus('preacquired-job');
            assert.equal(status.running, false);
            assert.equal(status.status.state, 'success');
        } finally {
            for (const [key, value] of Object.entries(previousEnv)) {
                if (value == null) {
                    delete process.env[key];
                } else {
                    process.env[key] = value;
                }
            }
            await releaseJobLock(lock);
        }
    });
});

test('writeJobStatus persists status snapshots for trigger routes', async () => {
    await withTempCwd(async () => {
        await writeJobStatus('graphify-refresh', { state: 'queued', metadata: { source: 'route' } });
        const status = await readJobStatus('graphify-refresh');
        assert.equal(status.running, false);
        assert.equal(status.status.state, 'queued');
        assert.equal(status.status.metadata.source, 'route');
    });
});

test('runWithRetries retries transient failures and returns the successful result', async () => {
    let attempts = 0;
    const result = await runWithRetries(async () => {
        attempts += 1;
        if (attempts < 3) {
            throw new Error('transient');
        }
        return 'ok';
    }, { attempts: 3, delayMs: 1 });

    assert.equal(result, 'ok');
    assert.equal(attempts, 3);
});
