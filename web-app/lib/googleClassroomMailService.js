import {
    exchangeGoogleClassroomAuthorizationCode,
    fetchGoogleClassroomUserInfo,
    getMissingGoogleClassroomConfig,
    isGoogleClassroomConfigured,
    normalizeGoogleClassroomUserInfo,
    refreshGoogleClassroomTokenBundle,
    revokeGoogleOAuthToken,
} from './googleClassroom.js';
import {
    buildGoogleClassroomFeatureCatalog,
    getStoredGoogleClassroomSettings,
    normalizeGoogleClassroomFeatureSelection,
    saveStoredGoogleClassroomSettings,
} from './googleClassroomSettings.js';
import { getGoogleClassroomMailScopes, listGoogleClassroomMailMessages, getGoogleClassroomMailMessage } from './googleClassroomMail.js';
import { parseGoogleClassroomMailNotification } from './googleClassroomMailParser.js';
import {
    countUnreadGoogleMailNotifications,
    deleteAllGoogleMailNotifications,
    getGoogleMailConnection,
    listGoogleMailNotifications,
    markGoogleMailNotificationsSeen,
    updateGoogleMailConnection,
    upsertGoogleMailConnection,
    upsertGoogleMailNotifications,
    upsertGoogleMailSyncCursor,
} from './googleClassroomMailStore.js';
import { getGoogleClassroomRolloutState, normalizeGoogleClassroomUserCode } from './googleClassroomRollout.js';

const DEFAULT_NOTIFICATION_LIMIT = 20;
const MIN_SYNC_INTERVAL_MS = 60 * 1000;

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeUserCode(value) {
    return normalizeGoogleClassroomUserCode(value);
}

function buildRolloutPayload(rollout) {
    return { mode: rollout.mode, enabled: rollout.enabled, reason: rollout.reason };
}

function parseGrantedScopes(scopeValue) {
    return (readString(scopeValue) || '').split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function buildConnectUrl(returnTo = '/settings/classroom') {
    return `/api/classroom/auth/start?returnTo=${encodeURIComponent(returnTo)}`;
}

async function ensureFreshConnection(connection) {
    const expiresAtMs = Date.parse(connection?.accessTokenExpiresAt || '');
    const needsRefresh = !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now() + 60_000;
    if (!needsRefresh) return connection;
    if (!connection?.refreshToken) return connection;

    const refreshed = await refreshGoogleClassroomTokenBundle(connection.refreshToken);
    return updateGoogleMailConnection(connection.userCode, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken || connection.refreshToken,
        tokenType: refreshed.tokenType,
        scope: refreshed.scope,
        accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
        revokedAt: null,
        lastSyncError: null,
    });
}

function buildNotificationSummary(notification) {
    return {
        id: notification.id,
        sourceType: notification.sourceType,
        courseName: notification.courseHint,
        href: notification.href,
        title: notification.title,
        message: notification.message,
        sortAt: notification.sortAt,
        resourceUpdatedAt: notification.resourceUpdatedAt || null,
        payload: notification.payload || {},
        seenAt: notification.seenAt,
    };
}

function shouldSync(connection, force) {
    if (force) return true;
    if (!connection?.lastSyncedAt) return true;
    const lastSyncedMs = Date.parse(connection.lastSyncedAt);
    if (!Number.isFinite(lastSyncedMs)) return true;
    return Date.now() - lastSyncedMs >= MIN_SYNC_INTERVAL_MS;
}

function doesGoogleMailUserMatchLocalUser(localUserCode, normalizedUser) {
    const expectedUserCode = normalizeUserCode(localUserCode);
    if (!expectedUserCode) return false;
    const email = typeof normalizedUser?.email === 'string' ? normalizedUser.email.trim().toLowerCase() : '';
    if (!email.includes('@')) return false;
    const localPart = email.split('@')[0] || '';
    const match = localPart.match(/s?(\d{6,15})$/i);
    return Boolean(match && match[1] === expectedUserCode);
}

