import assert from 'node:assert/strict';
import test from 'node:test';

import { getClientGoogleMailConfig, getClientGoogleMailRollout } from '../lib/googleClientMailConfig.js';

const SNAPSHOT_KEYS = [
    'NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID',
    'NEXT_PUBLIC_GOOGLE_CLASSROOM_GMAIL_ROLLOUT_MODE',
    'NEXT_PUBLIC_GOOGLE_CLASSROOM_GMAIL_ROLLOUT_USERS',
    'NEXT_PUBLIC_GOOGLE_CLASSROOM_GMAIL_QUERY',
];

function snapshotEnv() {
    return Object.fromEntries(SNAPSHOT_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot) {
    for (const key of SNAPSHOT_KEYS) {
        if (snapshot[key] === undefined) delete process.env[key];
        else process.env[key] = snapshot[key];
    }
}

test('client Google Mail config falls back to pilot user and default query', () => {
    const snapshot = snapshotEnv();
    try {
        for (const key of SNAPSHOT_KEYS) delete process.env[key];
        const config = getClientGoogleMailConfig();
        assert.equal(config.clientId, null);
        assert.equal(config.rolloutMode, 'pilot');
        assert.equal(config.rolloutUsers.has('6701091611290'), true);
        assert.match(config.query, /Google Classroom/);
    } finally {
        restoreEnv(snapshot);
    }
});

test('client Google Mail rollout respects public allowlist', () => {
    const snapshot = snapshotEnv();
    try {
        process.env.NEXT_PUBLIC_GOOGLE_CLASSROOM_GMAIL_ROLLOUT_MODE = 'pilot';
        process.env.NEXT_PUBLIC_GOOGLE_CLASSROOM_GMAIL_ROLLOUT_USERS = '6701091611290,6701091611291';
        assert.deepEqual(getClientGoogleMailRollout('s6701091611290'), {
            mode: 'pilot',
            enabled: true,
            reason: 'pilot_allowlist',
            userCode: '6701091611290',
        });
        assert.deepEqual(getClientGoogleMailRollout('6701091611299'), {
            mode: 'pilot',
            enabled: false,
            reason: 'pilot_restricted',
            userCode: '6701091611299',
        });
    } finally {
        restoreEnv(snapshot);
    }
});
