import { getServiceSupabase } from './supabase.js';

const USER_SETTINGS_TABLE = 'user_settings';
const LINE_NAMESPACE = 'lineMessaging';
const SYSTEM_ROW_USER_ID = '__line_messaging_system__';
const LINE_MESSAGING_ACCOUNTS_TABLE = 'line_messaging_accounts';
const LINE_LINK_REQUESTS_TABLE = 'line_link_requests';
const LINE_WEBHOOK_EVENTS_TABLE = 'line_webhook_events';

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeTimestamp(value, fallback = null) {
    const normalized = readString(value);
    if (!normalized) return fallback;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function normalizeLineUserId(value) {
    const normalized = readString(value);
    return normalized ? normalized.slice(0, 128) : null;
}

function normalizeUserCode(value) {
    const normalized = readString(value);
    return normalized ? normalized.replace(/^s/i, '') : null;
}

function normalizePairingCode(value) {
    const normalized = readString(value);
    return normalized ? normalized.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) : null;
}

function normalizeFriendshipStatus(value) {
    return value === 'unfollowed' ? 'unfollowed' : 'following';
}

function normalizeLinkStatus(value) {
    return value === 'linked' ? 'linked' : 'unlinked';
}

function normalizeWebhookStatus(value) {
    if (value === 'failed') return 'failed';
    if (value === 'ignored') return 'ignored';
    return 'processed';
}

function normalizeLinkRequestStatus(value) {
    return ['pending', 'linked', 'failed', 'expired'].includes(value) ? value : 'pending';
}

function buildStorageError(error, tableName, fallbackMessage) {
    const causeMessage = typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : null;
    const message = causeMessage ? `${fallbackMessage}: ${causeMessage}` : fallbackMessage;
    const wrapped = new Error(message);
    wrapped.cause = error;
    wrapped.tableName = tableName;
    return wrapped;
}

function isMissingTableError(error, tableName) {
    const message = typeof error?.message === 'string' ? error.message : '';
    return message.includes(`Could not find the table 'public.${tableName}' in the schema cache`)
        || message.includes(`relation \"public.${tableName}\" does not exist`)
        || message.includes(`relation \"${tableName}\" does not exist`);
}

async function withFallback(tableName, primaryFn, fallbackFn) {
    try {
        return await primaryFn();
    } catch (error) {
        if (!isMissingTableError(error?.cause || error, tableName) && !isMissingTableError(error, tableName)) {
            throw error;
        }
        return fallbackFn();
    }
}

function normalizeLineMessagingAccountRecord(record = {}) {
    const now = new Date().toISOString();
    return {
        lineUserId: normalizeLineUserId(record.lineUserId),
        userCode: normalizeUserCode(record.userCode),
        displayName: readString(record.displayName),
        pictureUrl: readString(record.pictureUrl),
        language: readString(record.language),
        statusMessage: readString(record.statusMessage),
        friendshipStatus: normalizeFriendshipStatus(record.friendshipStatus),
        linkStatus: normalizeLinkStatus(record.linkStatus),
        lastFollowedAt: normalizeTimestamp(record.lastFollowedAt),
        lastUnfollowedAt: normalizeTimestamp(record.lastUnfollowedAt),
        lastLinkedAt: normalizeTimestamp(record.lastLinkedAt),
        lastUnlinkedAt: normalizeTimestamp(record.lastUnlinkedAt),
        lastWebhookAt: normalizeTimestamp(record.lastWebhookAt),
        lastMessageAt: normalizeTimestamp(record.lastMessageAt),
        createdAt: normalizeTimestamp(record.createdAt, now),
        updatedAt: normalizeTimestamp(record.updatedAt, now),
    };
}

function normalizeLineLinkRequestRecord(record = {}) {
    const now = new Date().toISOString();
    return {
        nonce: readString(record.nonce),
        userCode: normalizeUserCode(record.userCode),
        lineUserId: normalizeLineUserId(record.lineUserId),
        pairingCode: normalizePairingCode(record.pairingCode),
        status: normalizeLinkRequestStatus(record.status),
        expiresAt: normalizeTimestamp(record.expiresAt, now),
        linkedAt: normalizeTimestamp(record.linkedAt),
        failedAt: normalizeTimestamp(record.failedAt),
        createdAt: normalizeTimestamp(record.createdAt, now),
        updatedAt: normalizeTimestamp(record.updatedAt, now),
    };
}

