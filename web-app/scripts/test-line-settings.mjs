import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildLineOaAddFriendUrl,
    buildLineOaMessageUrl,
    buildLineShareTextUrl,
} from '../lib/lineMessaging.js';
import { createLinePairingSession, getLineSettingsSummary } from '../lib/lineSettingsService.js';

const READY_WEBHOOK = async ({ recentEvents = [] } = {}) => ({
    ready: true,
    state: recentEvents.length > 0 ? 'ready' : 'warning',
    webhookUrl: 'https://redesign-reg.kmutnb.ac.th/api/line/webhook',
    host: 'redesign-reg.kmutnb.ac.th',
    dnsAddresses: ['203.0.113.20'],
    issues: recentEvents.length > 0 ? [] : [{
        code: 'no-webhook-events-observed',
        severity: 'warning',
        message: 'ยังไม่พบ webhook event ล่าสุดในระบบ',
        recommendation: 'ส่งข้อความทดสอบหนึ่งครั้ง',
    }],
    checks: {
        channelSecret: true,
        channelAccessToken: true,
        webhookUrl: true,
        https: true,
        publicHost: true,
        dnsResolvable: true,
        recentWebhookEvent: recentEvents.length > 0,
    },
    telemetry: {
        recentEventCount: recentEvents.length,
        lastWebhookEventAt: recentEvents[0]?.processedAt || null,
        lastWebhookEventType: recentEvents[0]?.eventType || null,
        lastWebhookEventStatus: recentEvents[0]?.status || null,
    },
});

function createStore(overrides = {}) {
    return {
        getLinkedAccountForUser: async () => null,
        findPendingLinkRequestForUser: async () => null,
        listRecentEvents: async () => [],
        createLinkRequest: async () => ({
            pairingCode: 'PAIR1234',
            expiresAt: '2099-06-03T12:10:00.000Z',
            reused: false,
        }),
        ...overrides,
    };
}

test('buildLineOaAddFriendUrl normalizes LINE OA basic IDs', () => {
    assert.equal(
        buildLineOaAddFriendUrl('linedevelopers'),
        'https://line.me/R/ti/p/%40linedevelopers'
    );
    assert.equal(
        buildLineOaAddFriendUrl('@reg_kmutnb'),
        'https://line.me/R/ti/p/%40reg_kmutnb'
    );
    assert.equal(buildLineOaAddFriendUrl(''), null);
});

test('buildLineOaMessageUrl encodes ready-to-send LINE messages', () => {
    assert.equal(
        buildLineOaMessageUrl({ basicId: '@reg_kmutnb', text: 'link AB12CD34' }),
        'https://line.me/R/oaMessage/%40reg_kmutnb/?link%20AB12CD34'
    );
    assert.equal(buildLineOaMessageUrl({ basicId: '', text: 'link TEST1234' }), null);
});

test('buildLineShareTextUrl encodes prefilled share messages', () => {
    assert.equal(
        buildLineShareTextUrl('link AB12CD34'),
        'https://line.me/R/share?text=link%20AB12CD34'
    );
    assert.equal(buildLineShareTextUrl(''), null);
});

test('getLineSettingsSummary returns quick commands and LINE OA shortcuts for active pairing codes', async () => {
    const previousBasicId = process.env.LINE_OA_BASIC_ID;
    const previousAddFriendUrl = process.env.LINE_OA_ADD_FRIEND_URL;
    const previousChannelSecret = process.env.LINE_CHANNEL_SECRET;
    const previousAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    process.env.LINE_OA_BASIC_ID = '@reg_kmutnb';
    delete process.env.LINE_OA_ADD_FRIEND_URL;
    process.env.LINE_CHANNEL_SECRET = 'secret';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'token';

    try {
        const summary = await getLineSettingsSummary('6701091611290', {
            store: createStore({
                findPendingLinkRequestForUser: async () => ({
                    pairingCode: 'PAIR1234',
                    expiresAt: '2099-06-03T12:10:00.000Z',
                    createdAt: '2099-06-03T12:00:00.000Z',
                    status: 'pending',
                }),
            }),
            getReadiness: READY_WEBHOOK,
        });

        assert.equal(summary.pendingLinkRequest?.pairingCode, 'PAIR1234');
        assert.equal(summary.instructions.commands.primary, 'link PAIR1234');
        assert.equal(summary.instructions.commands.secondary, 'ผูกบัญชี PAIR1234');
        assert.equal(
            summary.instructions.quickActions.addFriendUrl,
            'https://line.me/R/ti/p/%40reg_kmutnb'
        );
        assert.equal(
            summary.instructions.quickActions.openChatUrl,
            'https://line.me/R/oaMessage/%40reg_kmutnb/?link%20PAIR1234'
        );
        assert.match(summary.instructions.note, /Mac\/PC/);
    } finally {
        if (previousBasicId === undefined) delete process.env.LINE_OA_BASIC_ID;
        else process.env.LINE_OA_BASIC_ID = previousBasicId;

        if (previousAddFriendUrl === undefined) delete process.env.LINE_OA_ADD_FRIEND_URL;
        else process.env.LINE_OA_ADD_FRIEND_URL = previousAddFriendUrl;

        if (previousChannelSecret === undefined) delete process.env.LINE_CHANNEL_SECRET;
        else process.env.LINE_CHANNEL_SECRET = previousChannelSecret;

        if (previousAccessToken === undefined) delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
        else process.env.LINE_CHANNEL_ACCESS_TOKEN = previousAccessToken;
    }
});

