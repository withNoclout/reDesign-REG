import { getServiceSupabase } from './supabase.js';
import { decryptGoogleClassroomToken, encryptGoogleClassroomToken } from './googleClassroomCrypto.js';

const GOOGLE_CLASSROOM_CONNECTIONS_TABLE = 'google_classroom_connections';
const GOOGLE_CLASSROOM_NOTIFICATIONS_TABLE = 'google_classroom_notifications';
const GOOGLE_CLASSROOM_REGISTRATIONS_TABLE = 'google_classroom_registrations';

function buildStorageError(error, tableName, fallbackMessage) {
    const tableMissing = error?.code === '42P01'
        || error?.message?.includes(tableName)
        || error?.details?.includes?.(tableName);

    if (tableMissing) {
        const wrapped = new Error(`Missing Supabase table ${tableName}. Apply the latest schema before using Google Classroom integration.`);
        wrapped.code = 'GOOGLE_CLASSROOM_SCHEMA_MISSING';
        wrapped.status = 500;
        return wrapped;
    }

    const wrapped = new Error(error?.message || fallbackMessage);
    wrapped.code = error?.code || 'GOOGLE_CLASSROOM_STORE_ERROR';
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
        lastSyncStartedAt: row.last_sync_started_at,
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
        last_sync_started_at: readIsoString(connection.lastSyncStartedAt),
        last_sync_error: readString(connection.lastSyncError),
        revoked_at: readIsoString(connection.revokedAt),
        updated_at: new Date().toISOString(),
    };
}

function decodeNotificationRow(row) {
    if (!row) return null;

    return {
        id: row.notification_id,
        userCode: row.user_code,
        sourceType: row.source_type,
        eventType: row.event_type,
        courseId: row.course_id,
        courseName: row.course_name,
        announcementId: row.announcement_id,
        courseWorkId: row.course_work_id,
        studentSubmissionId: row.student_submission_id,
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
        source_type: notification.sourceType,
        event_type: notification.eventType,
        course_id: notification.courseId,
        course_name: notification.courseName || null,
        announcement_id: notification.announcementId || null,
        course_work_id: notification.courseWorkId || null,
        student_submission_id: notification.studentSubmissionId || null,
        href: notification.href,
        title: notification.title,
        message: notification.message,
        sort_at: readIsoString(notification.sortAt) || new Date().toISOString(),
        resource_updated_at: readIsoString(notification.resourceUpdatedAt) || readIsoString(notification.sortAt) || new Date().toISOString(),
        payload: notification.payload && typeof notification.payload === 'object' && !Array.isArray(notification.payload)
            ? notification.payload
            : {},
    };
}

