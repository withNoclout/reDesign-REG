import { normalizeGoogleClassroomFeatureSelection } from './googleClassroomSettings.js';
import { getClientGoogleMailConfig, getClientGoogleMailRollout, normalizeClientClassroomUserCode } from './googleClientMailConfig.js';

const STORAGE_PREFIX = 'reg_gmail_classroom_poc_v1';

function ensureBrowser() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function buildStorageKey(kind, userCode) {
    const normalizedUserCode = normalizeClientClassroomUserCode(userCode) || 'guest';
    return `${STORAGE_PREFIX}:${kind}:${normalizedUserCode}`;
}

function safeReadJson(key, fallback) {
    if (!ensureBrowser()) return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function safeWriteJson(key, value) {
    if (!ensureBrowser()) return;
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // ignore
    }
}

function safeRemove(key) {
    if (!ensureBrowser()) return;
    try {
        window.localStorage.removeItem(key);
    } catch {
        // ignore
    }
}

export function getClientGoogleMailSettings(userCode) {
    const stored = safeReadJson(buildStorageKey('settings', userCode), null);
    return normalizeGoogleClassroomFeatureSelection(stored?.selectedFeatures || {}, { pushAvailable: false });
}

export function saveClientGoogleMailSettings(userCode, selectedFeatures) {
    const normalized = normalizeGoogleClassroomFeatureSelection(selectedFeatures || {}, { pushAvailable: false });
    safeWriteJson(buildStorageKey('settings', userCode), {
        selectedFeatures: normalized,
        updatedAt: new Date().toISOString(),
    });
    return normalized;
}

export function getClientGoogleMailConnection(userCode) {
    return safeReadJson(buildStorageKey('connection', userCode), null);
}

export function saveClientGoogleMailConnection(userCode, connection) {
    const normalizedUserCode = normalizeClientClassroomUserCode(userCode);
    const payload = {
        userCode: normalizedUserCode,
        email: connection.email || null,
        displayName: connection.displayName || null,
        accessToken: connection.accessToken,
        scope: connection.scope || '',
        tokenType: connection.tokenType || 'Bearer',
        expiresAt: connection.expiresAt || null,
        lastSyncedAt: connection.lastSyncedAt || null,
        lastSyncError: connection.lastSyncError || null,
        updatedAt: new Date().toISOString(),
    };
    safeWriteJson(buildStorageKey('connection', userCode), payload);
    return payload;
}

export function clearClientGoogleMailConnection(userCode) {
    safeRemove(buildStorageKey('connection', userCode));
    safeRemove(buildStorageKey('notifications', userCode));
}

export function getClientGoogleMailNotifications(userCode) {
    const stored = safeReadJson(buildStorageKey('notifications', userCode), []);
    return Array.isArray(stored) ? stored : [];
}

export function saveClientGoogleMailNotifications(userCode, notifications) {
    const normalized = Array.isArray(notifications) ? notifications : [];
    safeWriteJson(buildStorageKey('notifications', userCode), normalized);
    return normalized;
}

export function markClientGoogleMailNotificationsSeen(userCode, notificationIds) {
    const ids = new Set((notificationIds || []).map((item) => String(item)));
    const seenAt = new Date().toISOString();
    const notifications = getClientGoogleMailNotifications(userCode).map((item) => (
        ids.has(item.id) ? { ...item, seenAt: item.seenAt || seenAt } : item
    ));
    saveClientGoogleMailNotifications(userCode, notifications);
    return notifications;
}

export function countUnreadClientGoogleMailNotifications(userCode) {
    return getClientGoogleMailNotifications(userCode).filter((item) => !item.seenAt).length;
}