async function fetchCandidateNotifications(accessToken) {
    const messageRefs = await listGoogleClassroomMailMessages(accessToken);
    const messageResults = await Promise.allSettled(messageRefs.map((item) => getGoogleClassroomMailMessage(accessToken, item.id)));
    return messageResults
        .filter((item) => item.status === 'fulfilled')
        .map((item) => parseGoogleClassroomMailNotification(item.value))
        .filter(Boolean)
        .sort((left, right) => Date.parse(right.sortAt) - Date.parse(left.sortAt));
}

export async function completeGoogleClassroomMailAuthorization({ userCode, code, codeVerifier }) {
    const tokenBundle = await exchangeGoogleClassroomAuthorizationCode(code, codeVerifier);
    const rawUserInfo = await fetchGoogleClassroomUserInfo(tokenBundle.accessToken);
    const normalizedUser = normalizeGoogleClassroomUserInfo(rawUserInfo);

    if (!normalizedUser.subject) {
        throw new Error('Google mail user info did not include a subject identifier');
    }
    if (!doesGoogleMailUserMatchLocalUser(userCode, normalizedUser)) {
        throw new Error('Google account does not match the currently signed-in student');
    }

    const existing = await getGoogleMailConnection(userCode);
    await upsertGoogleMailConnection({
        userCode: normalizeUserCode(userCode),
        googleUserId: normalizedUser.subject,
        email: normalizedUser.email,
        displayName: normalizedUser.displayName,
        pictureUrl: normalizedUser.pictureUrl,
        accessToken: tokenBundle.accessToken,
        refreshToken: tokenBundle.refreshToken || existing?.refreshToken,
        tokenType: tokenBundle.tokenType,
        scope: tokenBundle.scope,
        accessTokenExpiresAt: tokenBundle.accessTokenExpiresAt,
        lastSyncedAt: null,
        lastSyncError: null,
        revokedAt: null,
    });

    await syncGoogleClassroomMailNotifications(userCode, { force: true });
}

export async function getGoogleClassroomMailSettingsSummary(userCode) {
    const normalizedUserCode = normalizeUserCode(userCode);
    const configured = isGoogleClassroomConfigured();
    const rollout = getGoogleClassroomRolloutState(normalizedUserCode);
    const selectedSettings = normalizedUserCode
        ? await getStoredGoogleClassroomSettings(normalizedUserCode, { pushAvailable: false })
        : { selectedFeatures: normalizeGoogleClassroomFeatureSelection({}, { pushAvailable: false }) };
    const selectedFeatures = selectedSettings.selectedFeatures;
    const featureCatalog = buildGoogleClassroomFeatureCatalog({ pushAvailable: false });
    const requestedScopes = getGoogleClassroomMailScopes();

    if (!configured || !normalizedUserCode || !rollout.enabled) {
        return {
            configured,
            pushConfigured: false,
            rollout: buildRolloutPayload(rollout),
            connected: false,
            reconnectRequired: false,
            selectedFeatures,
            featureCatalog,
            requestedScopes,
            grantedScopes: [],
            unreadCount: 0,
            connectUrl: buildConnectUrl('/settings/classroom'),
            lastSyncedAt: null,
            lastSyncError: null,
            connection: null,
            mode: 'gmail-poc',
        };
    }

    const connection = await getGoogleMailConnection(normalizedUserCode);
    const unreadCount = connection && !connection.revokedAt
        ? await countUnreadGoogleMailNotifications(normalizedUserCode)
        : 0;

    return {
        configured,
        pushConfigured: false,
        rollout: buildRolloutPayload(rollout),
        connected: Boolean(connection && !connection.revokedAt),
        reconnectRequired: Boolean(connection?.revokedAt),
        selectedFeatures,
        featureCatalog,
        requestedScopes,
        grantedScopes: parseGrantedScopes(connection?.scope),
        unreadCount,
        connectUrl: buildConnectUrl('/settings/classroom'),
        lastSyncedAt: connection?.lastSyncedAt || null,
        lastSyncError: connection?.lastSyncError || null,
        connection: connection ? {
            email: connection.email || null,
            displayName: connection.displayName || null,
            pictureUrl: connection.pictureUrl || null,
            googleUserId: connection.googleUserId || null,
            tokenType: connection.tokenType || null,
            accessTokenExpiresAt: connection.accessTokenExpiresAt || null,
            scope: connection.scope || null,
            createdAt: connection.createdAt || null,
            updatedAt: connection.updatedAt || null,
            revokedAt: connection.revokedAt || null,
        } : null,
        mode: 'gmail-poc',
    };
}

