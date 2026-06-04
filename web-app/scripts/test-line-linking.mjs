import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildLineAccountLinkUrl,
    buildLinePairingReply,
    ensureLinePairingSession,
    extractLineLinkingCodeFromMessage,
    linkLineAccountFromPairingCode,
    sanitizeLinePairingCode,
    sanitizeLineUserId,
    startLineAccountLinking,
} from '../lib/lineLinkingService.js';

test('sanitizeLineUserId strips unsafe markup and bounds length', () => {
    assert.equal(sanitizeLineUserId('  <b>U123</b>  '), 'U123');
    assert.equal(sanitizeLineUserId(''), null);
    assert.equal(sanitizeLineUserId(null), null);
});

test('sanitizeLinePairingCode normalizes casing and punctuation', () => {
    assert.equal(sanitizeLinePairingCode(' ab-c123 '), 'ABC123');
    assert.equal(sanitizeLinePairingCode(''), null);
});

test('buildLineAccountLinkUrl builds the expected LINE linking endpoint', () => {
    const url = buildLineAccountLinkUrl({ linkToken: 'token-1', nonce: 'nonce-1' });
    assert.equal(
        url,
        'https://access.line.me/dialog/bot/accountLink?linkToken=token-1&nonce=nonce-1'
    );
});

test('extractLineLinkingCodeFromMessage parses supported command forms', () => {
    assert.equal(extractLineLinkingCodeFromMessage('link abcd1234'), 'ABCD1234');
    assert.equal(extractLineLinkingCodeFromMessage('ผูกบัญชี ZXCV5678'), 'ZXCV5678');
    assert.equal(extractLineLinkingCodeFromMessage('hello there'), null);
});

test('startLineAccountLinking returns existing link state for already linked accounts', async () => {
    const result = await startLineAccountLinking({ userCode: '6701091611290', lineUserId: 'U123' }, {
        getAccount: async () => ({
            lineUserId: 'U123',
            userCode: '6701091611290',
            displayName: 'Alice',
            friendshipStatus: 'following',
            linkStatus: 'linked',
        }),
        issueLinkToken: async () => {
            throw new Error('should not issue token');
        },
        createLinkRequest: async () => {
            throw new Error('should not create request');
        },
    });

    assert.deepEqual(result, {
        alreadyLinked: true,
        userCode: '6701091611290',
        lineUserId: 'U123',
        displayName: 'Alice',
        linkUrl: null,
        nonce: null,
        expiresAt: null,
    });
});

test('startLineAccountLinking creates a pending link request and URL for an unlinked follower', async () => {
    const createdRequests = [];
    const result = await startLineAccountLinking({ userCode: '6701091611290', lineUserId: 'U123' }, {
        getAccount: async () => ({
            lineUserId: 'U123',
            userCode: null,
            displayName: 'Alice',
            friendshipStatus: 'following',
            linkStatus: 'unlinked',
        }),
        issueLinkToken: async (lineUserId) => {
            assert.equal(lineUserId, 'U123');
            return { linkToken: 'issued-link-token' };
        },
        createLinkRequest: async (payload) => {
            createdRequests.push(payload);
        },
        now: () => Date.parse('2026-06-03T12:00:00.000Z'),
    });

    assert.equal(result.alreadyLinked, false);
    assert.equal(result.userCode, '6701091611290');
    assert.equal(result.lineUserId, 'U123');
    assert.equal(result.displayName, 'Alice');
    assert.match(result.nonce, /^[A-Za-z0-9_-]{20,}$/);
    assert.equal(result.expiresAt, '2026-06-03T12:10:00.000Z');
    assert.equal(
        result.linkUrl,
        `https://access.line.me/dialog/bot/accountLink?linkToken=issued-link-token&nonce=${result.nonce}`
    );
    assert.equal(createdRequests[0].nonce, result.nonce);
    assert.equal(createdRequests[0].userCode, '6701091611290');
    assert.equal(createdRequests[0].expiresAt, '2026-06-03T12:10:00.000Z');
    assert.match(createdRequests[0].pairingCode, /^[A-Z0-9]{8}$/);
});

test('ensureLinePairingSession reuses an active pending request', async () => {
    const result = await ensureLinePairingSession({ userCode: '6701091611290' }, {
        findPendingLinkRequestForUser: async () => ({
            nonce: 'nonce-1',
            pairingCode: 'PAIR1234',
            expiresAt: '2026-06-03T12:10:00.000Z',
            status: 'pending',
        }),
        createLinkRequest: async () => {
            throw new Error('should not create request');
        },
        now: () => Date.parse('2026-06-03T12:00:00.000Z'),
    });

    assert.deepEqual(result, {
        userCode: '6701091611290',
        pairingCode: 'PAIR1234',
        nonce: 'nonce-1',
        expiresAt: '2026-06-03T12:10:00.000Z',
        reused: true,
    });
});

test('linkLineAccountFromPairingCode issues an account link URL for a valid pending code', async () => {
    const result = await linkLineAccountFromPairingCode({ pairingCode: 'pair1234', lineUserId: 'U555' }, {
        findLinkRequestByPairingCode: async (pairingCode) => {
            assert.equal(pairingCode, 'PAIR1234');
            return {
                nonce: 'nonce-1',
                pairingCode: 'PAIR1234',
                userCode: '6701091611290',
                status: 'pending',
                expiresAt: '2026-06-03T12:10:00.000Z',
            };
        },
        getLinkedAccountForUser: async () => null,
        getAccount: async () => ({ lineUserId: 'U555', linkStatus: 'unlinked', friendshipStatus: 'following' }),
        issueLinkToken: async (lineUserId) => {
            assert.equal(lineUserId, 'U555');
            return { linkToken: 'link-token-1' };
        },
        now: () => Date.parse('2026-06-03T12:00:00.000Z'),
    });

    assert.deepEqual(result, {
        status: 'linked',
        pairingCode: 'PAIR1234',
        request: {
            nonce: 'nonce-1',
            pairingCode: 'PAIR1234',
            userCode: '6701091611290',
            status: 'pending',
            expiresAt: '2026-06-03T12:10:00.000Z',
        },
        linkUrl: 'https://access.line.me/dialog/bot/accountLink?linkToken=link-token-1&nonce=nonce-1',
        expiresAt: '2026-06-03T12:10:00.000Z',
    });
});

test('buildLinePairingReply formats reply text for a successful link command', () => {
    const reply = buildLinePairingReply({
        status: 'linked',
        pairingCode: 'PAIR1234',
        linkUrl: 'https://example.com/link',
        expiresAt: '2026-06-03T12:10:00.000Z',
    });

    assert.equal(reply.length, 1);
    assert.equal(reply[0].type, 'text');
    assert.match(reply[0].text, /PAIR1234/);
    assert.match(reply[0].text, /https:\/\/example.com\/link/);
});
