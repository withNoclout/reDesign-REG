import crypto from 'node:crypto';
import { stripHtml } from './sanitize.js';

const LINE_LINK_TOKEN_TTL_MS = 10 * 60 * 1000;
const LINE_ACCOUNT_LINK_URL = 'https://access.line.me/dialog/bot/accountLink';
const PAIRING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PAIRING_CODE_LENGTH = 8;

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeUserCode(value) {
    const normalized = readString(value);
    return normalized ? normalized.replace(/^s/i, '') : null;
}

export function sanitizeLineUserId(value) {
    const normalized = readString(stripHtml(value));
    return normalized ? normalized.slice(0, 128) : null;
}

export function sanitizeLinePairingCode(value) {
    const normalized = readString(stripHtml(value));
    return normalized ? normalized.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) : null;
}

export function createLineLinkNonce() {
    return crypto.randomBytes(24).toString('base64url');
}

export function createLinePairingCode(length = PAIRING_CODE_LENGTH) {
    const targetLength = Number.isInteger(length) && length >= 6 ? length : PAIRING_CODE_LENGTH;
    const bytes = crypto.randomBytes(targetLength);
    let code = '';
    for (let index = 0; index < targetLength; index += 1) {
        code += PAIRING_CODE_ALPHABET[bytes[index] % PAIRING_CODE_ALPHABET.length];
    }
    return code;
}

export function createLineLinkExpiry(now = Date.now()) {
    return new Date(now + LINE_LINK_TOKEN_TTL_MS).toISOString();
}

export function isLineLinkRequestExpired(request, now = Date.now()) {
    const expiresAt = request?.expiresAt ? new Date(request.expiresAt).getTime() : NaN;
    return !Number.isFinite(expiresAt) || expiresAt <= Number(now);
}

export function buildLineAccountLinkUrl({ linkToken, nonce }) {
    const normalizedLinkToken = readString(linkToken);
    const normalizedNonce = readString(nonce);

    if (!normalizedLinkToken) {
        throw new Error('LINE link token is required to build the account-link URL');
    }

    if (!normalizedNonce) {
        throw new Error('LINE link nonce is required to build the account-link URL');
    }

    const url = new URL(LINE_ACCOUNT_LINK_URL);
    url.searchParams.set('linkToken', normalizedLinkToken);
    url.searchParams.set('nonce', normalizedNonce);
    return url.toString();
}

export async function startLineAccountLinking({ userCode, lineUserId }, {
    getAccount,
    issueLinkToken,
    createLinkRequest,
    now = Date.now,
} = {}) {
    const normalizedUserCode = normalizeUserCode(userCode);
    const normalizedLineUserId = sanitizeLineUserId(lineUserId);

    if (!normalizedUserCode) {
        throw new Error('User code is required to start LINE account linking');
    }

    if (!normalizedLineUserId) {
        throw new Error('LINE user ID is required to start account linking');
    }

    if (typeof getAccount !== 'function') {
        throw new Error('A LINE account lookup function is required to start account linking');
    }

    if (typeof issueLinkToken !== 'function') {
        throw new Error('A LINE link-token issuer is required to start account linking');
    }

    if (typeof createLinkRequest !== 'function') {
        throw new Error('A LINE link-request writer is required to start account linking');
    }

    const account = await getAccount(normalizedLineUserId);
    if (!account) {
        throw new Error('LINE account not found. Ask the user to add the OA or send a message first.');
    }

    if (account.friendshipStatus !== 'following') {
        throw new Error('This LINE account is not currently following the OA.');
    }

    if (account.linkStatus === 'linked' && account.userCode && account.userCode !== normalizedUserCode) {
        throw new Error('This LINE account is already linked to another user.');
    }

    if (account.linkStatus === 'linked' && account.userCode === normalizedUserCode) {
        return {
            alreadyLinked: true,
            userCode: normalizedUserCode,
            lineUserId: normalizedLineUserId,
            displayName: account.displayName || null,
            linkUrl: null,
            nonce: null,
            expiresAt: null,
        };
    }

    const issued = await issueLinkToken(normalizedLineUserId);
    const linkToken = readString(issued?.linkToken);
    if (!linkToken) {
        throw new Error('LINE did not return a link token');
    }

    const currentTime = Number(now());
    const nonce = createLineLinkNonce();
    const expiresAt = createLineLinkExpiry(currentTime);
    await createLinkRequest({
        nonce,
        userCode: normalizedUserCode,
        pairingCode: createLinePairingCode(),
        expiresAt,
    });

    return {
        alreadyLinked: false,
        userCode: normalizedUserCode,
        lineUserId: normalizedLineUserId,
        displayName: account.displayName || null,
        nonce,
        expiresAt,
        linkUrl: buildLineAccountLinkUrl({ linkToken, nonce }),
    };
}