export async function saveGoogleClassroomMailSettingsSummary(userCode, selectedFeatures) {
    const normalizedUserCode = normalizeUserCode(userCode);
    if (!normalizedUserCode) throw new Error('Authenticated user is required to save Gmail-backed Classroom settings');
    await saveStoredGoogleClassroomSettings(normalizedUserCode, { selectedFeatures }, { pushAvailable: false });
    return getGoogleClassroomMailSettingsSummary(normalizedUserCode);
}

export async function syncGoogleClassroomMailNotifications(userCode, { force = false } = {}) {
    const normalizedUserCode = normalizeUserCode(userCode);
    const rollout = getGoogleClassroomRolloutState(normalizedUserCode);
    if (!normalizedUserCode || !isGoogleClassroomConfigured()) {
        return {
            configured: isGoogleClassroomConfigured(),
            connected: false,
            reconnectRequired: false,
            notifications: [],
            unreadCount: 0,
            lastSyncedAt: null,
            lastSyncError: null,
            rollout: buildRolloutPayload(rollout),
            mode: 'gmail-poc',
        };
    }
    if (!rollout.enabled) {
        return {
            configured: true,
            connected: false,
            reconnectRequired: false,
            notifications: [],
            unreadCount: 0,
            lastSyncedAt: null,
            lastSyncError: null,
            rollout: buildRolloutPayload(rollout),
            mode: 'gmail-poc',
        };
    }

    const existingConnection = await getGoogleMailConnection(normalizedUserCode);
    if (!existingConnection || existingConnection.revokedAt) {
        return {
            configured: true,
            connected: false,
            reconnectRequired: Boolean(existingConnection?.revokedAt),
            notifications: [],
            unreadCount: 0,
            lastSyncedAt: existingConnection?.lastSyncedAt || null,
            lastSyncError: existingConnection?.lastSyncError || null,
            rollout: buildRolloutPayload(rollout),
            mode: 'gmail-poc',
        };
    }

    if (!shouldSync(existingConnection, force)) {
        const [notifications, unreadCount] = await Promise.all([
            listGoogleMailNotifications(normalizedUserCode, { limit: DEFAULT_NOTIFICATION_LIMIT }),
            countUnreadGoogleMailNotifications(normalizedUserCode),
        ]);
        return {
            configured: true,
            connected: true,
            reconnectRequired: false,
            notifications: notifications.map(buildNotificationSummary),
            unreadCount,
            lastSyncedAt: existingConnection.lastSyncedAt,
            lastSyncError: existingConnection.lastSyncError,
            rollout: buildRolloutPayload(rollout),
            mode: 'gmail-poc',
        };
    }

    try {
        const freshConnection = await ensureFreshConnection(existingConnection);
        const notifications = await fetchCandidateNotifications(freshConnection.accessToken);
        await upsertGoogleMailNotifications(normalizedUserCode, notifications);
        const latest = notifications[0] || null;
        await updateGoogleMailConnection(normalizedUserCode, {
            lastSyncedAt: new Date().toISOString(),
            lastSyncError: null,
            revokedAt: null,
        });
        await upsertGoogleMailSyncCursor({
            userCode: normalizedUserCode,
            lastMessageInternalDate: latest?.payload?.internalDate || latest?.sortAt || null,
            lastHistoryId: latest?.payload?.historyId || null,
            lastQueryAt: new Date().toISOString(),
            lastSuccessAt: new Date().toISOString(),
            lastError: null,
        }).catch(() => null);

        const [storedNotifications, unreadCount] = await Promise.all([
            listGoogleMailNotifications(normalizedUserCode, { limit: DEFAULT_NOTIFICATION_LIMIT }),
            countUnreadGoogleMailNotifications(normalizedUserCode),
        ]);

        return {
            configured: true,
            connected: true,
            reconnectRequired: false,
            notifications: storedNotifications.map(buildNotificationSummary),
            unreadCount,
            lastSyncedAt: new Date().toISOString(),
            lastSyncError: null,
            rollout: buildRolloutPayload(rollout),
            mode: 'gmail-poc',
        };
    } catch (error) {
        await updateGoogleMailConnection(normalizedUserCode, {
            lastSyncError: error.message || 'Failed to sync Gmail classroom notifications',
            revokedAt: error.status === 401 ? new Date().toISOString() : existingConnection.revokedAt,
        }).catch(() => null);
        return {
            configured: true,
            connected: error.status !== 401,
            reconnectRequired: error.status === 401,
            notifications: [],
            unreadCount: 0,
            lastSyncedAt: existingConnection.lastSyncedAt,
            lastSyncError: error.message || 'Failed to sync Gmail classroom notifications',
            rollout: buildRolloutPayload(rollout),
            mode: 'gmail-poc',
        };
    }
}

