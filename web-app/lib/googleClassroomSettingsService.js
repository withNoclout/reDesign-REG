import {
    deleteGoogleClassroomRegistration,
    isGoogleClassroomConfigured,
    isGoogleClassroomPushConfigured,
    refreshGoogleClassroomTokenBundle,
    resolveGoogleClassroomScopes,
    revokeGoogleOAuthToken,
} from './googleClassroom.js';
import {
    buildGoogleClassroomFeatureCatalog,
    getStoredGoogleClassroomSettings,
    normalizeGoogleClassroomFeatureSelection,
    saveStoredGoogleClassroomSettings,
} from './googleClassroomSettings.js';
import {
    countUnreadGoogleClassroomNotifications,
    deleteAllGoogleClassroomNotifications,
    deleteGoogleClassroomRegistrationRecord,
    getGoogleClassroomConnection,
    listGoogleClassroomRegistrations,
    updateGoogleClassroomConnection,
} from './googleClassroomStore.js';
import { syncGoogleClassroomNotifications } from './googleClassroomService.js';
import { getGoogleClassroomRolloutState, normalizeGoogleClassroomUserCode } from './googleClassroomRollout.js';

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeUserCode(value) {
    return normalizeGoogleClassroomUserCode(value);
}

function parseGrantedScopes(scopeValue) {
    return (readString(scopeValue) || '')
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function buildRolloutPayload(rollout) {
    return {
        mode: rollout.mode,
        enabled: rollout.enabled,
        reason: rollout.reason,
    };
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
    return updateGoogleClassroomConnection(connection.userCode, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken || connection.refreshToken,
        tokenType: refreshed.tokenType,
        scope: refreshed.scope,
        accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
        revokedAt: null,
        lastSyncError: null,
    });
}

export async function getGoogleClassroomSettingsSummary(userCode) {
    const normalizedUserCode = normalizeUserCode(userCode);
    const configured = isGoogleClassroomConfigured();
    const pushConfigured = isGoogleClassroomPushConfigured();
    const rollout = getGoogleClassroomRolloutState(normalizedUserCode);
    const selectedSettings = normalizedUserCode
        ? await getStoredGoogleClassroomSettings(normalizedUserCode, { pushAvailable: pushConfigured })
        : { selectedFeatures: normalizeGoogleClassroomFeatureSelection({}, { pushAvailable: pushConfigured }) };
    const selectedFeatures = selectedSettings.selectedFeatures;
    const featureCatalog = buildGoogleClassroomFeatureCatalog({ pushAvailable: pushConfigured });
    const requestedScopes = resolveGoogleClassroomScopes(selectedFeatures, { pushConfigured });

    if (!configured || !normalizedUserCode || !rollout.enabled) {
        return {
            configured,
            pushConfigured,
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
        };
    }

    const connection = await getGoogleClassroomConnection(normalizedUserCode);
    const unreadCount = connection && !connection.revokedAt
        ? await countUnreadGoogleClassroomNotifications(normalizedUserCode)
        : 0;

    return {
        configured,
        pushConfigured,
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
    };
}

export async function saveGoogleClassroomSettingsSummary(userCode, selectedFeatures) {
    const normalizedUserCode = normalizeUserCode(userCode);
    if (!normalizedUserCode) {
        throw new Error('Authenticated user is required to save Google Classroom settings');
    }

    await saveStoredGoogleClassroomSettings(normalizedUserCode, { selectedFeatures }, { pushAvailable: isGoogleClassroomPushConfigured() });
    return getGoogleClassroomSettingsSummary(normalizedUserCode);
}

export async function syncGoogleClassroomSettingsNow(userCode) {
    const normalizedUserCode = normalizeUserCode(userCode);
    if (!normalizedUserCode) {
        throw new Error('Authenticated user is required to sync Google Classroom');
    }

    await syncGoogleClassroomNotifications(normalizedUserCode, { force: true });
    return getGoogleClassroomSettingsSummary(normalizedUserCode);
}

export async function disconnectGoogleClassroom(userCode) {
    const normalizedUserCode = normalizeUserCode(userCode);
    if (!normalizedUserCode) {
        throw new Error('Authenticated user is required to disconnect Google Classroom');
    }

    const connection = await getGoogleClassroomConnection(normalizedUserCode);
    if (!connection) {
        return getGoogleClassroomSettingsSummary(normalizedUserCode);
    }

    try {
        const freshConnection = await ensureFreshConnection(connection);
        const registrations = await listGoogleClassroomRegistrations(normalizedUserCode);
        await Promise.all(registrations.map(async (registration) => {
            try {
                await deleteGoogleClassroomRegistration(freshConnection.accessToken, registration.registrationId);
            } catch (error) {
                console.warn('[Google Classroom] Failed to delete remote registration during disconnect:', error.message || error);
            }
            await deleteGoogleClassroomRegistrationRecord(registration.registrationId);
        }));

        try {
            await revokeGoogleOAuthToken(freshConnection.refreshToken || freshConnection.accessToken);
        } catch (error) {
            console.warn('[Google Classroom] Failed to revoke Google token during disconnect:', error.message || error);
        }
    } catch (error) {
        console.warn('[Google Classroom] Disconnect cleanup used degraded path:', error.message || error);
    }

    await updateGoogleClassroomConnection(normalizedUserCode, {
        accessToken: null,
        refreshToken: null,
        revokedAt: new Date().toISOString(),
        lastSyncError: null,
    });
    await deleteAllGoogleClassroomNotifications(normalizedUserCode);

    return getGoogleClassroomSettingsSummary(normalizedUserCode);
}