function normalizeLineWebhookEventRecord(record = {}) {
    const now = new Date().toISOString();
    return {
        webhookEventId: readString(record.webhookEventId),
        eventType: readString(record.eventType) || 'unknown',
        mode: readString(record.mode),
        lineUserId: normalizeLineUserId(record.lineUserId),
        groupId: readString(record.groupId),
        roomId: readString(record.roomId),
        isRedelivery: Boolean(record.isRedelivery),
        occurredAt: normalizeTimestamp(record.occurredAt),
        processedAt: normalizeTimestamp(record.processedAt, now),
        status: normalizeWebhookStatus(record.status),
        errorMessage: readString(record.errorMessage),
        payload: normalizeObject(record.payload),
        createdAt: normalizeTimestamp(record.createdAt, now),
        updatedAt: normalizeTimestamp(record.updatedAt, now),
    };
}

function mapLineMessagingAccountRow(row) {
    if (!row) return null;
    return normalizeLineMessagingAccountRecord({
        lineUserId: row.line_user_id,
        userCode: row.user_code,
        displayName: row.display_name,
        pictureUrl: row.picture_url,
        language: row.language,
        statusMessage: row.status_message,
        friendshipStatus: row.friendship_status,
        linkStatus: row.link_status,
        lastFollowedAt: row.last_followed_at,
        lastUnfollowedAt: row.last_unfollowed_at,
        lastLinkedAt: row.last_linked_at,
        lastUnlinkedAt: row.last_unlinked_at,
        lastWebhookAt: row.last_webhook_at,
        lastMessageAt: row.last_message_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}

function mapLineLinkRequestRow(row) {
    if (!row) return null;
    return normalizeLineLinkRequestRecord({
        nonce: row.nonce,
        userCode: row.user_code,
        lineUserId: row.line_user_id,
        pairingCode: row.pairing_code,
        status: row.status,
        expiresAt: row.expires_at,
        linkedAt: row.linked_at,
        failedAt: row.failed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}

function mapLineWebhookEventRow(row) {
    if (!row) return null;
    return normalizeLineWebhookEventRecord({
        webhookEventId: row.webhook_event_id,
        eventType: row.event_type,
        mode: row.mode,
        lineUserId: row.line_user_id,
        groupId: row.group_id,
        roomId: row.room_id,
        isRedelivery: row.is_redelivery,
        occurredAt: row.occurred_at,
        processedAt: row.processed_at,
        status: row.status,
        errorMessage: row.error_message,
        payload: row.payload,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}


function readLineSystemConfig(config) {
    return normalizeObject(normalizeObject(config)[LINE_NAMESPACE]);
}

function mergeLineSystemConfig(config, nextLineConfig) {
    return {
        ...normalizeObject(config),
        [LINE_NAMESPACE]: normalizeObject(nextLineConfig),
    };
}

async function getUserSettingsRow(userId) {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from(USER_SETTINGS_TABLE)
        .select('portfolio_config, updated_at')
        .eq('user_id', String(userId))
        .single();

    if (error && error.code !== 'PGRST116') {
        throw buildStorageError(error, USER_SETTINGS_TABLE, 'Failed to load user settings row');
    }

    return data || null;
}

async function saveUserSettingsRow(userId, config) {
    const supabase = getServiceSupabase();
    const { error } = await supabase
        .from(USER_SETTINGS_TABLE)
        .upsert({
            user_id: String(userId),
            portfolio_config: normalizeObject(config),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

    if (error) {
        throw buildStorageError(error, USER_SETTINGS_TABLE, 'Failed to save user settings row');
    }
}

async function updateUserSettingsConfig(userId, updater) {
    const row = await getUserSettingsRow(userId);
    const currentConfig = normalizeObject(row?.portfolio_config);
    const nextConfig = updater(currentConfig);
    await saveUserSettingsRow(userId, nextConfig);
    return nextConfig;
}

async function getLineMessagingAccountRow(lineUserId) {
    const normalizedLineUserId = normalizeLineUserId(lineUserId);
    if (!normalizedLineUserId) return null;

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from(LINE_MESSAGING_ACCOUNTS_TABLE)
        .select('*')
        .eq('line_user_id', normalizedLineUserId)
        .single();

    if (error && error.code !== 'PGRST116') {
        throw buildStorageError(error, LINE_MESSAGING_ACCOUNTS_TABLE, 'Failed to load LINE messaging account');
    }

    return data || null;
}

async function getLinkedLineMessagingAccountForUserRow(userCode) {
    const normalizedUserCode = normalizeUserCode(userCode);
    if (!normalizedUserCode) return null;

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from(LINE_MESSAGING_ACCOUNTS_TABLE)
        .select('*')
        .eq('user_code', normalizedUserCode)
        .eq('link_status', 'linked')
        .single();

    if (error && error.code !== 'PGRST116') {
        throw buildStorageError(error, LINE_MESSAGING_ACCOUNTS_TABLE, 'Failed to load linked LINE account');
    }

    return data || null;
}

async function findPendingLineLinkRequestForUserRow(userCode) {
    const normalizedUserCode = normalizeUserCode(userCode);
    if (!normalizedUserCode) return null;

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from(LINE_LINK_REQUESTS_TABLE)
        .select('*')
        .eq('user_code', normalizedUserCode)
        .eq('status', 'pending')
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') {
        throw buildStorageError(error, LINE_LINK_REQUESTS_TABLE, 'Failed to load pending LINE link request');
    }

    return data || null;
}

async function findLineLinkRequestByPairingCodeRow(pairingCode) {
    const normalizedPairingCode = normalizePairingCode(pairingCode);
    if (!normalizedPairingCode) return null;

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from(LINE_LINK_REQUESTS_TABLE)
        .select('*')
        .eq('pairing_code', normalizedPairingCode)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') {
        throw buildStorageError(error, LINE_LINK_REQUESTS_TABLE, 'Failed to load LINE link request by pairing code');
    }

    return data || null;
}

async function getLineLinkRequestRow(nonce) {
    const normalizedNonce = readString(nonce);
    if (!normalizedNonce) return null;

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from(LINE_LINK_REQUESTS_TABLE)
        .select('*')
        .eq('nonce', normalizedNonce)
        .single();

    if (error && error.code !== 'PGRST116') {
        throw buildStorageError(error, LINE_LINK_REQUESTS_TABLE, 'Failed to load LINE link request');
    }

    return data || null;
}

async function upsertLineMessagingAccountRow(record) {
    const account = normalizeLineMessagingAccountRecord(record);
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from(LINE_MESSAGING_ACCOUNTS_TABLE)
        .upsert({
            line_user_id: account.lineUserId,
            user_code: account.userCode,
            display_name: account.displayName,
            picture_url: account.pictureUrl,
            language: account.language,
            status_message: account.statusMessage,
            friendship_status: account.friendshipStatus,
            link_status: account.linkStatus,
            last_followed_at: account.lastFollowedAt,
            last_unfollowed_at: account.lastUnfollowedAt,
            last_linked_at: account.lastLinkedAt,
            last_unlinked_at: account.lastUnlinkedAt,
            last_webhook_at: account.lastWebhookAt,
            last_message_at: account.lastMessageAt,
            updated_at: account.updatedAt,
        }, { onConflict: 'line_user_id' })
        .select('*')
        .single();

    if (error) {
        throw buildStorageError(error, LINE_MESSAGING_ACCOUNTS_TABLE, 'Failed to save LINE messaging account');
    }

    return mapLineMessagingAccountRow(data);
}

async function upsertLineMessagingAccountFallback(record) {
    const account = normalizeLineMessagingAccountRecord(record);
    await updateUserSettingsConfig(SYSTEM_ROW_USER_ID, (config) => {
        const lineConfig = readLineSystemConfig(config);
        const accountsByUserId = {
            ...normalizeObject(lineConfig.accountsByUserId),
            [account.lineUserId]: account,
        };
        return mergeLineSystemConfig(config, {
            ...lineConfig,
            accountsByUserId,
            updatedAt: new Date().toISOString(),
        });
    });
    return account;
}

async function getLineMessagingAccountFallback(lineUserId) {
    const normalizedLineUserId = normalizeLineUserId(lineUserId);
    if (!normalizedLineUserId) return null;

    const row = await getUserSettingsRow(SYSTEM_ROW_USER_ID);
    const lineConfig = readLineSystemConfig(row?.portfolio_config);
    const account = normalizeObject(lineConfig.accountsByUserId)[normalizedLineUserId];
    return account ? normalizeLineMessagingAccountRecord(account) : null;
}

async function getLinkedLineMessagingAccountForUserFallback(userCode) {
    const normalizedUserCode = normalizeUserCode(userCode);
    if (!normalizedUserCode) return null;

    const row = await getUserSettingsRow(SYSTEM_ROW_USER_ID);
    const lineConfig = readLineSystemConfig(row?.portfolio_config);
    const accounts = Object.values(normalizeObject(lineConfig.accountsByUserId));
    const match = accounts
        .map((account) => normalizeLineMessagingAccountRecord(account))
        .find((account) => account.userCode === normalizedUserCode && account.linkStatus === 'linked');
    return match || null;
}

async function createLineLinkRequestFallback(record) {
    const request = normalizeLineLinkRequestRecord(record);
    await updateUserSettingsConfig(SYSTEM_ROW_USER_ID, (config) => {
        const lineConfig = readLineSystemConfig(config);
        const linkRequestsByNonce = {
            ...normalizeObject(lineConfig.linkRequestsByNonce),
            [request.nonce]: request,
        };
        return mergeLineSystemConfig(config, {
            ...lineConfig,
            linkRequestsByNonce,
            updatedAt: new Date().toISOString(),
        });
    });
    return request;
}

async function getLineLinkRequestFallback(nonce) {
    const normalizedNonce = readString(nonce);
    if (!normalizedNonce) return null;

    const row = await getUserSettingsRow(SYSTEM_ROW_USER_ID);
    const lineConfig = readLineSystemConfig(row?.portfolio_config);
    const request = normalizeObject(lineConfig.linkRequestsByNonce)[normalizedNonce];
    return request ? normalizeLineLinkRequestRecord(request) : null;
}

async function findPendingLineLinkRequestForUserFallback(userCode) {
    const normalizedUserCode = normalizeUserCode(userCode);
    if (!normalizedUserCode) return null;

    const row = await getUserSettingsRow(SYSTEM_ROW_USER_ID);
    const lineConfig = readLineSystemConfig(row?.portfolio_config);
    const requests = Object.values(normalizeObject(lineConfig.linkRequestsByNonce))
        .map((request) => normalizeLineLinkRequestRecord(request))
        .filter((request) => request.userCode === normalizedUserCode && request.status === 'pending')
        .sort((left, right) => new Date(right.expiresAt).getTime() - new Date(left.expiresAt).getTime());
    return requests[0] || null;
}

async function findLineLinkRequestByPairingCodeFallback(pairingCode) {
    const normalizedPairingCode = normalizePairingCode(pairingCode);
    if (!normalizedPairingCode) return null;

    const row = await getUserSettingsRow(SYSTEM_ROW_USER_ID);
    const lineConfig = readLineSystemConfig(row?.portfolio_config);
    const requests = Object.values(normalizeObject(lineConfig.linkRequestsByNonce))
        .map((request) => normalizeLineLinkRequestRecord(request));
    return requests.find((request) => request.pairingCode === normalizedPairingCode) || null;
}

async function updateLineLinkRequestRow(nonce, updates) {
    const normalizedNonce = readString(nonce);
    if (!normalizedNonce) {
        throw new Error('LINE link request nonce is required');
    }

    const supabase = getServiceSupabase();
    const payload = normalizeLineLinkRequestRecord({
        ...(await getLineLinkRequestRow(normalizedNonce)),
        ...updates,
        nonce: normalizedNonce,
        updatedAt: new Date().toISOString(),
    });
    const { data, error } = await supabase
        .from(LINE_LINK_REQUESTS_TABLE)
        .update({
            line_user_id: payload.lineUserId,
            pairing_code: payload.pairingCode,
            status: payload.status,
            expires_at: payload.expiresAt,
            linked_at: payload.linkedAt,
            failed_at: payload.failedAt,
            updated_at: payload.updatedAt,
        })
        .eq('nonce', normalizedNonce)
        .select('*')
        .single();

    if (error) {
        throw buildStorageError(error, LINE_LINK_REQUESTS_TABLE, 'Failed to update LINE link request');
    }

    return mapLineLinkRequestRow(data);
}

async function updateLineLinkRequestFallback(nonce, updates) {
    const existing = await getLineLinkRequestFallback(nonce);
    if (!existing) {
        throw new Error('LINE link request not found');
    }

    const request = normalizeLineLinkRequestRecord({
        ...existing,
        ...updates,
        nonce,
        updatedAt: new Date().toISOString(),
    });
    await createLineLinkRequestFallback(request);
    return request;
}

export async function getLineMessagingAccount(lineUserId) {
    return withFallback(
        LINE_MESSAGING_ACCOUNTS_TABLE,
        async () => mapLineMessagingAccountRow(await getLineMessagingAccountRow(lineUserId)),
        () => getLineMessagingAccountFallback(lineUserId),
    );
}

export async function getLinkedLineMessagingAccountForUser(userCode) {
    return withFallback(
        LINE_MESSAGING_ACCOUNTS_TABLE,
        async () => mapLineMessagingAccountRow(await getLinkedLineMessagingAccountForUserRow(userCode)),
        () => getLinkedLineMessagingAccountForUserFallback(userCode),
    );
}

export async function findPendingLineLinkRequestForUser(userCode) {
    return withFallback(
        LINE_LINK_REQUESTS_TABLE,
        async () => mapLineLinkRequestRow(await findPendingLineLinkRequestForUserRow(userCode)),
        () => findPendingLineLinkRequestForUserFallback(userCode),
    );
}

export async function findLineLinkRequestByPairingCode(pairingCode) {
    return withFallback(
        LINE_LINK_REQUESTS_TABLE,
        async () => mapLineLinkRequestRow(await findLineLinkRequestByPairingCodeRow(pairingCode)),
        () => findLineLinkRequestByPairingCodeFallback(pairingCode),
    );
}

export async function listRecentLineWebhookEvents(limit = 10) {
    const normalizedLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);

    return withFallback(
        LINE_WEBHOOK_EVENTS_TABLE,
        async () => {
            const supabase = getServiceSupabase();
            const { data, error } = await supabase
                .from(LINE_WEBHOOK_EVENTS_TABLE)
                .select('*')
                .order('processed_at', { ascending: false })
                .limit(normalizedLimit);

            if (error) {
                throw buildStorageError(error, LINE_WEBHOOK_EVENTS_TABLE, 'Failed to list LINE webhook events');
            }

            return (data || []).map((row) => mapLineWebhookEventRow(row)).filter(Boolean);
        },
        async () => {
            const row = await getUserSettingsRow(SYSTEM_ROW_USER_ID);
            const lineConfig = readLineSystemConfig(row?.portfolio_config);
            return Object.values(normalizeObject(lineConfig.webhookEventsById))
                .map((record) => normalizeLineWebhookEventRecord(record))
                .sort((left, right) => new Date(right.processedAt).getTime() - new Date(left.processedAt).getTime())
                .slice(0, normalizedLimit);
        },
    );
}


export async function createLineLinkRequest({ nonce, userCode, pairingCode, expiresAt }) {
    const request = normalizeLineLinkRequestRecord({ nonce, userCode, pairingCode, expiresAt, status: 'pending' });
    if (!request.nonce) throw new Error('LINE link request nonce is required');
    if (!request.userCode) throw new Error('User code is required to create a LINE link request');
    if (!request.pairingCode) throw new Error('Pairing code is required to create a LINE link request');
    if (!request.expiresAt) throw new Error('A valid expiration timestamp is required to create a LINE link request');

    return withFallback(
        LINE_LINK_REQUESTS_TABLE,
        async () => {
            const supabase = getServiceSupabase();
            const { data, error } = await supabase
                .from(LINE_LINK_REQUESTS_TABLE)
                .upsert({
                    nonce: request.nonce,
                    user_code: request.userCode,
                    line_user_id: request.lineUserId,
                    pairing_code: request.pairingCode,
                    status: request.status,
                    expires_at: request.expiresAt,
                    linked_at: request.linkedAt,
                    failed_at: request.failedAt,
                    updated_at: request.updatedAt,
                }, { onConflict: 'nonce' })
                .select('*')
                .single();

            if (error) {
                throw buildStorageError(error, LINE_LINK_REQUESTS_TABLE, 'Failed to create LINE link request');
            }

            return mapLineLinkRequestRow(data);
        },
        () => createLineLinkRequestFallback(request),
    );
}

export async function unlinkLineMessagingAccountForUser(userCode, occurredAt = new Date().toISOString()) {
    const normalizedUserCode = normalizeUserCode(userCode);
    if (!normalizedUserCode) {
        throw new Error('User code is required to unlink a LINE account');
    }

    const timestamp = normalizeTimestamp(occurredAt, new Date().toISOString());
    const current = await getLinkedLineMessagingAccountForUser(normalizedUserCode);
    if (!current) return null;

    return withFallback(
        LINE_MESSAGING_ACCOUNTS_TABLE,
        () => upsertLineMessagingAccountRow({
            ...current,
            userCode: null,
            linkStatus: 'unlinked',
            lastUnlinkedAt: timestamp,
            updatedAt: new Date().toISOString(),
        }),
        () => upsertLineMessagingAccountFallback({
            ...current,
            userCode: null,
            linkStatus: 'unlinked',
            lastUnlinkedAt: timestamp,
            updatedAt: new Date().toISOString(),
        }),
    );
}

async function saveLineMessagingAccount(record) {
    return withFallback(
        LINE_MESSAGING_ACCOUNTS_TABLE,
        () => upsertLineMessagingAccountRow(record),
        () => upsertLineMessagingAccountFallback(record),
    );
}

export async function markLineAccountFollowed({ lineUserId, profile = null, occurredAt = null }) {
    const normalizedLineUserId = normalizeLineUserId(lineUserId);
    if (!normalizedLineUserId) throw new Error('LINE user ID is required to mark a LINE account as followed');
    const timestamp = normalizeTimestamp(occurredAt, new Date().toISOString());
    const existing = await getLineMessagingAccount(normalizedLineUserId);
    return saveLineMessagingAccount({
        ...existing,
        lineUserId: normalizedLineUserId,
        displayName: profile?.displayName ?? existing?.displayName ?? null,
        pictureUrl: profile?.pictureUrl ?? existing?.pictureUrl ?? null,
        language: profile?.language ?? existing?.language ?? null,
        statusMessage: profile?.statusMessage ?? existing?.statusMessage ?? null,
        friendshipStatus: 'following',
        linkStatus: existing?.linkStatus ?? 'unlinked',
        lastFollowedAt: timestamp,
        lastWebhookAt: timestamp,
        updatedAt: new Date().toISOString(),
    });
}

export async function markLineAccountUnfollowed({ lineUserId, occurredAt = null }) {
    const normalizedLineUserId = normalizeLineUserId(lineUserId);
    if (!normalizedLineUserId) throw new Error('LINE user ID is required to mark a LINE account as unfollowed');
    const timestamp = normalizeTimestamp(occurredAt, new Date().toISOString());
    const existing = await getLineMessagingAccount(normalizedLineUserId);
    return saveLineMessagingAccount({
        ...existing,
        lineUserId: normalizedLineUserId,
        friendshipStatus: 'unfollowed',
        linkStatus: existing?.linkStatus ?? 'unlinked',
        lastUnfollowedAt: timestamp,
        lastWebhookAt: timestamp,
        updatedAt: new Date().toISOString(),
    });
}

export async function touchLineAccountConversation({ lineUserId, profile = null, occurredAt = null }) {
    const normalizedLineUserId = normalizeLineUserId(lineUserId);
    if (!normalizedLineUserId) throw new Error('LINE user ID is required to update LINE account activity');
    const timestamp = normalizeTimestamp(occurredAt, new Date().toISOString());
    const existing = await getLineMessagingAccount(normalizedLineUserId);
    return saveLineMessagingAccount({
        ...existing,
        lineUserId: normalizedLineUserId,
        displayName: profile?.displayName ?? existing?.displayName ?? null,
        pictureUrl: profile?.pictureUrl ?? existing?.pictureUrl ?? null,
        language: profile?.language ?? existing?.language ?? null,
        statusMessage: profile?.statusMessage ?? existing?.statusMessage ?? null,
        friendshipStatus: existing?.friendshipStatus ?? 'following',
        linkStatus: existing?.linkStatus ?? 'unlinked',
        lastMessageAt: timestamp,
        lastWebhookAt: timestamp,
        updatedAt: new Date().toISOString(),
    });
}

export async function completeLineLinkRequest({ nonce, lineUserId, result, profile = null, occurredAt = null }) {
    const normalizedNonce = readString(nonce);
    const normalizedLineUserId = normalizeLineUserId(lineUserId);
    const normalizedResult = readString(result);
    const timestamp = normalizeTimestamp(occurredAt, new Date().toISOString());

    if (!normalizedNonce) return { status: 'ignored', reason: 'missing_nonce' };
    if (!normalizedLineUserId) return { status: 'ignored', reason: 'missing_line_user_id' };

    const request = await withFallback(
        LINE_LINK_REQUESTS_TABLE,
        async () => mapLineLinkRequestRow(await getLineLinkRequestRow(normalizedNonce)),
        () => getLineLinkRequestFallback(normalizedNonce),
    );
    if (!request) return { status: 'ignored', reason: 'unknown_nonce' };

    if (request.expiresAt && request.expiresAt < timestamp && request.status === 'pending') {
        await withFallback(
            LINE_LINK_REQUESTS_TABLE,
            () => updateLineLinkRequestRow(normalizedNonce, { lineUserId: normalizedLineUserId, status: 'expired', failedAt: timestamp }),
            () => updateLineLinkRequestFallback(normalizedNonce, { lineUserId: normalizedLineUserId, status: 'expired', failedAt: timestamp }),
        );
        return { status: 'expired', userCode: request.userCode };
    }

    if (normalizedResult !== 'ok') {
        await withFallback(
            LINE_LINK_REQUESTS_TABLE,
            () => updateLineLinkRequestRow(normalizedNonce, { lineUserId: normalizedLineUserId, status: 'failed', failedAt: timestamp }),
            () => updateLineLinkRequestFallback(normalizedNonce, { lineUserId: normalizedLineUserId, status: 'failed', failedAt: timestamp }),
        );
        return { status: 'failed', userCode: request.userCode };
    }

    const normalizedUserCode = normalizeUserCode(request.userCode);
    if (!normalizedUserCode) {
        await withFallback(
            LINE_LINK_REQUESTS_TABLE,
            () => updateLineLinkRequestRow(normalizedNonce, { lineUserId: normalizedLineUserId, status: 'failed', failedAt: timestamp }),
            () => updateLineLinkRequestFallback(normalizedNonce, { lineUserId: normalizedLineUserId, status: 'failed', failedAt: timestamp }),
        );
        return { status: 'failed', reason: 'missing_user_code' };
    }

    const existingLinked = await getLinkedLineMessagingAccountForUser(normalizedUserCode);
    if (existingLinked?.lineUserId && existingLinked.lineUserId !== normalizedLineUserId) {
        await unlinkLineMessagingAccountForUser(normalizedUserCode, timestamp);
    }

    const existing = await getLineMessagingAccount(normalizedLineUserId);
    const account = await saveLineMessagingAccount({
        ...existing,
        lineUserId: normalizedLineUserId,
        userCode: normalizedUserCode,
        displayName: profile?.displayName ?? existing?.displayName ?? null,
        pictureUrl: profile?.pictureUrl ?? existing?.pictureUrl ?? null,
        language: profile?.language ?? existing?.language ?? null,
        statusMessage: profile?.statusMessage ?? existing?.statusMessage ?? null,
        friendshipStatus: existing?.friendshipStatus ?? 'following',
        linkStatus: 'linked',
        lastLinkedAt: timestamp,
        lastWebhookAt: timestamp,
        updatedAt: new Date().toISOString(),
    });

    await withFallback(
        LINE_LINK_REQUESTS_TABLE,
        () => updateLineLinkRequestRow(normalizedNonce, { lineUserId: normalizedLineUserId, status: 'linked', linkedAt: timestamp }),
        () => updateLineLinkRequestFallback(normalizedNonce, { lineUserId: normalizedLineUserId, status: 'linked', linkedAt: timestamp }),
    );

    return { status: 'linked', userCode: normalizedUserCode, account };
}

export async function recordLineWebhookEvent({ webhookEventId, eventType, mode = null, lineUserId = null, groupId = null, roomId = null, isRedelivery = false, occurredAt = null, processedAt = null, status = 'processed', errorMessage = null, payload = {} }) {
    const receipt = normalizeLineWebhookEventRecord({ webhookEventId, eventType, mode, lineUserId, groupId, roomId, isRedelivery, occurredAt, processedAt, status, errorMessage, payload });
    if (!receipt.webhookEventId) throw new Error('Webhook event ID is required to record a LINE webhook event');

    return withFallback(
        LINE_WEBHOOK_EVENTS_TABLE,
        async () => {
            const supabase = getServiceSupabase();
            const { error } = await supabase
                .from(LINE_WEBHOOK_EVENTS_TABLE)
                .upsert({
                    webhook_event_id: receipt.webhookEventId,
                    event_type: receipt.eventType,
                    mode: receipt.mode,
                    line_user_id: receipt.lineUserId,
                    group_id: receipt.groupId,
                    room_id: receipt.roomId,
                    is_redelivery: receipt.isRedelivery,
                    occurred_at: receipt.occurredAt,
                    processed_at: receipt.processedAt,
                    status: receipt.status,
                    error_message: receipt.errorMessage,
                    payload: receipt.payload,
                    updated_at: receipt.updatedAt,
                }, { onConflict: 'webhook_event_id' });

            if (error) {
                throw buildStorageError(error, LINE_WEBHOOK_EVENTS_TABLE, 'Failed to record LINE webhook event');
            }
        },
        () => updateUserSettingsConfig(SYSTEM_ROW_USER_ID, (config) => {
            const lineConfig = readLineSystemConfig(config);
            return mergeLineSystemConfig(config, {
                ...lineConfig,
                webhookEventsById: {
                    ...normalizeObject(lineConfig.webhookEventsById),
                    [receipt.webhookEventId]: receipt,
                },
                updatedAt: new Date().toISOString(),
            });
        }),
    );
}

export function createLineWebhookStore() {
    return {
        getAccount: getLineMessagingAccount,
        getLinkedAccountForUser: getLinkedLineMessagingAccountForUser,
        findPendingLinkRequestForUser: findPendingLineLinkRequestForUser,
        findLinkRequestByPairingCode: findLineLinkRequestByPairingCode,
        createLinkRequest: createLineLinkRequest,
        unlinkAccountForUser: unlinkLineMessagingAccountForUser,
        markFollowed: markLineAccountFollowed,
        markUnfollowed: markLineAccountUnfollowed,
        touchConversation: touchLineAccountConversation,
        completeLinkRequest: completeLineLinkRequest,
        recordEvent: recordLineWebhookEvent,
        listRecentEvents: listRecentLineWebhookEvents,
    };
}
