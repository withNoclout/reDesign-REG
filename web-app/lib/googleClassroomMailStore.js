import { getServiceSupabase } from './supabase.js';
import { decryptGoogleClassroomToken, encryptGoogleClassroomToken } from './googleClassroomCrypto.js';

const CONNECTIONS_TABLE = 'google_mail_connections';
const NOTIFICATIONS_TABLE = 'gmail_classroom_notifications';
const CURSORS_TABLE = 'gmail_sync_cursors';

function buildStorageError(error, tableName, fallbackMessage) {
    const tableMissing = error?.code === '42P01'
        || error?.message?.includes(tableName)
        || error?.details?.includes?.(tableName);
    if (tableMissing) {
        const wrapped = new Error(`Missing Supabase table ${tableName}. Apply the latest schema before using Gmail-backed Classroom POC.`);
        wrapped.code = 'GMAIL_CLASSROOM_SCHEMA_MISSING';
        wrapped.status = 500;
        return wrapped;
    }
    const wrapped = new Error(error?.message || fallbackMessage);
    wrapped.code = error?.code || 'GMAIL_CLASSROOM_STORE_ERROR';
    wrapped.status = 500;
    return wrapped;
}

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readIsoString(value) {
    const text = readString(value);
    if (!text) return null;
    const timestamp = Date.parse(text);
    return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function decodeConnectionRow(row) {
    if (!row) return null;
    return {
        userCode: row.user_code,
        googleUserId: row.google_user_id,
        email: row.email,
        displayName: row.display_name,
        pictureUrl: row.picture_url,
        accessToken: decryptGoogleClassroomToken(row.access_token_encrypted),
        refreshToken: decryptGoogleClassroomToken(row.refresh_token_encrypted),
        tokenType: row.token_type,
        scope: row.scope,
        accessTokenExpiresAt: row.access_token_expires_at,
        lastSyncedAt: row.last_synced_at,
        lastSyncError: row.last_sync_error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        revokedAt: row.revoked_at,
    };
}

function encodeConnectionRow(connection) {
    return {
        user_code: connection.userCode,
        google_user_id: connection.googleUserId,
        email: connection.email || null,
        display_name: connection.displayName || null,
        picture_url: connection.pictureUrl || null,
        access_token_encrypted: encryptGoogleClassroomToken(connection.accessToken),
        refresh_token_encrypted: encryptGoogleClassroomToken(connection.refreshToken),
        token_type: connection.tokenType || 'Bearer',
        scope: connection.scope || '',
        access_token_expires_at: readIsoString(connection.accessTokenExpiresAt),
        last_synced_at: readIsoString(connection.lastSyncedAt),
        last_sync_error: readString(connection.lastSyncError),
        revoked_at: readIsoString(connection.revokedAt),
        updated_at: new Date().toISOString(),
    };
}

function decodeCursorRow(row) {
    if (!row) return null;
    return {
        userCode: row.user_code,
        lastMessageInternalDate: row.last_message_internal_date,
        lastHistoryId: row.last_history_id,
        lastQueryAt: row.last_query_at,
        lastSuccessAt: row.last_success_at,
        lastError: row.last_error,
        updatedAt: row.updated_at,
    };
}

function encodeCursorRow(cursor) {
    return {
        user_code: cursor.userCode,
        last_message_internal_date: cursor.lastMessageInternalDate ? String(cursor.lastMessageInternalDate) : null,
        last_history_id: cursor.lastHistoryId ? String(cursor.lastHistoryId) : null,
        last_query_at: readIsoString(cursor.lastQueryAt),
        last_success_at: readIsoString(cursor.lastSuccessAt),
        last_error: readString(cursor.lastError),
        updated_at: new Date().toISOString(),
    };
}

function decodeNotificationRow(row) {
    if (!row) return null;
    return {
        id: row.notification_id,
        userCode: row.user_code,
        gmailMessageId: row.gmail_message_id,
        gmailThreadId: row.gmail_thread_id,
        sender: row.sender,
        subject: row.subject,
        snippet: row.snippet,
        sourceType: row.source_type,
        courseHint: row.course_hint,
        href: row.href,
        title: row.title,
        message: row.message,
        sortAt: row.sort_at,
        resourceUpdatedAt: row.resource_updated_at,
        seenAt: row.seen_at,
        payload: row.payload || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function encodeNotificationRow(userCode, notification) {
    return {
        notification_id: notification.id,
        user_code: userCode,
        gmail_message_id: notification.gmailMessageId,
        gmail_thread_id: notification.gmailThreadId,
        sender: notification.sender || null,
        subject: notification.subject || null,
        snippet: notification.snippet || null,
        source_type: notification.sourceType,
        course_hint: notification.courseHint || null,
        href: notification.href,
        title: notification.title,
        message: notification.message,
        sort_at: readIsoString(notification.sortAt) || new Date().toISOString(),
        resource_updated_at: readIsoString(notification.resourceUpdatedAt) || readIsoString(notification.sortAt) || new Date().toISOString(),
        payload: notification.payload || {},
    };
}

export async function getGoogleMailConnection(userCode) {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.from(CONNECTIONS_TABLE).select('*').eq('user_code', String(userCode)).single();
    if (error?.code === 'PGRST116') return null;
    if (error) throw buildStorageError(error, CONNECTIONS_TABLE, 'Failed to load Google Mail connection');
    return decodeConnectionRow(data);
}

export async function upsertGoogleMailConnection(connection) {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from(CONNECTIONS_TABLE)
        .upsert({ ...encodeConnectionRow(connection), created_at: new Date().toISOString() }, { onConflict: 'user_code' })
        .select('*')
        .single();
    if (error) throw buildStorageError(error, CONNECTIONS_TABLE, 'Failed to save Google Mail connection');
    return decodeConnectionRow(data);
}

export async function updateGoogleMailConnection(userCode, patch) {
    const supabase = getServiceSupabase();
    const row = encodeConnectionRow({ userCode, ...patch });
    if (patch.accessToken === undefined) delete row.access_token_encrypted;
    if (patch.refreshToken === undefined) delete row.refresh_token_encrypted;
    if (patch.googleUserId === undefined) delete row.google_user_id;
    if (patch.email === undefined) delete row.email;
    if (patch.displayName === undefined) delete row.display_name;
    if (patch.pictureUrl === undefined) delete row.picture_url;
    if (patch.tokenType === undefined) delete row.token_type;
    if (patch.scope === undefined) delete row.scope;
    if (patch.accessTokenExpiresAt === undefined) delete row.access_token_expires_at;
    if (patch.lastSyncedAt === undefined) delete row.last_synced_at;
    if (patch.lastSyncError === undefined) delete row.last_sync_error;
    if (patch.revokedAt === undefined) delete row.revoked_at;
    const { data, error } = await supabase.from(CONNECTIONS_TABLE).update(row).eq('user_code', String(userCode)).select('*').single();
    if (error) throw buildStorageError(error, CONNECTIONS_TABLE, 'Failed to update Google Mail connection');
    return decodeConnectionRow(data);
}

export async function getGoogleMailSyncCursor(userCode) {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.from(CURSORS_TABLE).select('*').eq('user_code', String(userCode)).single();
    if (error?.code === 'PGRST116') return null;
    if (error) throw buildStorageError(error, CURSORS_TABLE, 'Failed to load Gmail sync cursor');
    return decodeCursorRow(data);
}

export async function upsertGoogleMailSyncCursor(cursor) {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.from(CURSORS_TABLE).upsert(encodeCursorRow(cursor), { onConflict: 'user_code' }).select('*').single();
    if (error) throw buildStorageError(error, CURSORS_TABLE, 'Failed to save Gmail sync cursor');
    return decodeCursorRow(data);
}

export async function upsertGoogleMailNotifications(userCode, notifications) {
    if (!Array.isArray(notifications) || notifications.length === 0) return [];
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.from(NOTIFICATIONS_TABLE).upsert(notifications.map((item) => encodeNotificationRow(String(userCode), item)), { onConflict: 'notification_id' }).select('*');
    if (error) throw buildStorageError(error, NOTIFICATIONS_TABLE, 'Failed to save Gmail classroom notifications');
    return (data || []).map(decodeNotificationRow);
}

export async function listGoogleMailNotifications(userCode, { limit = 20 } = {}) {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.from(NOTIFICATIONS_TABLE).select('*').eq('user_code', String(userCode)).order('sort_at', { ascending: false }).limit(limit);
    if (error) throw buildStorageError(error, NOTIFICATIONS_TABLE, 'Failed to list Gmail classroom notifications');
    return (data || []).map(decodeNotificationRow);
}

export async function countUnreadGoogleMailNotifications(userCode) {
    const supabase = getServiceSupabase();
    const { count, error } = await supabase.from(NOTIFICATIONS_TABLE).select('notification_id', { head: true, count: 'exact' }).eq('user_code', String(userCode)).is('seen_at', null);
    if (error) throw buildStorageError(error, NOTIFICATIONS_TABLE, 'Failed to count Gmail classroom notifications');
    return Number(count || 0);
}

export async function markGoogleMailNotificationsSeen(userCode, notificationIds) {
    const ids = Array.from(new Set((notificationIds || []).map((item) => String(item).trim()).filter(Boolean)));
    if (ids.length === 0) return [];
    const supabase = getServiceSupabase();
    const seenAt = new Date().toISOString();
    const { data, error } = await supabase.from(NOTIFICATIONS_TABLE).update({ seen_at: seenAt, updated_at: seenAt }).eq('user_code', String(userCode)).in('notification_id', ids).select('*');
    if (error) throw buildStorageError(error, NOTIFICATIONS_TABLE, 'Failed to mark Gmail classroom notifications as seen');
    return (data || []).map(decodeNotificationRow);
}

export async function deleteAllGoogleMailNotifications(userCode) {
    const supabase = getServiceSupabase();
    const { error } = await supabase.from(NOTIFICATIONS_TABLE).delete().eq('user_code', String(userCode));
    if (error) throw buildStorageError(error, NOTIFICATIONS_TABLE, 'Failed to clear Gmail classroom notifications');
}
