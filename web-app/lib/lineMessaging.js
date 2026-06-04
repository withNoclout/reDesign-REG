import crypto from 'node:crypto';
import { stripHtml } from './sanitize.js';

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function sanitizeLineText(value, maxLength = 255) {
    const normalized = readString(stripHtml(value));
    if (!normalized) return null;
    return normalized.slice(0, maxLength);
}

function sanitizeUrl(value) {
    const normalized = readString(value);
    if (!normalized) return null;

    try {
        const url = new URL(normalized);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        return url.toString();
    } catch {
        return null;
    }
}

function sanitizeLineOaBasicId(value) {
    const normalized = readString(value);
    if (!normalized) return null;
    const withPrefix = normalized.startsWith('@') ? normalized : `@${normalized}`;
    return /^@[A-Za-z0-9._-]{3,64}$/.test(withPrefix) ? withPrefix : null;
}

export function buildLineOaAddFriendUrl(basicId) {
    const normalizedBasicId = sanitizeLineOaBasicId(basicId);
    if (!normalizedBasicId) return null;
    return `https://line.me/R/ti/p/${encodeURIComponent(normalizedBasicId)}`;
}

export function buildLineOaMessageUrl({ basicId, text }) {
    const normalizedBasicId = sanitizeLineOaBasicId(basicId);
    const normalizedText = sanitizeLineText(text, 500);
    if (!normalizedBasicId || !normalizedText) return null;
    return `https://line.me/R/oaMessage/${encodeURIComponent(normalizedBasicId)}/?${encodeURIComponent(normalizedText)}`;
}

export function buildLineShareTextUrl(text) {
    const normalizedText = sanitizeLineText(text, 500);
    if (!normalizedText) return null;
    return `https://line.me/R/share?text=${encodeURIComponent(normalizedText)}`;
}


function normalizeLineMessage(message) {
    if (!message || typeof message !== 'object') return null;
    if (message.type !== 'text') return null;
    const text = sanitizeLineText(message.text, 5000);
    return text ? { type: 'text', text } : null;
}

export function getLineMessagingConfig() {
    return {
        channelId: readString(process.env.LINE_CHANNEL_ID),
        channelSecret: readString(process.env.LINE_CHANNEL_SECRET),
        channelAccessToken: readString(process.env.LINE_CHANNEL_ACCESS_TOKEN),
        officialAccountBasicId: sanitizeLineOaBasicId(process.env.LINE_OA_BASIC_ID),
        officialAccountAddFriendUrl: sanitizeUrl(process.env.LINE_OA_ADD_FRIEND_URL),
    };
}

export function getMissingLineMessagingConfig({ requireAccessToken = false } = {}) {
    const config = getLineMessagingConfig();
    const missing = [];

    if (!config.channelSecret) missing.push('LINE_CHANNEL_SECRET');
    if (requireAccessToken && !config.channelAccessToken) missing.push('LINE_CHANNEL_ACCESS_TOKEN');

    return missing;
}

export function isLineWebhookConfigured() {
    return getMissingLineMessagingConfig().length === 0;
}

export function isLinePushConfigured() {
    return getMissingLineMessagingConfig({ requireAccessToken: true }).length === 0;
}

export function computeLineWebhookSignature(rawBody, channelSecret = getLineMessagingConfig().channelSecret) {
    const normalizedBody = typeof rawBody === 'string' ? rawBody : '';
    const normalizedSecret = readString(channelSecret);

    if (!normalizedSecret) {
        throw new Error('LINE channel secret is not configured');
    }

    return crypto
        .createHmac('sha256', normalizedSecret)
        .update(normalizedBody, 'utf8')
        .digest('base64');
}

export function verifyLineWebhookSignature(rawBody, signature, channelSecret = getLineMessagingConfig().channelSecret) {
    const normalizedSignature = readString(signature);
    const normalizedSecret = readString(channelSecret);
    if (!normalizedSignature || !normalizedSecret) return false;

    const expected = computeLineWebhookSignature(rawBody, normalizedSecret);
    const providedBuffer = Buffer.from(normalizedSignature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (providedBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export function normalizeLineUserProfile(profile) {
    if (!profile || typeof profile !== 'object') return null;

    return {
        displayName: sanitizeLineText(profile.displayName, 255),
        pictureUrl: sanitizeUrl(profile.pictureUrl),
        language: sanitizeLineText(profile.language, 32),
        statusMessage: sanitizeLineText(profile.statusMessage, 500),
    };
}

export async function issueLineLinkToken(lineUserId, { channelAccessToken = getLineMessagingConfig().channelAccessToken } = {}) {
    const normalizedUserId = sanitizeLineText(lineUserId, 128);
    const normalizedAccessToken = readString(channelAccessToken);

    if (!normalizedUserId) {
        throw new Error('LINE user ID is required to issue a link token');
    }

    if (!normalizedAccessToken) {
        throw new Error('LINE channel access token is not configured');
    }

    const response = await fetch(`https://api.line.me/v2/bot/user/${encodeURIComponent(normalizedUserId)}/linkToken`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${normalizedAccessToken}`,
        },
        cache: 'no-store',
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Failed to issue LINE link token (${response.status}): ${message || response.statusText}`);
    }

    const body = await response.json();
    return {
        linkToken: sanitizeLineText(body?.linkToken, 255),
    };
}

export async function replyLineMessage(replyToken, messages, { channelAccessToken = getLineMessagingConfig().channelAccessToken } = {}) {
    const normalizedReplyToken = sanitizeLineText(replyToken, 255);
    const normalizedAccessToken = readString(channelAccessToken);
    const normalizedMessages = (Array.isArray(messages) ? messages : [messages])
        .map((message) => normalizeLineMessage(message))
        .filter(Boolean)
        .slice(0, 5);

    if (!normalizedReplyToken) {
        throw new Error('LINE reply token is required');
    }

    if (!normalizedAccessToken) {
        throw new Error('LINE channel access token is not configured');
    }

    if (normalizedMessages.length === 0) {
        throw new Error('At least one valid LINE reply message is required');
    }

    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${normalizedAccessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            replyToken: normalizedReplyToken,
            messages: normalizedMessages,
        }),
        cache: 'no-store',
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Failed to reply to LINE message (${response.status}): ${message || response.statusText}`);
    }

    return { ok: true };
}

export async function fetchLineUserProfile(lineUserId, { channelAccessToken = getLineMessagingConfig().channelAccessToken } = {}) {
    const normalizedUserId = sanitizeLineText(lineUserId, 128);
    const normalizedAccessToken = readString(channelAccessToken);

    if (!normalizedUserId) {
        throw new Error('LINE user ID is required to fetch a profile');
    }

    if (!normalizedAccessToken) {
        throw new Error('LINE channel access token is not configured');
    }

    const response = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(normalizedUserId)}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${normalizedAccessToken}`,
        },
        cache: 'no-store',
    });

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Failed to fetch LINE profile (${response.status}): ${message || response.statusText}`);
    }

    const body = await response.json();
    return normalizeLineUserProfile(body);
}
