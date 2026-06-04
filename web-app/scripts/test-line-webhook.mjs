import assert from 'node:assert/strict';
import test from 'node:test';

import {
    computeLineWebhookSignature,
    normalizeLineUserProfile,
    verifyLineWebhookSignature,
} from '../lib/lineMessaging.js';
import {
    parseLineWebhookEnvelope,
    processLineWebhookEnvelope,
} from '../lib/lineWebhookService.js';

function createFakeStore() {
    const calls = {
        getAccount: [],
        getLinkedAccountForUser: [],
        findLinkRequestByPairingCode: [],
        markFollowed: [],
        markUnfollowed: [],
        touchConversation: [],
        completeLinkRequest: [],
        recordEvent: [],
    };

    return {
        calls,
        store: {
            async getAccount(lineUserId) {
                calls.getAccount.push(lineUserId);
                return { lineUserId, linkStatus: 'unlinked', friendshipStatus: 'following' };
            },
            async getLinkedAccountForUser(userCode) {
                calls.getLinkedAccountForUser.push(userCode);
                return null;
            },
            async findLinkRequestByPairingCode(pairingCode) {
                calls.findLinkRequestByPairingCode.push(pairingCode);
                if (pairingCode === 'PAIR1234') {
                    return {
                        nonce: 'nonce-1',
                        pairingCode: 'PAIR1234',
                        userCode: '6701091611290',
                        status: 'pending',
                        expiresAt: '2099-06-03T12:10:00.000Z',
                    };
                }
                return null;
            },
            async markFollowed(payload) {
                calls.markFollowed.push(payload);
            },
            async markUnfollowed(payload) {
                calls.markUnfollowed.push(payload);
            },
            async touchConversation(payload) {
                calls.touchConversation.push(payload);
            },
            async completeLinkRequest(payload) {
                calls.completeLinkRequest.push(payload);
                return { status: 'linked', userCode: '6701091611290' };
            },
            async recordEvent(payload) {
                calls.recordEvent.push(payload);
            },
        },
    };
}

test('verifyLineWebhookSignature accepts valid signatures and rejects invalid ones', () => {
    const rawBody = JSON.stringify({ events: [] });
    const secret = 'super-secret';
    const validSignature = computeLineWebhookSignature(rawBody, secret);

    assert.equal(verifyLineWebhookSignature(rawBody, validSignature, secret), true);
    assert.equal(verifyLineWebhookSignature(rawBody, 'bad-signature', secret), false);
    assert.equal(verifyLineWebhookSignature(rawBody, validSignature, 'wrong-secret'), false);
});

test('normalizeLineUserProfile strips unsafe values and invalid URLs', () => {
    assert.deepEqual(normalizeLineUserProfile({
        displayName: '  <b>Alice</b>  ',
        pictureUrl: 'javascript:alert(1)',
        language: ' th ',
        statusMessage: '<script>x</script>Hello',
    }), {
        displayName: 'Alice',
        pictureUrl: null,
        language: 'th',
        statusMessage: 'xHello',
    });
});

test('parseLineWebhookEnvelope rejects malformed payloads', () => {
    assert.throws(() => parseLineWebhookEnvelope('{'), /not valid JSON/);
    assert.throws(() => parseLineWebhookEnvelope(JSON.stringify({})), /events array/);
});

test('processLineWebhookEnvelope handles follow, account link, unfollow, and ignores unsupported events', async () => {
    const { store, calls } = createFakeStore();
    const profileLoads = [];
    const envelope = {
        destination: 'bot-destination',
        events: [
            {
                type: 'follow',
                webhookEventId: 'evt-follow',
                timestamp: Date.parse('2026-06-03T12:00:00.000Z'),
                source: { type: 'user', userId: 'U123' },
                deliveryContext: { isRedelivery: false },
            },
            {
                type: 'accountLink',
                webhookEventId: 'evt-link',
                timestamp: Date.parse('2026-06-03T12:01:00.000Z'),
                source: { type: 'user', userId: 'U123' },
                link: { result: 'ok', nonce: 'nonce-1' },
                deliveryContext: { isRedelivery: false },
            },
            {
                type: 'unfollow',
                webhookEventId: 'evt-unfollow',
                timestamp: Date.parse('2026-06-03T12:02:00.000Z'),
                source: { type: 'user', userId: 'U123' },
                deliveryContext: { isRedelivery: true },
            },
            {
                type: 'join',
                webhookEventId: 'evt-ignored',
                timestamp: Date.parse('2026-06-03T12:03:00.000Z'),
                source: { type: 'group', groupId: 'C456' },
                deliveryContext: { isRedelivery: false },
            },
        ],
    };

    const result = await processLineWebhookEnvelope(envelope, {
        store,
        loadProfile: async (lineUserId) => {
            profileLoads.push(lineUserId);
            return {
                displayName: 'Alice',
                pictureUrl: 'https://example.com/alice.png',
                language: 'th',
                statusMessage: 'พร้อมใช้งาน',
            };
        },
    });

    assert.equal(result.processedCount, 3);
    assert.equal(result.ignoredCount, 1);
    assert.equal(result.failedCount, 0);
    assert.deepEqual(profileLoads, ['U123', 'U123']);
    assert.equal(calls.markFollowed.length, 1);
    assert.equal(calls.completeLinkRequest.length, 1);
    assert.equal(calls.markUnfollowed.length, 1);
    assert.equal(calls.recordEvent.length, 4);
    assert.deepEqual(calls.recordEvent.map((item) => item.status), ['processed', 'processed', 'processed', 'ignored']);
});

test('processLineWebhookEnvelope handles text link commands and replies with an account-link URL', async () => {
    const { store, calls } = createFakeStore();
    const replies = [];
    const issued = [];

    const result = await processLineWebhookEnvelope({
        destination: 'bot-destination',
        events: [{
            type: 'message',
            webhookEventId: 'evt-message-link',
            replyToken: 'reply-token-1',
            timestamp: Date.parse('2026-06-03T12:00:00.000Z'),
            source: { type: 'user', userId: 'U123' },
            message: { type: 'text', text: 'link pair1234' },
            deliveryContext: { isRedelivery: false },
        }],
    }, {
        store,
        loadProfile: async () => ({
            displayName: 'Alice',
            pictureUrl: 'https://example.com/alice.png',
            language: 'th',
            statusMessage: 'พร้อมใช้งาน',
        }),
        issueLinkTokenFn: async (lineUserId) => {
            issued.push(lineUserId);
            return { linkToken: 'token-1' };
        },
        replyMessage: async (replyToken, messages) => {
            replies.push({ replyToken, messages });
        },
    });

    assert.equal(result.processedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.equal(calls.touchConversation.length, 1);
    assert.deepEqual(calls.findLinkRequestByPairingCode, ['PAIR1234']);
    assert.deepEqual(calls.getAccount, ['U123']);
    assert.deepEqual(calls.getLinkedAccountForUser, ['6701091611290']);
    assert.deepEqual(issued, ['U123']);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].replyToken, 'reply-token-1');
    assert.match(replies[0].messages[0].text, /PAIR1234/);
    assert.match(replies[0].messages[0].text, /token-1/);
});
