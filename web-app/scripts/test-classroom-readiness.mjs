import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateGoogleClassroomReadiness } from '../lib/googleClassroomReadiness.js';

const ENV_KEYS = [
    'NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID',
    'NEXT_PUBLIC_GOOGLE_CLASSROOM_GMAIL_ROLLOUT_MODE',
    'NEXT_PUBLIC_GOOGLE_CLASSROOM_GMAIL_ROLLOUT_USERS',
    'NEXT_PUBLIC_GOOGLE_CLASSROOM_GMAIL_QUERY',
];

function snapshotEnv() {
    return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot) {
    for (const key of ENV_KEYS) {
        if (snapshot[key] === undefined) delete process.env[key];
        else process.env[key] = snapshot[key];
    }
}

test('evaluateGoogleClassroomReadiness reports blocked when public client ID is missing', async () => {
    const snapshot = snapshotEnv();
    try {
        for (const key of ENV_KEYS) delete process.env[key];
        const readiness = await evaluateGoogleClassroomReadiness('6701091611290');

        assert.equal(readiness.status, 'blocked');
        assert.equal(readiness.configured, false);
        assert.equal(readiness.browserLocalOnly, true);
        assert.equal(readiness.rollout.mode, 'pilot');
        assert.equal(readiness.rollout.enabled, true);
        assert.equal(readiness.checklist.some((item) => item.id === 'public-client-id' && item.ready === false), true);
        assert.equal(readiness.blockers.some((item) => item.id === 'missing-public-client-id'), true);
    } finally {
        restoreEnv(snapshot);
    }
});
