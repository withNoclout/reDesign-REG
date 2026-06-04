import { fetchLineUserProfile, issueLineLinkToken, replyLineMessage } from './lineMessaging.js';
import {
    buildLinePairingReply,
    extractLineLinkingCodeFromMessage,
    linkLineAccountFromPairingCode,
} from './lineLinkingService.js';
import { createLineWebhookStore } from './lineWebhookStore.js';

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeTimestampFromMillis(value) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return new Date().toISOString();
    return new Date(timestamp).toISOString();
}

function extractSourceIds(source) {
    if (!source || typeof source !== 'object') {
        return { lineUserId: null, groupId: null, roomId: null };
    }

    return {
        lineUserId: readString(source.userId),
        groupId: readString(source.groupId),
        roomId: readString(source.roomId),
    };
}

async function safeLoadProfile(lineUserId, loadProfile) {
    if (!lineUserId || typeof loadProfile !== 'function') return null;

    try {
        return await loadProfile(lineUserId);
    } catch (cause) {
        console.warn('[lineWebhook] Failed to hydrate LINE profile:', cause);
        return null;
    }
}

async function handleLineLinkCommand(event, { store, issueLinkTokenFn, replyMessage }) {
    const pairingCode = extractLineLinkingCodeFromMessage(event?.message?.text);
    if (!pairingCode) return null;

    const { lineUserId } = extractSourceIds(event?.source);
    const result = await linkLineAccountFromPairingCode({ pairingCode, lineUserId }, {
        findLinkRequestByPairingCode: store.findLinkRequestByPairingCode,
        getLinkedAccountForUser: store.getLinkedAccountForUser,
        getAccount: store.getAccount,
        issueLinkToken: issueLinkTokenFn,
    });

    const replyToken = readString(event?.replyToken);
    if (replyToken) {
        await replyMessage(replyToken, buildLinePairingReply(result));
    }

    return {
        status: result.status === 'linked' || result.status === 'already-linked' ? 'processed' : 'ignored',
        detail: result,
    };
}

async function handleLineWebhookEvent(event, dependencies) {
    const { store, loadProfile, issueLinkTokenFn, replyMessage } = dependencies;
    const eventType = readString(event?.type) || 'unknown';
    const occurredAt = normalizeTimestampFromMillis(event?.timestamp);
    const { lineUserId } = extractSourceIds(event?.source);

    switch (eventType) {
    case 'follow': {
        if (!lineUserId) {
            return { status: 'ignored', reason: 'missing_line_user_id' };
        }

        const profile = await safeLoadProfile(lineUserId, loadProfile);
        await store.markFollowed({ lineUserId, profile, occurredAt });
        return { status: 'processed', lineUserId };
    }
    case 'unfollow': {
        if (!lineUserId) {
            return { status: 'ignored', reason: 'missing_line_user_id' };
        }

        await store.markUnfollowed({ lineUserId, occurredAt });
        return { status: 'processed', lineUserId };
    }
    case 'accountLink': {
        const nonce = readString(event?.link?.nonce);
        const result = readString(event?.link?.result);
        const profile = result === 'ok' ? await safeLoadProfile(lineUserId, loadProfile) : null;
        const linkResult = await store.completeLinkRequest({
            nonce,
            lineUserId,
            result,
            profile,
            occurredAt,
        });

        return {
            status: linkResult.status === 'linked' ? 'processed' : 'ignored',
            lineUserId,
            detail: linkResult,
        };
    }
    case 'message': {
        if (!lineUserId) {
            return { status: 'ignored', reason: 'missing_line_user_id' };
        }

        const profile = await safeLoadProfile(lineUserId, loadProfile);
        await store.touchConversation({ lineUserId, profile, occurredAt });

        if (event?.message?.type === 'text') {
            const linkingResult = await handleLineLinkCommand(event, { store, issueLinkTokenFn, replyMessage });
            if (linkingResult) {
                return { ...linkingResult, lineUserId };
            }
        }

        return { status: 'processed', lineUserId };
    }
    case 'postback': {
        if (!lineUserId) {
            return { status: 'ignored', reason: 'missing_line_user_id' };
        }

        await store.touchConversation({ lineUserId, profile: null, occurredAt });
        return { status: 'processed', lineUserId };
    }
    default:
        return { status: 'ignored', reason: `unsupported_event_type:${eventType}` };
    }
}

function buildEventAuditPayload(event, status, errorMessage = null) {
    const { lineUserId, groupId, roomId } = extractSourceIds(event?.source);

    return {
        webhookEventId: readString(event?.webhookEventId),
        eventType: readString(event?.type) || 'unknown',
        mode: readString(event?.mode),
        lineUserId,
        groupId,
        roomId,
        isRedelivery: Boolean(event?.deliveryContext?.isRedelivery),
        occurredAt: normalizeTimestampFromMillis(event?.timestamp),
        processedAt: new Date().toISOString(),
        status,
        errorMessage,
        payload: event && typeof event === 'object' ? event : {},
    };
}

export function parseLineWebhookEnvelope(rawBody) {
    let body;
    try {
        body = JSON.parse(rawBody);
    } catch {
        throw new Error('LINE webhook payload is not valid JSON');
    }

    if (!body || typeof body !== 'object') {
        throw new Error('LINE webhook payload must be a JSON object');
    }

    if (!Array.isArray(body.events)) {
        throw new Error('LINE webhook payload must include an events array');
    }

    return body;
}

export async function processLineWebhookEnvelope(envelope, {
    store = createLineWebhookStore(),
    loadProfile = fetchLineUserProfile,
    issueLinkTokenFn = issueLineLinkToken,
    replyMessage = replyLineMessage,
} = {}) {
    const events = Array.isArray(envelope?.events) ? envelope.events : [];
    const results = [];
    let processedCount = 0;
    let ignoredCount = 0;
    let failedCount = 0;

    for (const event of events) {
        let status = 'processed';
        let detail = null;
        let errorMessage = null;

        try {
            const result = await handleLineWebhookEvent(event, { store, loadProfile, issueLinkTokenFn, replyMessage });
            status = result.status;
            detail = result.detail || null;
            if (status === 'processed') {
                processedCount += 1;
            } else {
                ignoredCount += 1;
            }
        } catch (cause) {
            status = 'failed';
            failedCount += 1;
            errorMessage = cause instanceof Error ? cause.message : 'Unknown LINE webhook processing error';
        }

        await store.recordEvent(buildEventAuditPayload(event, status, errorMessage));
        results.push({
            webhookEventId: readString(event?.webhookEventId),
            eventType: readString(event?.type) || 'unknown',
            status,
            errorMessage,
            detail,
        });
    }

    return {
        destination: readString(envelope?.destination),
        processedCount,
        ignoredCount,
        failedCount,
        events: results,
    };
}