export async function ensureLinePairingSession({ userCode }, {
    findPendingLinkRequestForUser,
    createLinkRequest,
    now = Date.now,
} = {}) {
    const normalizedUserCode = normalizeUserCode(userCode);
    if (!normalizedUserCode) {
        throw new Error('User code is required to create a LINE pairing session');
    }

    if (typeof findPendingLinkRequestForUser !== 'function') {
        throw new Error('A pending LINE link-request lookup function is required');
    }

    if (typeof createLinkRequest !== 'function') {
        throw new Error('A LINE link-request writer is required');
    }

    const activeRequest = await findPendingLinkRequestForUser(normalizedUserCode);
    if (activeRequest && !isLineLinkRequestExpired(activeRequest, now())) {
        return {
            userCode: normalizedUserCode,
            pairingCode: activeRequest.pairingCode,
            nonce: activeRequest.nonce,
            expiresAt: activeRequest.expiresAt,
            reused: true,
        };
    }

    const currentTime = Number(now());
    const request = await createLinkRequest({
        nonce: createLineLinkNonce(),
        userCode: normalizedUserCode,
        pairingCode: createLinePairingCode(),
        expiresAt: createLineLinkExpiry(currentTime),
    });

    return {
        userCode: normalizedUserCode,
        pairingCode: request.pairingCode,
        nonce: request.nonce,
        expiresAt: request.expiresAt,
        reused: false,
    };
}

export function extractLineLinkingCodeFromMessage(text) {
    const normalized = readString(stripHtml(text));
    if (!normalized) return null;

    const trimmed = normalized.trim();
    const patterns = [
        /^(?:link|bind)\s+([A-Z0-9-]{6,16})$/i,
        /^ผูกบัญชี\s+([A-Z0-9-]{6,16})$/i,
        /^เชื่อมบัญชี\s+([A-Z0-9-]{6,16})$/i,
    ];

    for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match) {
            return sanitizeLinePairingCode(match[1]);
        }
    }

    return null;
}

export function buildLinePairingReply({ status, pairingCode = null, linkUrl = null, expiresAt = null }) {
    if (status === 'linked') {
        return [{
            type: 'text',
            text: `พบรหัสเชื่อมบัญชี ${pairingCode} แล้ว\nแตะลิงก์นี้ใน LINE เพื่อยืนยันการเชื่อมต่อ:\n${linkUrl}${expiresAt ? `\nลิงก์หมดอายุ: ${new Date(expiresAt).toLocaleString('th-TH')}` : ''}`,
        }];
    }

    if (status === 'already-linked') {
        return [{
            type: 'text',
            text: 'บัญชี LINE นี้เชื่อมกับบัญชี REG ของคุณอยู่แล้ว',
        }];
    }

    if (status === 'linked-to-another-user') {
        return [{
            type: 'text',
            text: 'บัญชี LINE นี้เชื่อมกับผู้ใช้อื่นอยู่แล้ว กรุณายกเลิกการเชื่อมเดิมก่อน',
        }];
    }

    if (status === 'expired') {
        return [{
            type: 'text',
            text: 'รหัสเชื่อมบัญชีหมดอายุแล้ว กรุณากลับไปที่หน้า LINE Settings ในระบบและสร้างรหัสใหม่',
        }];
    }

    if (status === 'not-found') {
        return [{
            type: 'text',
            text: 'ไม่พบรหัสเชื่อมบัญชีนี้ กรุณาตรวจสอบอีกครั้งหรือสร้างรหัสใหม่จากหน้า LINE Settings',
        }];
    }

    return [{
        type: 'text',
        text: 'ไม่สามารถเริ่มเชื่อมบัญชี LINE ได้ในขณะนี้ กรุณาลองใหม่อีกครั้งจากหน้า LINE Settings',
    }];
}

export async function linkLineAccountFromPairingCode({ pairingCode, lineUserId }, {
    findLinkRequestByPairingCode,
    getLinkedAccountForUser,
    getAccount,
    issueLinkToken,
    now = Date.now,
} = {}) {
    const normalizedPairingCode = sanitizeLinePairingCode(pairingCode);
    const normalizedLineUserId = sanitizeLineUserId(lineUserId);

    if (!normalizedPairingCode || !normalizedLineUserId) {
        return { status: 'not-found', pairingCode: normalizedPairingCode };
    }

    const request = await findLinkRequestByPairingCode(normalizedPairingCode);
    if (!request || request.status !== 'pending') {
        return { status: 'not-found', pairingCode: normalizedPairingCode };
    }

    if (isLineLinkRequestExpired(request, now())) {
        return {
            status: 'expired',
            pairingCode: normalizedPairingCode,
            request,
        };
    }

    const currentAccount = await getAccount(normalizedLineUserId);
    if (currentAccount?.linkStatus === 'linked' && currentAccount.userCode === request.userCode) {
        return { status: 'already-linked', pairingCode: normalizedPairingCode, request };
    }

    if (currentAccount?.linkStatus === 'linked' && currentAccount.userCode && currentAccount.userCode !== request.userCode) {
        return { status: 'linked-to-another-user', pairingCode: normalizedPairingCode, request };
    }

    const existingLinkedAccount = await getLinkedAccountForUser(request.userCode);
    if (existingLinkedAccount?.lineUserId && existingLinkedAccount.lineUserId !== normalizedLineUserId) {
        return { status: 'linked-to-another-user', pairingCode: normalizedPairingCode, request };
    }

    const issued = await issueLinkToken(normalizedLineUserId);
    const linkToken = readString(issued?.linkToken);
    if (!linkToken) {
        throw new Error('LINE did not return a link token');
    }

    return {
        status: 'linked',
        pairingCode: normalizedPairingCode,
        request,
        linkUrl: buildLineAccountLinkUrl({ linkToken, nonce: request.nonce }),
        expiresAt: request.expiresAt,
    };
}