export function buildClientGoogleMailSettingsSummary(userCode) {
    const normalizedUserCode = normalizeClientClassroomUserCode(userCode);
    const config = getClientGoogleMailConfig();
    const rollout = getClientGoogleMailRollout(normalizedUserCode);
    const connection = getClientGoogleMailConnection(normalizedUserCode);
    const selectedFeatures = getClientGoogleMailSettings(normalizedUserCode);
    return {
        configured: Boolean(config.clientId),
        pushConfigured: false,
        rollout,
        connected: Boolean(connection?.accessToken),
        reconnectRequired: false,
        selectedFeatures,
        featureCatalog: [
            {
                key: 'announcements',
                label: 'ประกาศจาก Google Classroom',
                description: 'อ่านข้อความอีเมลแจ้งเตือนจาก Google Classroom แล้วนำประกาศใหม่มาแสดงในกระดิ่งแจ้งเตือน',
                required: true,
                available: true,
            },
            {
                key: 'coursework',
                label: 'งานหรือ assignment ใหม่',
                description: 'อ่านข้อความอีเมลแจ้งเตือนเมื่อมี coursework ใหม่หรือมีการอัปเดตรายละเอียดของงาน',
                required: true,
                available: true,
            },
            {
                key: 'returnedWork',
                label: 'งานที่ถูกส่งคืนและคะแนน',
                description: 'อ่านข้อความอีเมลแจ้งเตือนเมื่ออาจารย์ส่งคืนงานหรือมีการอัปเดตคะแนนของคุณ',
                required: true,
                available: true,
            },
        ],
        requestedScopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly'],
        grantedScopes: connection?.scope ? connection.scope.split(/\s+/).filter(Boolean) : [],
        unreadCount: countUnreadClientGoogleMailNotifications(normalizedUserCode),
        connectUrl: null,
        lastSyncedAt: connection?.lastSyncedAt || null,
        lastSyncError: connection?.lastSyncError || null,
        connection: connection ? {
            email: connection.email || null,
            displayName: connection.displayName || null,
            accessTokenExpiresAt: connection.expiresAt || null,
        } : null,
        mode: 'gmail-client-poc',
    };
}

export function buildClientGoogleMailReadiness(userCode) {
    const normalizedUserCode = normalizeClientClassroomUserCode(userCode);
    const config = getClientGoogleMailConfig();
    const rollout = getClientGoogleMailRollout(normalizedUserCode);
    const connection = getClientGoogleMailConnection(normalizedUserCode);
    const configured = Boolean(config.clientId);
    const connected = Boolean(connection?.accessToken);

    const checklist = [
        {
            id: 'public-client-id',
            label: 'Public Google OAuth Client ID พร้อมใช้งาน',
            ready: configured,
            detail: configured ? null : 'Missing NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID',
        },
        {
            id: 'rollout',
            label: 'Rollout อนุญาตให้ user นี้ใช้งาน',
            ready: rollout.enabled,
            detail: `mode=${rollout.mode}; reason=${rollout.reason}`,
        },
        {
            id: 'browser-connection',
            label: 'มี browser-side Google Mail session',
            ready: connected,
            detail: connected ? (connection.email || 'Connected') : 'ยังไม่อนุญาต Gmail readonly ผ่าน Google popup',
        },
        {
            id: 'notifications',
            label: 'มีอีเมล Classroom ที่ parse แล้ว',
            ready: getClientGoogleMailNotifications(normalizedUserCode).length > 0,
            detail: `notifications=${getClientGoogleMailNotifications(normalizedUserCode).length}`,
        },
    ];

    const blockers = [];
    if (!configured) blockers.push({ id: 'missing-public-client-id', severity: 'critical', message: 'ยังขาด NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID' });
    if (rollout.mode === 'off') blockers.push({ id: 'rollout-off', severity: 'critical', message: 'Google Mail Classroom POC ถูกปิดใช้งานชั่วคราว' });
    else if (!rollout.enabled) blockers.push({ id: 'pilot-restricted', severity: 'warning', message: 'ผู้ใช้นี้ยังไม่อยู่ใน pilot rollout' });
    if (configured && rollout.enabled && !connected) blockers.push({ id: 'not-connected', severity: 'warning', message: 'ผู้ใช้ยังไม่ได้อนุญาต Gmail readonly ผ่าน Google popup' });

    return {
        checkedAt: new Date().toISOString(),
        status: blockers.some((item) => item.severity === 'critical') ? 'blocked' : (blockers.length ? 'attention' : 'ready'),
        configured,
        pushConfigured: false,
        missingConfig: configured ? [] : ['NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID'],
        rollout,
        connected,
        reconnectRequired: false,
        mode: 'gmail-client-poc',
        connection: connection ? {
            email: connection.email || null,
            displayName: connection.displayName || null,
            accessTokenExpiresAt: connection.expiresAt || null,
            lastSyncedAt: connection.lastSyncedAt || null,
            lastSyncError: connection.lastSyncError || null,
        } : null,
        checklist,
        blockers,
        nextSteps: !configured
            ? ['ตั้งค่า NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ใน environment ของ client']
            : (!connected
                ? ['ให้ผู้ใช้กด Apply และ Connect Google Mail ผ่าน popup', 'อนุญาต Gmail readonly แล้ว sync เพื่อดึง email แจ้งเตือน Classroom']
                : ['สั่ง sync เพื่อยืนยันว่ามี email แจ้งเตือน Classroom จริงและ Notification Bell แสดงผลได้']),
    };
}
