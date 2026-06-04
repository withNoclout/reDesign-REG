import { ensureLinePairingSession, isLineLinkRequestExpired } from './lineLinkingService.js';
import {
    buildLineOaAddFriendUrl,
    buildLineOaMessageUrl,
    buildLineShareTextUrl,
    getLineMessagingConfig,
    getMissingLineMessagingConfig,
    isLinePushConfigured,
    isLineWebhookConfigured,
} from './lineMessaging.js';
import { getLineWebhookReadiness } from './lineWebhookReadiness.js';

import { createLineWebhookStore } from './lineWebhookStore.js';

function sanitizeSummaryAccount(account) {
    if (!account) return null;
    return {
        lineUserId: account.lineUserId,
        displayName: account.displayName,
        pictureUrl: account.pictureUrl,
        friendshipStatus: account.friendshipStatus,
        linkStatus: account.linkStatus,
        lastLinkedAt: account.lastLinkedAt,
        lastUnlinkedAt: account.lastUnlinkedAt,
        lastWebhookAt: account.lastWebhookAt,
        lastMessageAt: account.lastMessageAt,
    };
}

function sanitizePendingRequest(request) {
    if (!request) return null;
    return {
        pairingCode: request.pairingCode,
        expiresAt: request.expiresAt,
        createdAt: request.createdAt,
        reused: false,
    };
}

function buildInstructionPayload(pairingCode) {
    const config = getLineMessagingConfig();
    const primaryCommand = pairingCode ? `link ${pairingCode}` : null;
    const secondaryCommand = pairingCode ? `ผูกบัญชี ${pairingCode}` : null;
    const addFriendUrl = config.officialAccountAddFriendUrl || buildLineOaAddFriendUrl(config.officialAccountBasicId);
    const openChatUrl = primaryCommand
        ? (config.officialAccountBasicId
            ? buildLineOaMessageUrl({ basicId: config.officialAccountBasicId, text: primaryCommand })
            : buildLineShareTextUrl(primaryCommand))
        : null;

    return {
        commandExamples: [
            'link <code>',
            'ผูกบัญชี <code>',
        ],
        note: addFriendUrl
            ? 'กดเปิด LINE OA ได้จากหน้านี้ หรือคัดลอกคำสั่งพร้อมส่งไปวางใน LINE บนมือถือหรือ Mac/PC ได้ทันที'
            : 'เพิ่ม LINE OA เป็นเพื่อนก่อน จากนั้นคัดลอกคำสั่งพร้อมส่งไปวางในแชต LINE เพื่อรับลิงก์ยืนยันการเชื่อมบัญชี',
        commands: {
            primary: primaryCommand,
            secondary: secondaryCommand,
        },
        quickActions: {
            addFriendUrl,
            openChatUrl,
        },
    };
}

function createLineWebhookNotReadyError(readiness) {
    const primaryIssue = Array.isArray(readiness?.issues)
        ? readiness.issues.find((issue) => issue.severity === 'blocking') || readiness.issues[0]
        : null;
    const error = new Error(primaryIssue?.message || 'LINE webhook is not ready');
    error.code = 'LINE_WEBHOOK_NOT_READY';
    error.readiness = readiness;
    return error;
}



export async function getLineSettingsSummary(
    userCode,
    { store = createLineWebhookStore(), getReadiness = getLineWebhookReadiness } = {}
) {
    const [linkedAccount, pendingRequest, recentEvents] = await Promise.all([
        store.getLinkedAccountForUser(userCode),
        store.findPendingLinkRequestForUser(userCode),
        typeof store.listRecentEvents === 'function' ? store.listRecentEvents(5) : [],
    ]);

    const activePendingRequest = pendingRequest && !isLineLinkRequestExpired(pendingRequest) ? pendingRequest : null;
    const activePairingCode = activePendingRequest?.pairingCode || null;
    const readiness = await getReadiness({ recentEvents });

    return {
        configured: isLineWebhookConfigured(),
        pushConfigured: isLinePushConfigured(),
        missingConfig: getMissingLineMessagingConfig({ requireAccessToken: true }),
        readiness,
        linked: Boolean(linkedAccount),
        account: sanitizeSummaryAccount(linkedAccount),
        pendingLinkRequest: sanitizePendingRequest(activePendingRequest),
        instructions: buildInstructionPayload(activePairingCode),
    };
}

export async function createLinePairingSession(
    userCode,
    { store = createLineWebhookStore(), getReadiness = getLineWebhookReadiness } = {}
) {
    const recentEvents = typeof store.listRecentEvents === 'function' ? await store.listRecentEvents(5) : [];
    const readiness = await getReadiness({ recentEvents });
    if (!readiness.ready) {
        throw createLineWebhookNotReadyError(readiness);
    }

    const session = await ensureLinePairingSession({ userCode }, {
        findPendingLinkRequestForUser: store.findPendingLinkRequestForUser,
        createLinkRequest: store.createLinkRequest,
    });

    return {
        pairingCode: session.pairingCode,
        expiresAt: session.expiresAt,
        reused: session.reused,
    };
}


export async function unlinkLineAccount(userCode, { store = createLineWebhookStore() } = {}) {
    const account = await store.unlinkAccountForUser(userCode);
    return {
        unlinked: Boolean(account),
        account: sanitizeSummaryAccount(account),
    };
}