export async function getGoogleClassroomMailNotificationFeed(userCode, { force = false, limit = DEFAULT_NOTIFICATION_LIMIT } = {}) {
    const syncResult = await syncGoogleClassroomMailNotifications(userCode, { force });
    if (!syncResult.connected) return syncResult;
    const notifications = limit === DEFAULT_NOTIFICATION_LIMIT
        ? syncResult.notifications
        : (await listGoogleMailNotifications(normalizeUserCode(userCode), { limit })).map(buildNotificationSummary);
    return { ...syncResult, notifications };
}

export async function markGoogleClassroomMailNotificationsSeenForUser(userCode, notificationIds) {
    const normalizedUserCode = normalizeUserCode(userCode);
    const updated = await markGoogleMailNotificationsSeen(normalizedUserCode, notificationIds);
    const unreadCount = await countUnreadGoogleMailNotifications(normalizedUserCode);
    return { updated, unreadCount };
}

export async function disconnectGoogleClassroomMail(userCode) {
    const normalizedUserCode = normalizeUserCode(userCode);
    if (!normalizedUserCode) throw new Error('Authenticated user is required to disconnect Gmail-backed Classroom');
    const connection = await getGoogleMailConnection(normalizedUserCode);
    if (!connection) return getGoogleClassroomMailSettingsSummary(normalizedUserCode);
    const freshConnection = await ensureFreshConnection(connection).catch(() => connection);
    try {
        await revokeGoogleOAuthToken(freshConnection.refreshToken || freshConnection.accessToken);
    } catch {
        // Best effort only.
    }
    await updateGoogleMailConnection(normalizedUserCode, {
        accessToken: null,
        refreshToken: null,
        revokedAt: new Date().toISOString(),
        lastSyncError: null,
    });
    await deleteAllGoogleMailNotifications(normalizedUserCode);
    return getGoogleClassroomMailSettingsSummary(normalizedUserCode);
}
export function getGoogleClassroomMailConnectScopes() {
    return getGoogleClassroomMailScopes();
}

export function getGoogleClassroomMailMissingConfig() {
    return getMissingGoogleClassroomConfig();
}

export function canUseGoogleClassroomMailFlow() {
    return isGoogleClassroomConfigured();
}
