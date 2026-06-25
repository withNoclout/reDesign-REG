import crypto from 'node:crypto';

import { getStudentLoanContent } from './studentLoanContent.js';
import { saveBorrowerProfile as saveLegacyBorrowerProfile } from './studentLoanSettings.js';
import {
    deleteStudentLoanEventsNotInSet,
    getStudentLoanProfile,
    getStudentLoanRolloutOverride,
    hideStudentLoanNotificationInstancesExcept,
    listEnabledStudentLoanRolloutOverrides,
    listLatestStudentLoanSourceSnapshots,
    listStudentLoanEvents,
    listStudentLoanNotificationInstances,
    listStudentLoanProfiles,
    markStudentLoanNotificationInstanceClicked,
    upsertStudentLoanEvents,
    upsertStudentLoanNotificationInstances,
    upsertStudentLoanProfile,
    upsertStudentLoanRolloutOverride,
    upsertStudentLoanSourceSnapshots,
} from './studentLoanStore.js';

export const STUDENT_LOAN_PILOT_USER_CODE = '6701091611290';
export const STUDENT_LOAN_PILOT_OPEN_PREVIEW_NOW = '2026-05-10T12:00:00+07:00';
export const STUDENT_LOAN_PILOT_CLOSING_PREVIEW_NOW = '2026-05-26T12:00:00+07:00';

const SYNC_SOURCE_KEYS = ['continuing-page', 'new-page'];