test('getLineSettingsSummary falls back to generic LINE share link without OA basic ID', async () => {
    const previousBasicId = process.env.LINE_OA_BASIC_ID;
    const previousAddFriendUrl = process.env.LINE_OA_ADD_FRIEND_URL;
    const previousChannelSecret = process.env.LINE_CHANNEL_SECRET;
    const previousAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    delete process.env.LINE_OA_BASIC_ID;
    delete process.env.LINE_OA_ADD_FRIEND_URL;
    process.env.LINE_CHANNEL_SECRET = 'secret';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'token';

    try {
        const summary = await getLineSettingsSummary('6701091611290', {
            store: createStore({
                findPendingLinkRequestForUser: async () => ({
                    pairingCode: 'PAIR1234',
                    expiresAt: '2099-06-03T12:10:00.000Z',
                    createdAt: '2099-06-03T12:00:00.000Z',
                    status: 'pending',
                }),
            }),
            getReadiness: READY_WEBHOOK,
        });

        assert.equal(summary.instructions.quickActions.addFriendUrl, null);
        assert.equal(
            summary.instructions.quickActions.openChatUrl,
            'https://line.me/R/share?text=link%20PAIR1234'
        );
    } finally {
        if (previousBasicId === undefined) delete process.env.LINE_OA_BASIC_ID;
        else process.env.LINE_OA_BASIC_ID = previousBasicId;

        if (previousAddFriendUrl === undefined) delete process.env.LINE_OA_ADD_FRIEND_URL;
        else process.env.LINE_OA_ADD_FRIEND_URL = previousAddFriendUrl;

        if (previousChannelSecret === undefined) delete process.env.LINE_CHANNEL_SECRET;
        else process.env.LINE_CHANNEL_SECRET = previousChannelSecret;

        if (previousAccessToken === undefined) delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
        else process.env.LINE_CHANNEL_ACCESS_TOKEN = previousAccessToken;
    }
});

test('getLineSettingsSummary surfaces blocking webhook readiness issues', async () => {
    const summary = await getLineSettingsSummary('6701091611290', {
        store: createStore(),
        getReadiness: async () => ({
            ready: false,
            state: 'blocked',
            webhookUrl: 'https://redesign-reg.kmutnb.ac.th/api/line/webhook',
            host: 'redesign-reg.kmutnb.ac.th',
            dnsAddresses: [],
            issues: [{
                code: 'webhook-dns-unresolved',
                severity: 'blocking',
                message: 'DNS ของ redesign-reg.kmutnb.ac.th ยังไม่ resolve จาก runtime นี้',
                recommendation: 'ตรวจ DNS/Firewall/NAT',
            }],
            checks: {
                channelSecret: true,
                channelAccessToken: true,
                webhookUrl: true,
                https: true,
                publicHost: true,
                dnsResolvable: false,
                recentWebhookEvent: false,
            },
            telemetry: {
                recentEventCount: 0,
                lastWebhookEventAt: null,
                lastWebhookEventType: null,
                lastWebhookEventStatus: null,
            },
        }),
    });

    assert.equal(summary.readiness.ready, false);
    assert.equal(summary.readiness.issues[0].code, 'webhook-dns-unresolved');
});

test('createLinePairingSession rejects when webhook readiness is blocked', async () => {
    await assert.rejects(
        () => createLinePairingSession('6701091611290', {
            store: createStore(),
            getReadiness: async () => ({
                ready: false,
                state: 'blocked',
                issues: [{
                    code: 'webhook-private-host',
                    severity: 'blocking',
                    message: 'Webhook URL ใช้ host ภายในหรือ private host',
                    recommendation: 'เปลี่ยนเป็น public DNS name',
                }],
                telemetry: {},
            }),
        }),
        (error) => error?.code === 'LINE_WEBHOOK_NOT_READY'
            && /private host/.test(error.message)
    );
});
