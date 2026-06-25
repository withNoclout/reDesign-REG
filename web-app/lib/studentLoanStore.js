import { getServiceSupabase } from './supabase.js';

const USER_SETTINGS_TABLE = 'user_settings';
const SYSTEM_ROW_USER_ID = '__student_loan_system__';
const LEGACY_NAMESPACE = 'studentLoan';
const CENTRAL_NAMESPACE = 'studentLoanCentral';

const STUDENT_LOAN_SOURCE_SNAPSHOTS_TABLE = 'student_loan_source_snapshots';
const STUDENT_LOAN_EVENTS_TABLE = 'student_loan_events';
const STUDENT_LOAN_PROFILES_TABLE = 'student_loan_profiles';
const STUDENT_LOAN_NOTIFICATION_INSTANCES_TABLE = 'student_loan_notification_instances';
const STUDENT_LOAN_ROLLOUT_OVERRIDES_TABLE = 'student_loan_rollout_overrides';

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
        || message.includes(`relation "public.${tableName}" does not exist`)
        || message.includes(`relation "${tableName}" does not exist`);
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

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readBoolean(value, fallback = false) {
    return typeof value === 'boolean' ? value : fallback;
}

function readIsoString(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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

function readCentralConfig(config) {
    return normalizeObject(normalizeObject(config)[CENTRAL_NAMESPACE]);
}

function readLegacyConfig(config) {
    return normalizeObject(normalizeObject(config)[LEGACY_NAMESPACE]);
}

function mergeCentralConfig(config, nextCentralConfig) {
    return {
        ...normalizeObject(config),
        [CENTRAL_NAMESPACE]: normalizeObject(nextCentralConfig),
    };
}

function decodeSourceSnapshotRow(row) {
    return {
        id: row.id,
        sourceKey: readString(row.source_key),
        sourceUrl: readString(row.source_url),
        contentHash: readString(row.content_hash),
        rawPayload: normalizeObject(row.raw_payload),
        parsedPayload: normalizeObject(row.parsed_payload),
        fetchedAt: readIsoString(row.fetched_at),
        createdAt: readIsoString(row.created_at),
    };
}

function encodeSourceSnapshotRow(snapshot) {
    return {
        source_key: String(snapshot.sourceKey),
        source_url: String(snapshot.sourceUrl),
        content_hash: String(snapshot.contentHash),
        raw_payload: normalizeObject(snapshot.rawPayload),
        parsed_payload: normalizeObject(snapshot.parsedPayload),
        fetched_at: readIsoString(snapshot.fetchedAt) || new Date().toISOString(),
    };
}

function normalizeSourceSnapshotRecord(snapshot) {
    return {
        id: snapshot.id || null,
        sourceKey: String(snapshot.sourceKey),
        sourceUrl: String(snapshot.sourceUrl),
        contentHash: String(snapshot.contentHash),
        rawPayload: normalizeObject(snapshot.rawPayload),
        parsedPayload: normalizeObject(snapshot.parsedPayload),
        fetchedAt: readIsoString(snapshot.fetchedAt) || new Date().toISOString(),
        createdAt: readIsoString(snapshot.createdAt) || new Date().toISOString(),
    };
}

function decodeEventRow(row) {
    return {
        eventId: readString(row.event_id),
        sourceKey: readString(row.source_key),
        audience: readString(row.audience),
        educationLevel: readString(row.education_level),
        stage: readString(row.stage),
        phase: readString(row.phase),
        title: readString(row.title),
        message: readString(row.message),
        href: readString(row.href),
        opensAt: readIsoString(row.opens_at),
        closesAt: readIsoString(row.closes_at),
        visibleFrom: readIsoString(row.visible_from),
        visibleUntil: readIsoString(row.visible_until),
        dismissStrategy: readString(row.dismiss_strategy),
        sourceHash: readString(row.source_hash),
        payload: normalizeObject(row.payload),
        createdAt: readIsoString(row.created_at),
        updatedAt: readIsoString(row.updated_at),
    };
}

function encodeEventRow(event) {
    return {
        event_id: String(event.eventId),
        source_key: String(event.sourceKey),
        audience: String(event.audience),
        education_level: String(event.educationLevel),
        stage: String(event.stage),
        phase: String(event.phase),
        title: String(event.title),
        message: String(event.message),
        href: String(event.href),
        opens_at: String(event.opensAt),
        closes_at: String(event.closesAt),
        visible_from: String(event.visibleFrom),
        visible_until: String(event.visibleUntil),
        dismiss_strategy: String(event.dismissStrategy),
        source_hash: String(event.sourceHash),
        payload: normalizeObject(event.payload),
    };
}

function normalizeEventRecord(event) {
    return {
        eventId: String(event.eventId),
        sourceKey: String(event.sourceKey),
        audience: String(event.audience),
        educationLevel: String(event.educationLevel),
        stage: String(event.stage),
        phase: String(event.phase),
        title: String(event.title),
        message: String(event.message),
        href: String(event.href),
        opensAt: String(event.opensAt),
        closesAt: String(event.closesAt),
        visibleFrom: String(event.visibleFrom),
        visibleUntil: String(event.visibleUntil),
        dismissStrategy: String(event.dismissStrategy),
        sourceHash: String(event.sourceHash),
        payload: normalizeObject(event.payload),
        createdAt: readIsoString(event.createdAt) || new Date().toISOString(),
        updatedAt: readIsoString(event.updatedAt) || new Date().toISOString(),
    };
}

function decodeProfileRow(row) {
    return {
        userCode: readString(row.user_code),
        borrowerType: readString(row.borrower_type),
        educationLevel: readString(row.education_level),
        source: readString(row.source),
        confirmedAt: readIsoString(row.confirmed_at),
        createdAt: readIsoString(row.created_at),
        updatedAt: readIsoString(row.updated_at),
    };
}

function encodeProfileRow(profile) {
    return {
        user_code: String(profile.userCode),
        borrower_type: String(profile.borrowerType),
        education_level: String(profile.educationLevel),
        source: String(profile.source),
        confirmed_at: readIsoString(profile.confirmedAt) || new Date().toISOString(),
    };
}

function normalizeProfileRecord(profile) {
    return {
        userCode: String(profile.userCode),
        borrowerType: String(profile.borrowerType),
        educationLevel: String(profile.educationLevel),
        source: String(profile.source),
        confirmedAt: readIsoString(profile.confirmedAt) || new Date().toISOString(),
        createdAt: readIsoString(profile.createdAt) || new Date().toISOString(),
        updatedAt: readIsoString(profile.updatedAt) || new Date().toISOString(),
    };
}

function decodeRolloutOverrideRow(row) {
    return {
        userCode: readString(row.user_code),
        enabled: readBoolean(row.enabled),
        mode: readString(row.mode) || 'live',
        previewNow: readIsoString(row.preview_now),
        notes: readString(row.notes),
        createdAt: readIsoString(row.created_at),
        updatedAt: readIsoString(row.updated_at),
    };
}

function encodeRolloutOverrideRow(override) {
    return {
        user_code: String(override.userCode),
        enabled: readBoolean(override.enabled, false),
        mode: readString(override.mode) || 'live',
        preview_now: readIsoString(override.previewNow),
        notes: readString(override.notes),
    };
}

function normalizeRolloutOverrideRecord(override) {
    return {
        userCode: String(override.userCode),
        enabled: readBoolean(override.enabled, false),
        mode: readString(override.mode) || 'live',
        previewNow: readIsoString(override.previewNow),
        notes: readString(override.notes),
        createdAt: readIsoString(override.createdAt) || new Date().toISOString(),
        updatedAt: readIsoString(override.updatedAt) || new Date().toISOString(),
    };
}

function decodeNotificationInstanceRow(row) {
    return {
        id: row.id,
        userCode: readString(row.user_code),
        eventId: readString(row.event_id),
        status: readString(row.status),
        visibleFrom: readIsoString(row.visible_from),
        visibleUntil: readIsoString(row.visible_until),
        clickedAt: readIsoString(row.clicked_at),
        resolvedAt: readIsoString(row.resolved_at),
        resolutionReason: readString(row.resolution_reason),
        preview: readBoolean(row.preview),
        createdAt: readIsoString(row.created_at),
        updatedAt: readIsoString(row.updated_at),
    };
}

function encodeNotificationInstanceRow(instance) {
    return {
        user_code: String(instance.userCode),
        event_id: String(instance.eventId),
        status: String(instance.status),
        visible_from: String(instance.visibleFrom),
        visible_until: String(instance.visibleUntil),
        clicked_at: readIsoString(instance.clickedAt),
        resolved_at: readIsoString(instance.resolvedAt),
        resolution_reason: readString(instance.resolutionReason),
        preview: readBoolean(instance.preview),
    };
}

function normalizeNotificationInstanceRecord(instance) {
    return {
        id: instance.id || `${instance.userCode}:${instance.eventId}`,
        userCode: String(instance.userCode),
        eventId: String(instance.eventId),
        status: String(instance.status),
        visibleFrom: String(instance.visibleFrom),
        visibleUntil: String(instance.visibleUntil),
        clickedAt: readIsoString(instance.clickedAt),
        resolvedAt: readIsoString(instance.resolvedAt),
        resolutionReason: readString(instance.resolutionReason),
        preview: readBoolean(instance.preview),
        createdAt: readIsoString(instance.createdAt) || new Date().toISOString(),
        updatedAt: readIsoString(instance.updatedAt) || new Date().toISOString(),
    };
}

async function upsertStudentLoanSourceSnapshotsFallback(snapshots) {
    const normalized = snapshots.map(normalizeSourceSnapshotRecord);
    await updateUserSettingsConfig(SYSTEM_ROW_USER_ID, (config) => {
        const central = readCentralConfig(config);
        const nextSnapshots = { ...normalizeObject(central.sourceSnapshots) };
        for (const snapshot of normalized) {
            nextSnapshots[snapshot.sourceKey] = snapshot;
        }
        return mergeCentralConfig(config, {
            ...central,
            sourceSnapshots: nextSnapshots,
            updatedAt: new Date().toISOString(),
        });
    });
    return normalized;
}

async function listLatestStudentLoanSourceSnapshotsFallback() {
    const row = await getUserSettingsRow(SYSTEM_ROW_USER_ID);
    const central = readCentralConfig(row?.portfolio_config);
    return Object.values(normalizeObject(central.sourceSnapshots)).map(normalizeSourceSnapshotRecord);
}

async function upsertStudentLoanEventsFallback(events) {
    const normalized = events.map(normalizeEventRecord);
    await updateUserSettingsConfig(SYSTEM_ROW_USER_ID, (config) => {
        const central = readCentralConfig(config);
        const nextEvents = { ...normalizeObject(central.eventsById) };
        for (const event of normalized) {
            nextEvents[event.eventId] = event;
        }
        return mergeCentralConfig(config, {
            ...central,
            eventsById: nextEvents,
            updatedAt: new Date().toISOString(),
        });
    });
    return normalized;
}

async function deleteStudentLoanEventsNotInSetFallback(sourceKeys, eventIds) {
    const normalizedSourceKeys = new Set((sourceKeys || []).map((value) => String(value).trim()).filter(Boolean));
    const normalizedEventIds = new Set((eventIds || []).map((value) => String(value).trim()).filter(Boolean));

    await updateUserSettingsConfig(SYSTEM_ROW_USER_ID, (config) => {
        const central = readCentralConfig(config);
        const current = normalizeObject(central.eventsById);
        const nextEvents = {};

        for (const [eventId, event] of Object.entries(current)) {
            if (normalizedSourceKeys.has(event.sourceKey) && !normalizedEventIds.has(eventId)) {
                continue;
            }
            nextEvents[eventId] = normalizeEventRecord(event);
        }

        return mergeCentralConfig(config, {
            ...central,
            eventsById: nextEvents,
            updatedAt: new Date().toISOString(),
        });
    });
}

async function listStudentLoanEventsFallback() {
    const row = await getUserSettingsRow(SYSTEM_ROW_USER_ID);
    const central = readCentralConfig(row?.portfolio_config);
    return Object.values(normalizeObject(central.eventsById))
        .map(normalizeEventRecord)
        .sort((left, right) => new Date(left.opensAt).getTime() - new Date(right.opensAt).getTime());
}

async function getStudentLoanProfileFallback(userCode) {
    const row = await getUserSettingsRow(userCode);
    const central = readCentralConfig(row?.portfolio_config);
    const profile = central.profile;
    if (!profile) return null;
    return normalizeProfileRecord(profile);
}

async function upsertStudentLoanProfileFallback(profile) {
    const normalized = normalizeProfileRecord(profile);
    await updateUserSettingsConfig(normalized.userCode, (config) => {
        const central = readCentralConfig(config);
        const legacy = readLegacyConfig(config);
        return {
            ...mergeCentralConfig(config, {
                ...central,
                profile: normalized,
                updatedAt: new Date().toISOString(),
            }),
            [LEGACY_NAMESPACE]: {
                ...legacy,
                borrowerProfile: {
                    borrowerType: normalized.borrowerType,
                    educationLevel: normalized.educationLevel,
                    source: normalized.source === 'seeded' ? 'manual' : normalized.source,
                    confirmedAt: normalized.confirmedAt,
                    updatedAt: new Date().toISOString(),
                },
            },
        };
    });
    return normalized;
}

async function listStudentLoanProfilesFallback(userCodes) {
    const normalizedUserCodes = Array.from(new Set((userCodes || []).map((value) => String(value).trim()).filter(Boolean)));
    const profiles = await Promise.all(normalizedUserCodes.map((userCode) => getStudentLoanProfileFallback(userCode)));
    return profiles.filter(Boolean);
}

async function getStudentLoanRolloutOverrideFallback(userCode) {
    const row = await getUserSettingsRow(userCode);
    const central = readCentralConfig(row?.portfolio_config);
    const override = central.rolloutOverride;
    return override ? normalizeRolloutOverrideRecord(override) : null;
}

async function upsertStudentLoanRolloutOverrideFallback(override) {
    const normalized = normalizeRolloutOverrideRecord(override);
    await updateUserSettingsConfig(normalized.userCode, (config) => {
        const central = readCentralConfig(config);
        return mergeCentralConfig(config, {
            ...central,
            rolloutOverride: normalized,
            updatedAt: new Date().toISOString(),
        });
    });
    return normalized;
}

async function listEnabledStudentLoanRolloutOverridesFallback(userCodes = null) {
    const normalizedUserCodes = Array.isArray(userCodes)
        ? Array.from(new Set(userCodes.map((value) => String(value).trim()).filter(Boolean)))
        : null;

    if (normalizedUserCodes && normalizedUserCodes.length > 0) {
        const overrides = await Promise.all(normalizedUserCodes.map((userCode) => getStudentLoanRolloutOverrideFallback(userCode)));
        return overrides.filter((override) => override?.enabled);
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
        .from(USER_SETTINGS_TABLE)
        .select('user_id, portfolio_config');

    if (error) {
        throw buildStorageError(error, USER_SETTINGS_TABLE, 'Failed to list fallback rollout overrides');
    }

    return (data || [])
        .map((row) => {
            const central = readCentralConfig(row.portfolio_config);
            return central.rolloutOverride ? normalizeRolloutOverrideRecord(central.rolloutOverride) : null;
        })
        .filter((override) => override?.enabled);
}

async function listStudentLoanNotificationInstancesFallback(userCode, statuses = null) {
    const row = await getUserSettingsRow(userCode);
    const central = readCentralConfig(row?.portfolio_config);
    const statusSet = Array.isArray(statuses)
        ? new Set(statuses.map((value) => String(value).trim()).filter(Boolean))
        : null;

    return Object.values(normalizeObject(central.notificationInstances))
        .map(normalizeNotificationInstanceRecord)
        .filter((instance) => !statusSet || statusSet.has(instance.status))
        .sort((left, right) => new Date(left.visibleFrom).getTime() - new Date(right.visibleFrom).getTime());
}

async function upsertStudentLoanNotificationInstancesFallback(instances) {
    if (!Array.isArray(instances) || instances.length === 0) return [];

    const instancesByUserCode = new Map();
    for (const instance of instances.map(normalizeNotificationInstanceRecord)) {
        if (!instancesByUserCode.has(instance.userCode)) {
            instancesByUserCode.set(instance.userCode, []);
        }
        instancesByUserCode.get(instance.userCode).push(instance);
    }

    for (const [userCode, userInstances] of instancesByUserCode.entries()) {
        await updateUserSettingsConfig(userCode, (config) => {
            const central = readCentralConfig(config);
            const nextInstances = { ...normalizeObject(central.notificationInstances) };
            for (const instance of userInstances) {
                nextInstances[instance.eventId] = instance;
            }
            return mergeCentralConfig(config, {
                ...central,
                notificationInstances: nextInstances,
                updatedAt: new Date().toISOString(),
            });
        });
    }

    return instances.map(normalizeNotificationInstanceRecord);
}

async function hideStudentLoanNotificationInstancesExceptFallback(userCode, eventIds) {
    const keepEventIds = new Set((eventIds || []).map((value) => String(value).trim()).filter(Boolean));
    await updateUserSettingsConfig(userCode, (config) => {
        const central = readCentralConfig(config);
        const nextInstances = { ...normalizeObject(central.notificationInstances) };
        const now = new Date().toISOString();

        for (const [eventId, instance] of Object.entries(nextInstances)) {
            if (keepEventIds.has(eventId)) continue;
            nextInstances[eventId] = {
                ...normalizeNotificationInstanceRecord(instance),
                status: 'hidden',
                resolvedAt: now,
                resolutionReason: 'rollout',
                updatedAt: now,
            };
        }

        return mergeCentralConfig(config, {
            ...central,
            notificationInstances: nextInstances,
            updatedAt: now,
        });
    });
}

async function markStudentLoanNotificationInstanceClickedFallback(userCode, eventId) {
    const clickedAt = new Date().toISOString();
    await updateUserSettingsConfig(userCode, (config) => {
        const central = readCentralConfig(config);
        const nextInstances = { ...normalizeObject(central.notificationInstances) };
        const current = normalizeNotificationInstanceRecord(nextInstances[eventId] || { userCode, eventId, status: 'clicked', visibleFrom: clickedAt, visibleUntil: clickedAt });
        nextInstances[eventId] = {
            ...current,
            status: 'clicked',
            clickedAt,
            resolvedAt: clickedAt,
            resolutionReason: 'click',
            updatedAt: clickedAt,
        };
        return mergeCentralConfig(config, {
            ...central,
            notificationInstances: nextInstances,
            updatedAt: clickedAt,
        });
    });
    return listStudentLoanNotificationInstancesFallback(userCode);
}

export async function upsertStudentLoanSourceSnapshots(snapshots) {
    if (!Array.isArray(snapshots) || snapshots.length === 0) return [];

    return withFallback(
        STUDENT_LOAN_SOURCE_SNAPSHOTS_TABLE,
        async () => {
            const supabase = getServiceSupabase();
            const rows = snapshots.map(encodeSourceSnapshotRow);
            const { data, error } = await supabase
                .from(STUDENT_LOAN_SOURCE_SNAPSHOTS_TABLE)
                .upsert(rows, { onConflict: 'source_key,content_hash' })
                .select('*');

            if (error) throw buildStorageError(error, STUDENT_LOAN_SOURCE_SNAPSHOTS_TABLE, 'Failed to save student loan source snapshots');
            return (data || []).map(decodeSourceSnapshotRow);
        },
        () => upsertStudentLoanSourceSnapshotsFallback(snapshots),
    );
}

export async function listLatestStudentLoanSourceSnapshots() {
    return withFallback(
        STUDENT_LOAN_SOURCE_SNAPSHOTS_TABLE,
        async () => {
            const supabase = getServiceSupabase();
            const { data, error } = await supabase
                .from(STUDENT_LOAN_SOURCE_SNAPSHOTS_TABLE)
                .select('*')
                .order('source_key', { ascending: true })
                .order('fetched_at', { ascending: false });

            if (error) throw buildStorageError(error, STUDENT_LOAN_SOURCE_SNAPSHOTS_TABLE, 'Failed to list student loan source snapshots');
            const latestByKey = new Map();
            for (const row of data || []) {
                if (!latestByKey.has(row.source_key)) {
                    latestByKey.set(row.source_key, decodeSourceSnapshotRow(row));
                }
            }
            return Array.from(latestByKey.values());
        },
        () => listLatestStudentLoanSourceSnapshotsFallback(),
    );
}

export async function upsertStudentLoanEvents(events) {
    if (!Array.isArray(events) || events.length === 0) return [];

    return withFallback(
        STUDENT_LOAN_EVENTS_TABLE,
        async () => {
            const supabase = getServiceSupabase();
            const rows = events.map(encodeEventRow);
            const { data, error } = await supabase
                .from(STUDENT_LOAN_EVENTS_TABLE)
                .upsert(rows, { onConflict: 'event_id' })
                .select('*');

            if (error) throw buildStorageError(error, STUDENT_LOAN_EVENTS_TABLE, 'Failed to save student loan events');
            return (data || []).map(decodeEventRow);
        },
        () => upsertStudentLoanEventsFallback(events),
    );
}

export async function deleteStudentLoanEventsNotInSet(sourceKeys, eventIds) {
    return withFallback(
        STUDENT_LOAN_EVENTS_TABLE,
        async () => {
            const normalizedSourceKeys = Array.from(new Set((sourceKeys || []).map((value) => String(value).trim()).filter(Boolean)));
            if (normalizedSourceKeys.length === 0) return;

            const normalizedEventIds = Array.from(new Set((eventIds || []).map((value) => String(value).trim()).filter(Boolean)));
            const supabase = getServiceSupabase();
            let query = supabase
                .from(STUDENT_LOAN_EVENTS_TABLE)
                .delete()
                .in('source_key', normalizedSourceKeys);

            if (normalizedEventIds.length > 0) {
                query = query.not('event_id', 'in', `(${normalizedEventIds.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')})`);
            }

            const { error } = await query;
            if (error) throw buildStorageError(error, STUDENT_LOAN_EVENTS_TABLE, 'Failed to prune student loan events');
        },
        () => deleteStudentLoanEventsNotInSetFallback(sourceKeys, eventIds),
    );
}

export async function listStudentLoanEvents() {
    return withFallback(
        STUDENT_LOAN_EVENTS_TABLE,
        async () => {
            const supabase = getServiceSupabase();
            const { data, error } = await supabase
                .from(STUDENT_LOAN_EVENTS_TABLE)
                .select('*')
                .order('opens_at', { ascending: true });

            if (error) throw buildStorageError(error, STUDENT_LOAN_EVENTS_TABLE, 'Failed to list student loan events');
            return (data || []).map(decodeEventRow);
        },
        () => listStudentLoanEventsFallback(),
    );
}

export async function getStudentLoanProfile(userCode) {
    return withFallback(
        STUDENT_LOAN_PROFILES_TABLE,
        async () => {
            const supabase = getServiceSupabase();
            const { data, error } = await supabase
                .from(STUDENT_LOAN_PROFILES_TABLE)
                .select('*')
                .eq('user_code', String(userCode))
                .single();

            if (error && error.code !== 'PGRST116') {
                throw buildStorageError(error, STUDENT_LOAN_PROFILES_TABLE, 'Failed to load student loan profile');
            }
            return data ? decodeProfileRow(data) : null;
        },
        () => getStudentLoanProfileFallback(userCode),
    );
}

export async function upsertStudentLoanProfile(profile) {
    return withFallback(
        STUDENT_LOAN_PROFILES_TABLE,
        async () => {
            const supabase = getServiceSupabase();
            const { data, error } = await supabase
                .from(STUDENT_LOAN_PROFILES_TABLE)
                .upsert({
                    ...encodeProfileRow(profile),
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_code' })
                .select('*')
                .single();

            if (error) throw buildStorageError(error, STUDENT_LOAN_PROFILES_TABLE, 'Failed to save student loan profile');
            return decodeProfileRow(data);
        },
        () => upsertStudentLoanProfileFallback(profile),
    );
}

export async function listStudentLoanProfiles(userCodes) {
    const normalizedUserCodes = Array.from(new Set((userCodes || []).map((value) => String(value).trim()).filter(Boolean)));
    if (normalizedUserCodes.length === 0) return [];

    return withFallback(
        STUDENT_LOAN_PROFILES_TABLE,
        async () => {
            const supabase = getServiceSupabase();
            const { data, error } = await supabase
                .from(STUDENT_LOAN_PROFILES_TABLE)
                .select('*')
                .in('user_code', normalizedUserCodes);

            if (error) throw buildStorageError(error, STUDENT_LOAN_PROFILES_TABLE, 'Failed to list student loan profiles');
            return (data || []).map(decodeProfileRow);
        },
        () => listStudentLoanProfilesFallback(normalizedUserCodes),
    );
}

export async function getStudentLoanRolloutOverride(userCode) {
    return withFallback(
        STUDENT_LOAN_ROLLOUT_OVERRIDES_TABLE,
        async () => {
            const supabase = getServiceSupabase();
            const { data, error } = await supabase
                .from(STUDENT_LOAN_ROLLOUT_OVERRIDES_TABLE)
                .select('*')
                .eq('user_code', String(userCode))
                .single();

            if (error && error.code !== 'PGRST116') {
                throw buildStorageError(error, STUDENT_LOAN_ROLLOUT_OVERRIDES_TABLE, 'Failed to load student loan rollout override');
            }
            return data ? decodeRolloutOverrideRow(data) : null;
        },
        () => getStudentLoanRolloutOverrideFallback(userCode),
    );
}

export async function upsertStudentLoanRolloutOverride(override) {
    return withFallback(
        STUDENT_LOAN_ROLLOUT_OVERRIDES_TABLE,
        async () => {
            const supabase = getServiceSupabase();
            const { data, error } = await supabase
                .from(STUDENT_LOAN_ROLLOUT_OVERRIDES_TABLE)
                .upsert({
                    ...encodeRolloutOverrideRow(override),
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_code' })
                .select('*')
                .single();

            if (error) throw buildStorageError(error, STUDENT_LOAN_ROLLOUT_OVERRIDES_TABLE, 'Failed to save student loan rollout override');
            return decodeRolloutOverrideRow(data);
        },
        () => upsertStudentLoanRolloutOverrideFallback(override),
    );
}

export async function listEnabledStudentLoanRolloutOverrides(userCodes = null) {
    const normalizedUserCodes = Array.isArray(userCodes)
        ? Array.from(new Set(userCodes.map((value) => String(value).trim()).filter(Boolean)))
        : null;

    return withFallback(
        STUDENT_LOAN_ROLLOUT_OVERRIDES_TABLE,
        async () => {
            const supabase = getServiceSupabase();
            let query = supabase
                .from(STUDENT_LOAN_ROLLOUT_OVERRIDES_TABLE)
                .select('*')
                .eq('enabled', true);
            if (normalizedUserCodes && normalizedUserCodes.length > 0) {
                query = query.in('user_code', normalizedUserCodes);
            }
            const { data, error } = await query;
            if (error) throw buildStorageError(error, STUDENT_LOAN_ROLLOUT_OVERRIDES_TABLE, 'Failed to list student loan rollout overrides');
            return (data || []).map(decodeRolloutOverrideRow);
        },
        () => listEnabledStudentLoanRolloutOverridesFallback(normalizedUserCodes),
    );
}

export async function listStudentLoanNotificationInstances(userCode, statuses = null) {
    const normalizedStatuses = Array.isArray(statuses)
        ? Array.from(new Set(statuses.map((value) => String(value).trim()).filter(Boolean)))
        : null;

    return withFallback(
        STUDENT_LOAN_NOTIFICATION_INSTANCES_TABLE,
        async () => {
            const supabase = getServiceSupabase();
            let query = supabase
                .from(STUDENT_LOAN_NOTIFICATION_INSTANCES_TABLE)
                .select('*')
                .eq('user_code', String(userCode))
                .order('visible_from', { ascending: true });
            if (normalizedStatuses && normalizedStatuses.length > 0) {
                query = query.in('status', normalizedStatuses);
            }
            const { data, error } = await query;
            if (error) throw buildStorageError(error, STUDENT_LOAN_NOTIFICATION_INSTANCES_TABLE, 'Failed to list student loan notification instances');
            return (data || []).map(decodeNotificationInstanceRow);
        },
        () => listStudentLoanNotificationInstancesFallback(userCode, normalizedStatuses),
    );
}

export async function upsertStudentLoanNotificationInstances(instances) {
    if (!Array.isArray(instances) || instances.length === 0) return [];

    return withFallback(
        STUDENT_LOAN_NOTIFICATION_INSTANCES_TABLE,
        async () => {
            const supabase = getServiceSupabase();
            const rows = instances.map((instance) => ({
                ...encodeNotificationInstanceRow(instance),
                updated_at: new Date().toISOString(),
            }));
            const { data, error } = await supabase
                .from(STUDENT_LOAN_NOTIFICATION_INSTANCES_TABLE)
                .upsert(rows, { onConflict: 'user_code,event_id' })
                .select('*');

            if (error) throw buildStorageError(error, STUDENT_LOAN_NOTIFICATION_INSTANCES_TABLE, 'Failed to save student loan notification instances');
            return (data || []).map(decodeNotificationInstanceRow);
        },
        () => upsertStudentLoanNotificationInstancesFallback(instances),
    );
}

export async function hideStudentLoanNotificationInstancesExcept(userCode, eventIds) {
    return withFallback(
        STUDENT_LOAN_NOTIFICATION_INSTANCES_TABLE,
        async () => {
            const normalizedEventIds = Array.from(new Set((eventIds || []).map((value) => String(value).trim()).filter(Boolean)));
            const supabase = getServiceSupabase();
            let query = supabase
                .from(STUDENT_LOAN_NOTIFICATION_INSTANCES_TABLE)
                .update({
                    status: 'hidden',
                    resolved_at: new Date().toISOString(),
                    resolution_reason: 'rollout',
                    updated_at: new Date().toISOString(),
                })
                .eq('user_code', String(userCode));
            if (normalizedEventIds.length > 0) {
                query = query.not('event_id', 'in', `(${normalizedEventIds.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')})`);
            }
            const { error } = await query;
            if (error) throw buildStorageError(error, STUDENT_LOAN_NOTIFICATION_INSTANCES_TABLE, 'Failed to hide stale student loan notification instances');
        },
        () => hideStudentLoanNotificationInstancesExceptFallback(userCode, eventIds),
    );
}

export async function markStudentLoanNotificationInstanceClicked(userCode, eventId) {
    return withFallback(
        STUDENT_LOAN_NOTIFICATION_INSTANCES_TABLE,
        async () => {
            const clickedAt = new Date().toISOString();
            const supabase = getServiceSupabase();
            const { data, error } = await supabase
                .from(STUDENT_LOAN_NOTIFICATION_INSTANCES_TABLE)
                .update({
                    status: 'clicked',
                    clicked_at: clickedAt,
                    resolved_at: clickedAt,
                    resolution_reason: 'click',
                    updated_at: clickedAt,
                })
                .eq('user_code', String(userCode))
                .eq('event_id', String(eventId))
                .select('*');

            if (error) throw buildStorageError(error, STUDENT_LOAN_NOTIFICATION_INSTANCES_TABLE, 'Failed to mark student loan notification instance clicked');
            return (data || []).map(decodeNotificationInstanceRow);
        },
        () => markStudentLoanNotificationInstanceClickedFallback(userCode, eventId),
    );
}