function hashPayload(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizeUserCode(value) {
    if (!value) return null;
    const normalized = String(value).trim().replace(/^s/i, '');
    return normalized || null;
}

function buildSnapshotRows(content) {
    const continuingSource = content.sources.find((source) => source.id === 'continuing-page');
    const newSource = content.sources.find((source) => source.id === 'new-page');

    const continuingPayload = {
        source: continuingSource || null,
        resources: content.resources.filter((resource) => resource.audience === 'continuing'),
    };
    const newPayload = {
        source: newSource || null,
        resources: content.resources.filter((resource) => resource.audience === 'new'),
        steps: content.steps || [],
    };

    const snapshots = [];
    if (continuingSource) {
        snapshots.push({
            sourceKey: 'continuing-page',
            sourceUrl: continuingSource.url,
            contentHash: hashPayload(continuingPayload),
            rawPayload: continuingPayload,
            parsedPayload: continuingPayload,
            fetchedAt: new Date().toISOString(),
        });
    }
    if (newSource) {
        snapshots.push({
            sourceKey: 'new-page',
            sourceUrl: newSource.url,
            contentHash: hashPayload(newPayload),
            rawPayload: newPayload,
            parsedPayload: newPayload,
            fetchedAt: new Date().toISOString(),
        });
    }

    return snapshots;
}

function mapEventSourceKey(event) {
    return event.audience === 'continuing' ? 'continuing-page' : 'new-page';
}

function buildEventRows(content, snapshots) {
    const sourceHashByKey = new Map(snapshots.map((snapshot) => [snapshot.sourceKey, snapshot.contentHash]));

    return content.events.map((event) => {
        const sourceKey = mapEventSourceKey(event);
        return {
            eventId: event.id,
            sourceKey,
            audience: event.audience,
            educationLevel: event.educationLevel,
            stage: event.stage,
            phase: event.phase,
            title: event.title,
            message: event.message,
            href: event.href,
            opensAt: event.opensAt,
            closesAt: event.closesAt,
            visibleFrom: event.phase === 'closingSoon' ? event.reminderAt : event.opensAt,
            visibleUntil: event.closesAt,
            dismissStrategy: event.phase === 'open' ? 'click' : 'expiry',
            sourceHash: sourceHashByKey.get(sourceKey) || hashPayload(event),
            payload: {
                ctaLabel: event.ctaLabel,
                reminderAt: event.reminderAt,
                sourceId: event.sourceId,
            },
        };
    });
}

function resolveMaterializationNow(rolloutOverride) {
    if (rolloutOverride?.mode === 'preview' && rolloutOverride.previewNow) {
        const parsed = new Date(rolloutOverride.previewNow);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return new Date();
}

export function buildStudentLoanNotificationInstanceRecord({ event, existingInstance, materializeNow, preview = false, resetNotificationState = false }) {
    const visibleFrom = event.visibleFrom;
    const visibleUntil = event.visibleUntil;
    const currentTime = materializeNow.getTime();
    const visibleFromTime = new Date(visibleFrom).getTime();
    const visibleUntilTime = new Date(visibleUntil).getTime();
    const clickedAt = resetNotificationState ? null : (existingInstance?.clickedAt || null);

    let status = 'hidden';
    let resolvedAt = null;
    let resolutionReason = null;

    if (currentTime > visibleUntilTime) {
        if (event.dismissStrategy === 'click' && clickedAt) {
            status = 'clicked';
            resolvedAt = clickedAt;
            resolutionReason = 'click';
        } else {
            status = 'expired';
            resolvedAt = new Date(visibleUntilTime).toISOString();
            resolutionReason = 'expiry';
        }
    } else if (currentTime >= visibleFromTime) {
        if (event.dismissStrategy === 'click' && clickedAt) {
            status = 'clicked';
            resolvedAt = clickedAt;
            resolutionReason = 'click';
        } else {
            status = 'active';
        }
    }

    return {
        userCode: existingInstance?.userCode,
        eventId: event.eventId,
        status,
        visibleFrom,
        visibleUntil,
        clickedAt,
        resolvedAt,
        resolutionReason,
        preview,
    };
}

async function materializeNotificationInstancesForUsers(events, rolloutOverrides, profiles, { resetNotificationState = false } = {}) {
    const profilesByUserCode = new Map(profiles.map((profile) => [profile.userCode, profile]));

    for (const rolloutOverride of rolloutOverrides) {
        const userCode = rolloutOverride.userCode;
        const profile = profilesByUserCode.get(userCode);
        const eligibleEvents = profile
            ? events.filter((event) => event.audience === profile.borrowerType && event.educationLevel === profile.educationLevel)
            : [];

        const existingInstances = await listStudentLoanNotificationInstances(userCode);
        const existingByEventId = new Map(existingInstances.map((instance) => [instance.eventId, instance]));
        const materializeNow = resolveMaterializationNow(rolloutOverride);
        const nextInstances = eligibleEvents.map((event) => ({
            ...buildStudentLoanNotificationInstanceRecord({
                event,
                existingInstance: existingByEventId.get(event.eventId),
                materializeNow,
                preview: rolloutOverride.mode === 'preview',
                resetNotificationState,
            }),
            userCode,
        }));

        await upsertStudentLoanNotificationInstances(nextInstances);
        await hideStudentLoanNotificationInstancesExcept(userCode, eligibleEvents.map((event) => event.eventId));
    }
}

export async function saveStudentLoanProfile(userCode, profile) {
    const normalizedUserCode = normalizeUserCode(userCode);
    if (!normalizedUserCode) {
        throw new Error('User code is required');
    }

    const now = new Date().toISOString();
    const savedProfile = await upsertStudentLoanProfile({
        userCode: normalizedUserCode,
        borrowerType: profile.borrowerType,
        educationLevel: profile.educationLevel,
        source: profile.source || 'manual',
        confirmedAt: profile.confirmedAt || now,
    });

    await saveLegacyBorrowerProfile(normalizedUserCode, {
        borrowerType: savedProfile.borrowerType,
        educationLevel: savedProfile.educationLevel,
    });

    const rolloutOverride = await getStudentLoanRolloutOverride(normalizedUserCode);
    if (rolloutOverride?.enabled) {
        await materializeStudentLoanNotifications({ userCodes: [normalizedUserCode] });
    }

    return savedProfile;
}

export async function seedPilotStudentLoanRollout({ previewNow = STUDENT_LOAN_PILOT_OPEN_PREVIEW_NOW, mode = 'preview' } = {}) {
    const existingProfile = await getStudentLoanProfile(STUDENT_LOAN_PILOT_USER_CODE);
    if (!existingProfile) {
        await saveStudentLoanProfile(STUDENT_LOAN_PILOT_USER_CODE, {
            borrowerType: 'continuing',
            educationLevel: 'bachelor',
            source: 'seeded',
            confirmedAt: new Date().toISOString(),
        });
    }

    return upsertStudentLoanRolloutOverride({
        userCode: STUDENT_LOAN_PILOT_USER_CODE,
        enabled: true,
        mode,
        previewNow: mode === 'preview' ? previewNow : null,
        notes: 'Pilot rollout for student loan notifications',
    });
}

export async function materializeStudentLoanNotifications({ userCodes = null, resetNotificationState = false } = {}) {
    const events = await listStudentLoanEvents();
    const rolloutOverrides = await listEnabledStudentLoanRolloutOverrides(userCodes);
    const profiles = await listStudentLoanProfiles(rolloutOverrides.map((override) => override.userCode));

    await materializeNotificationInstancesForUsers(events, rolloutOverrides, profiles, { resetNotificationState });
    return {
        users: rolloutOverrides.length,
        events: events.length,
    };
}

export async function syncStudentLoanCentralState({
    seedPilot = true,
    pilotMode = 'preview',
    pilotPreviewNow = STUDENT_LOAN_PILOT_OPEN_PREVIEW_NOW,
    userCodes = null,
    resetNotificationState = false,
} = {}) {
    if (seedPilot) {
        await seedPilotStudentLoanRollout({ previewNow: pilotPreviewNow, mode: pilotMode });
    }

    const content = await getStudentLoanContent();
    const snapshotRows = buildSnapshotRows(content);
    const eventRows = buildEventRows(content, snapshotRows);

    await upsertStudentLoanSourceSnapshots(snapshotRows);
    await upsertStudentLoanEvents(eventRows);
    await deleteStudentLoanEventsNotInSet(SYNC_SOURCE_KEYS, eventRows.map((event) => event.eventId));

    const materializeSummary = await materializeStudentLoanNotifications({ userCodes, resetNotificationState });

    return {
        snapshots: snapshotRows.length,
        events: eventRows.length,
        materializedUsers: materializeSummary.users,
    };
}

export async function getStudentLoanCentralFeed() {
    const [snapshots, events] = await Promise.all([
        listLatestStudentLoanSourceSnapshots(),
        listStudentLoanEvents(),
    ]);

    const sources = [];
    const resources = [];
    const steps = [];
    let latestSyncedAt = null;

    for (const snapshot of snapshots) {
        const payload = snapshot.parsedPayload || {};
        if (payload.source) {
            sources.push(payload.source);
        }
        if (Array.isArray(payload.resources)) {
            resources.push(...payload.resources);
        }
        if (Array.isArray(payload.steps)) {
            steps.push(...payload.steps);
        }
        if (!latestSyncedAt || new Date(snapshot.fetchedAt).getTime() > new Date(latestSyncedAt).getTime()) {
            latestSyncedAt = snapshot.fetchedAt;
        }
    }

    return {
        latestSyncedAt,
        sources,
        resources,
        steps,
        events,
    };
}

export async function acknowledgeStudentLoanNotificationClick(userCode, eventId) {
    const normalizedUserCode = normalizeUserCode(userCode);
    const normalizedEventId = readRequiredString(eventId, 'Event ID is required');
    const [instances, events] = await Promise.all([
        listStudentLoanNotificationInstances(normalizedUserCode),
        listStudentLoanEvents(),
    ]);

    const instance = instances.find((item) => item.eventId === normalizedEventId);
    if (!instance) {
        return { updated: false, reason: 'instance-not-found' };
    }

    const event = events.find((item) => item.eventId === normalizedEventId);
    if (!event) {
        return { updated: false, reason: 'event-not-found' };
    }

    if (event.dismissStrategy !== 'click') {
        return { updated: false, reason: 'dismiss-strategy-expiry' };
    }

    await markStudentLoanNotificationInstanceClicked(normalizedUserCode, normalizedEventId);
    return { updated: true };
}

function readRequiredString(value, message) {
    const normalized = readOptionalString(value);
    if (!normalized) {
        throw new Error(message);
    }
    return normalized;
}

function readOptionalString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
