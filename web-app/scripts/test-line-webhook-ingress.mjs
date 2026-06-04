import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getLineWebhookIngressConfig,
    getLineWebhookPublicUrl,
    isLineWebhookProxyProtectionEnabled,
    LINE_WEBHOOK_PROXY_SECRET_HEADER,
    verifyLineWebhookProxySecret,
} from '../lib/lineWebhookIngress.js';

function withEnv(overrides, run) {
    const snapshot = new Map();
    for (const key of Object.keys(overrides)) {
        snapshot.set(key, process.env[key]);
        const value = overrides[key];
        if (value === undefined || value === null) delete process.env[key];
        else process.env[key] = value;
    }

    try {
        return run();
    } finally {
        for (const [key, value] of snapshot.entries()) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

test('getLineWebhookPublicUrl prefers explicit public URL and falls back to NEXT_PUBLIC_BASE_URL', () => {
    withEnv({
        LINE_WEBHOOK_PUBLIC_URL: 'https://research.kmutnb.ac.th/line-callbacks/redesign-reg/secret/webhook',
        NEXT_PUBLIC_BASE_URL: 'https://redesign-reg.kmutnb.ac.th',
    }, () => {
        assert.equal(
            getLineWebhookPublicUrl(),
            'https://research.kmutnb.ac.th/line-callbacks/redesign-reg/secret/webhook'
        );
    });

    withEnv({
        LINE_WEBHOOK_PUBLIC_URL: undefined,
        NEXT_PUBLIC_BASE_URL: 'https://redesign-reg.kmutnb.ac.th/',
    }, () => {
        assert.equal(
            getLineWebhookPublicUrl(),
            'https://redesign-reg.kmutnb.ac.th/api/line/webhook'
        );
    });
});

test('getLineWebhookIngressConfig exposes shared proxy-secret header contract', () => {
    withEnv({
        LINE_WEBHOOK_PUBLIC_URL: undefined,
        NEXT_PUBLIC_BASE_URL: undefined,
        LINE_WEBHOOK_PROXY_SHARED_SECRET: 'shared-secret-1',
    }, () => {
        assert.deepEqual(getLineWebhookIngressConfig(), {
            publicUrl: null,
            proxySharedSecret: 'shared-secret-1',
            proxySecretHeader: LINE_WEBHOOK_PROXY_SECRET_HEADER,
        });
    });
});

test('verifyLineWebhookProxySecret enforces optional shared secret with constant-time compare', () => {
    assert.equal(verifyLineWebhookProxySecret(null, null), true);
    assert.equal(isLineWebhookProxyProtectionEnabled(null), false);

    assert.equal(isLineWebhookProxyProtectionEnabled('shared-secret-1'), true);
    assert.equal(verifyLineWebhookProxySecret('shared-secret-1', 'shared-secret-1'), true);
    assert.equal(verifyLineWebhookProxySecret('shared-secret-2', 'shared-secret-1'), false);
    assert.equal(verifyLineWebhookProxySecret(null, 'shared-secret-1'), false);
});