function decodeRegistrationRow(row) {
    if (!row) return null;

    return {
        registrationId: row.registration_id,
        userCode: row.user_code,
        courseId: row.course_id,
        topicName: row.topic_name,
        feedType: row.feed_type,
        expiryTime: row.expiry_time,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function encodeRegistrationRow(registration) {
    return {
        registration_id: registration.registrationId,
        user_code: registration.userCode,
        course_id: registration.courseId,
        topic_name: registration.topicName,
        feed_type: registration.feedType || 'COURSE_WORK_CHANGES',
        expiry_time: readIsoString(registration.expiryTime),
        updated_at: new Date().toISOString(),
    };
}

export async function getGoogleClassroomConnection(userCode) {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from(GOOGLE_CLASSROOM_CONNECTIONS_TABLE)
        .select('*')
        .eq('user_code', String(userCode))
        .single();

    if (error?.code === 'PGRST116') return null;
    if (error) throw buildStorageError(error, GOOGLE_CLASSROOM_CONNECTIONS_TABLE, 'Failed to load Google Classroom connection');
    return decodeConnectionRow(data);
}

export async function upsertGoogleClassroomConnection(connection) {
    const supabase = getServiceSupabase();
    const row = encodeConnectionRow(connection);

    const { data, error } = await supabase
        .from(GOOGLE_CLASSROOM_CONNECTIONS_TABLE)
        .upsert(row, { onConflict: 'user_code' })
        .select('*')
        .single();

    if (error) throw buildStorageError(error, GOOGLE_CLASSROOM_CONNECTIONS_TABLE, 'Failed to save Google Classroom connection');
    return decodeConnectionRow(data);
}

export async function updateGoogleClassroomConnection(userCode, patch) {
    const supabase = getServiceSupabase();
    const updateRow = encodeConnectionRow({ userCode, ...patch });

    if (patch.accessToken === undefined) delete updateRow.access_token_encrypted;
    if (patch.refreshToken === undefined) delete updateRow.refresh_token_encrypted;
    if (patch.googleUserId === undefined) delete updateRow.google_user_id;
    if (patch.email === undefined) delete updateRow.email;
    if (patch.displayName === undefined) delete updateRow.display_name;
    if (patch.pictureUrl === undefined) delete updateRow.picture_url;
    if (patch.tokenType === undefined) delete updateRow.token_type;
    if (patch.scope === undefined) delete updateRow.scope;
    if (patch.accessTokenExpiresAt === undefined) delete updateRow.access_token_expires_at;
    if (patch.lastSyncedAt === undefined) delete updateRow.last_synced_at;
    if (patch.lastSyncStartedAt === undefined) delete updateRow.last_sync_started_at;
    if (patch.lastSyncError === undefined) delete updateRow.last_sync_error;
    if (patch.revokedAt === undefined) delete updateRow.revoked_at;

    const { data, error } = await supabase
        .from(GOOGLE_CLASSROOM_CONNECTIONS_TABLE)
        .update(updateRow)
        .eq('user_code', String(userCode))
        .select('*')
        .single();

    if (error) throw buildStorageError(error, GOOGLE_CLASSROOM_CONNECTIONS_TABLE, 'Failed to update Google Classroom connection');
    return decodeConnectionRow(data);
}

export async function revokeGoogleClassroomConnection(userCode, reason = null) {
    return updateGoogleClassroomConnection(userCode, {
        revokedAt: new Date().toISOString(),
        lastSyncError: reason,
    });
}

export async function upsertGoogleClassroomNotifications(userCode, notifications) {
    if (!Array.isArray(notifications) || notifications.length === 0) return [];

    const rows = notifications.map((notification) => encodeNotificationRow(String(userCode), notification));
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from(GOOGLE_CLASSROOM_NOTIFICATIONS_TABLE)
        .upsert(rows, { onConflict: 'notification_id' })
        .select('*');

    if (error) throw buildStorageError(error, GOOGLE_CLASSROOM_NOTIFICATIONS_TABLE, 'Failed to save Google Classroom notifications');
    return (data || []).map(decodeNotificationRow);
}

export async function deleteGoogleClassroomNotificationsBefore(userCode, beforeIso) {
    const cutoff = readIsoString(beforeIso);
    if (!cutoff) return;

    const supabase = getServiceSupabase();
    const { error } = await supabase
        .from(GOOGLE_CLASSROOM_NOTIFICATIONS_TABLE)
        .delete()
        .eq('user_code', String(userCode))
        .lt('sort_at', cutoff);

    if (error) throw buildStorageError(error, GOOGLE_CLASSROOM_NOTIFICATIONS_TABLE, 'Failed to delete old Google Classroom notifications');
}

export async function deleteAllGoogleClassroomNotifications(userCode) {
    const supabase = getServiceSupabase();
    const { error } = await supabase
        .from(GOOGLE_CLASSROOM_NOTIFICATIONS_TABLE)
        .delete()
        .eq('user_code', String(userCode));

    if (error) throw buildStorageError(error, GOOGLE_CLASSROOM_NOTIFICATIONS_TABLE, 'Failed to clear Google Classroom notifications');
}


export async function listGoogleClassroomNotifications(userCode, { limit = 20, unreadOnly = false } = {}) {
    const supabase = getServiceSupabase();
    let query = supabase
        .from(GOOGLE_CLASSROOM_NOTIFICATIONS_TABLE)
        .select('*')
        .eq('user_code', String(userCode))
        .order('sort_at', { ascending: false })
        .limit(limit);

    if (unreadOnly) {
        query = query.is('seen_at', null);
    }

    const { data, error } = await query;
    if (error) throw buildStorageError(error, GOOGLE_CLASSROOM_NOTIFICATIONS_TABLE, 'Failed to list Google Classroom notifications');
    return (data || []).map(decodeNotificationRow);
}

export async function countUnreadGoogleClassroomNotifications(userCode) {
    const supabase = getServiceSupabase();
    const { count, error } = await supabase
        .from(GOOGLE_CLASSROOM_NOTIFICATIONS_TABLE)
        .select('notification_id', { head: true, count: 'exact' })
        .eq('user_code', String(userCode))
        .is('seen_at', null);

    if (error) throw buildStorageError(error, GOOGLE_CLASSROOM_NOTIFICATIONS_TABLE, 'Failed to count unread Google Classroom notifications');
    return Number(count || 0);
}

export async function markGoogleClassroomNotificationsSeen(userCode, notificationIds) {
    const ids = Array.from(new Set((notificationIds || []).map((value) => String(value).trim()).filter(Boolean)));
    if (ids.length === 0) return [];

    const supabase = getServiceSupabase();
    const seenAt = new Date().toISOString();
    const { data, error } = await supabase
        .from(GOOGLE_CLASSROOM_NOTIFICATIONS_TABLE)
        .update({ seen_at: seenAt, updated_at: seenAt })
        .eq('user_code', String(userCode))
        .in('notification_id', ids)
        .select('*');

    if (error) throw buildStorageError(error, GOOGLE_CLASSROOM_NOTIFICATIONS_TABLE, 'Failed to mark Google Classroom notifications as seen');
    return (data || []).map(decodeNotificationRow);
}

export async function listGoogleClassroomRegistrations(userCode) {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from(GOOGLE_CLASSROOM_REGISTRATIONS_TABLE)
        .select('*')
        .eq('user_code', String(userCode));

    if (error) throw buildStorageError(error, GOOGLE_CLASSROOM_REGISTRATIONS_TABLE, 'Failed to list Google Classroom registrations');
    return (data || []).map(decodeRegistrationRow);
}

export async function getGoogleClassroomRegistrationById(registrationId) {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from(GOOGLE_CLASSROOM_REGISTRATIONS_TABLE)
        .select('*')
        .eq('registration_id', String(registrationId))
        .single();

    if (error?.code === 'PGRST116') return null;
    if (error) throw buildStorageError(error, GOOGLE_CLASSROOM_REGISTRATIONS_TABLE, 'Failed to load Google Classroom registration');
    return decodeRegistrationRow(data);
}

export async function upsertGoogleClassroomRegistration(registration) {
    const supabase = getServiceSupabase();
    const row = encodeRegistrationRow(registration);
    const { data, error } = await supabase
        .from(GOOGLE_CLASSROOM_REGISTRATIONS_TABLE)
        .upsert(row, { onConflict: 'user_code,course_id' })
        .select('*')
        .single();

    if (error) throw buildStorageError(error, GOOGLE_CLASSROOM_REGISTRATIONS_TABLE, 'Failed to save Google Classroom registration');
    return decodeRegistrationRow(data);
}

export async function deleteGoogleClassroomRegistrationRecord(registrationId) {
    const supabase = getServiceSupabase();
    const { error } = await supabase
        .from(GOOGLE_CLASSROOM_REGISTRATIONS_TABLE)
        .delete()
        .eq('registration_id', String(registrationId));

    if (error) throw buildStorageError(error, GOOGLE_CLASSROOM_REGISTRATIONS_TABLE, 'Failed to delete Google Classroom registration record');
}
