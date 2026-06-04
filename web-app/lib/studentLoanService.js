import { fetchFromUniversityApi } from './universityApi.js';
import { parseProfileData } from './profileParser.js';
import { getCachedProfile, cacheProfile } from './supabaseProfile.js';
import { getStudentLoanCentralFeed } from './studentLoanCentralService.js';
import {
    getStudentLoanProfile,
    getStudentLoanRolloutOverride,
    listStudentLoanEvents,
    listStudentLoanNotificationInstances,
} from './studentLoanStore.js';
import { extractStudentLoanSettings, getStoredPortfolioConfig } from './studentLoanSettings.js';

const EDUCATION_KEYWORDS = {
    vocational: ['ปวช', 'อนุปริญญา', 'ประกาศนียบัตรวิชาชีพ', 'diploma'],
    bachelor: ['ปริญญาตรี', 'bachelor'],
};

function textIncludesAny(value, keywords) {
    const normalized = String(value || '').toLowerCase();
    return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function inferEducationLevel(studentProfile) {
    if (!studentProfile) return 'bachelor';

    const haystack = [
        studentProfile.major,
        studentProfile.department,
        studentProfile.faculty,
    ].filter(Boolean);

    if (haystack.some((value) => textIncludesAny(value, EDUCATION_KEYWORDS.vocational))) {
        return 'vocational';
    }

    if (haystack.some((value) => textIncludesAny(value, EDUCATION_KEYWORDS.bachelor))) {
        return 'bachelor';
    }

    return 'bachelor';
}

export function estimateCompletedSemesters(studentProfile) {
    if (!studentProfile) return null;

    const admitYear = Number(studentProfile.admitYear || studentProfile.enrollYear || 0);
    const currentYear = Number(studentProfile.currentYear || studentProfile.enrollYear || 0);
    const currentSemester = Number(studentProfile.currentSemester || studentProfile.enrollSemester || 0);
    const startingSemester = Number(studentProfile.enrollSemester || 1);

    if (!admitYear || !currentYear || !currentSemester) {
        return null;
    }

    const estimated = ((currentYear - admitYear) * 3) + (currentSemester - startingSemester) + 1;
    return estimated > 0 ? estimated : 1;
}

export function inferBorrowerProfile({ userCode, studentProfile }) {
    const estimatedCompletedSemesters = estimateCompletedSemesters(studentProfile);
    const borrowerType = estimatedCompletedSemesters !== null && estimatedCompletedSemesters > 2
        ? 'continuing'
        : 'new';
    const educationLevel = inferEducationLevel(studentProfile);

    const reasons = [];
    if (estimatedCompletedSemesters !== null) {
        reasons.push(`พบประวัติการเรียนประมาณ ${estimatedCompletedSemesters} เทอม`);
    } else if (userCode) {
        reasons.push('ยังไม่มีข้อมูลเทอมเพียงพอ จึงใช้ค่าเริ่มต้นสำหรับการตั้งค่า');
    }

    if (educationLevel === 'bachelor') {
        reasons.push('ไม่พบตัวบ่งชี้ระดับ ปวช./อนุปริญญา จึงแนะนำเป็น ป.ตรี');
    }

    return {
        borrowerType,
        educationLevel,
        confidence: estimatedCompletedSemesters === null ? 'medium' : 'high',
        estimatedCompletedSemesters,
        reason: reasons.join(' · '),
    };
}

function matchesAudience(item, borrowerProfile) {
    if (!borrowerProfile) return false;
    if (item.audience !== borrowerProfile.borrowerType) return false;
    return item.educationLevel === 'all' || item.educationLevel === borrowerProfile.educationLevel;
}

function buildSetupNotification(recommendation) {
    return {
        id: 'student-loan-profile-setup',
        title: 'ตั้งค่าประเภทผู้กู้ในหน้า กยศ.',
        message: recommendation?.reason
            ? `แนะนำ: ${recommendation.borrowerType === 'continuing' ? 'ผู้กู้ต่อเนื่อง' : 'ผู้กู้รายใหม่'} · ${recommendation.educationLevel === 'bachelor' ? 'ป.ตรี' : 'ปวช./อนุปริญญา'}`
            : 'เลือกประเภทผู้กู้เพื่อรับแจ้งเตือนกำหนดการที่ตรงกับคุณ',
        href: '/student-loan',
        ctaLabel: 'ตั้งค่าตอนนี้',
        phase: 'setup',
        closesAt: null,
        opensAt: null,
        sourceId: 'profile-setup',
    };
}

export function buildActiveStudentLoanNotifications(events, borrowerProfile, notificationClicks, now = new Date()) {
    const clickMap = notificationClicks || {};
    const currentTime = now.getTime();

    return events
        .filter((event) => matchesAudience(event, borrowerProfile))
        .filter((event) => {
            const opensAt = new Date(event.opensAt).getTime();
            const closesAt = new Date(event.closesAt).getTime();
            const reminderAt = new Date(event.reminderAt).getTime();

            if (Number.isNaN(opensAt) || Number.isNaN(closesAt) || currentTime > closesAt) {
                return false;
            }

            if (event.phase === 'open') {
                return currentTime >= opensAt && currentTime <= closesAt && !clickMap[event.id];
            }

            if (event.phase === 'closingSoon') {
                return currentTime >= reminderAt && currentTime <= closesAt;
            }

            return false;
        })
        .sort((left, right) => {
            const priority = { closingSoon: 0, open: 1 };
            const leftPriority = priority[left.phase] ?? 99;
            const rightPriority = priority[right.phase] ?? 99;
            if (leftPriority !== rightPriority) return leftPriority - rightPriority;
            return new Date(left.closesAt).getTime() - new Date(right.closesAt).getTime();
        });
}

function sortEvents(events) {
    return [...events].sort((left, right) => new Date(left.opensAt).getTime() - new Date(right.opensAt).getTime());
}

function sortNotifications(notifications) {
    return [...notifications].sort((left, right) => {
        const priority = { closingSoon: 0, open: 1, setup: 2 };
        const leftPriority = priority[left.phase] ?? 99;
        const rightPriority = priority[right.phase] ?? 99;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return new Date(left.closesAt || left.opensAt || 0).getTime() - new Date(right.closesAt || right.opensAt || 0).getTime();
    });
}

export function filterStudentLoanResources(resources, borrowerProfile) {
    if (!borrowerProfile) return [];
    return resources.filter((resource) => matchesAudience(resource, borrowerProfile));
}

export function filterStudentLoanSteps(steps, borrowerProfile, events) {
    if (!borrowerProfile) return [];

    return steps
        .filter((step) => matchesAudience(step, borrowerProfile))
        .map((step) => {
            const stepEvents = events
                .filter((event) => (
                    event.audience === borrowerProfile.borrowerType &&
                    event.educationLevel === borrowerProfile.educationLevel &&
                    event.stage === step.stage
                ))
                .sort((left, right) => new Date(left.opensAt).getTime() - new Date(right.opensAt).getTime());

            const openEvent = stepEvents.find((event) => event.phase === 'open') || null;

            return {
                ...step,
                status: openEvent ? 'scheduled' : step.status,
                schedule: openEvent
                    ? {
                        opensAt: openEvent.opensAt,
                        closesAt: openEvent.closesAt,
                    }
                    : null,
            };
        });
}

async function loadStudentProfile(authContext) {
    const userId = authContext?.userId;
    if (!userId) return null;

    const cached = await getCachedProfile(String(userId));
    if (cached) {
        return cached;
    }

    if (!authContext?.token) {
        return null;
    }

    try {
        const rawData = await fetchFromUniversityApi(authContext.token);
        const { profile, isPartial } = parseProfileData(rawData, String(userId));
        if (!isPartial) {
            await cacheProfile(profile);
        }
        return profile;
    } catch (error) {
        console.warn('[StudentLoan] Unable to load student profile for recommendation:', error.message);
        return null;
    }
}

function mapCentralEventToUi(event) {
    const payload = event.payload || {};
    return {
        id: event.eventId,
        audience: event.audience,
        educationLevel: event.educationLevel,
        stage: event.stage,
        phase: event.phase,
        title: event.title,
        message: event.message,
        href: event.href,
        ctaLabel: payload.ctaLabel || 'ดำเนินการต่อ',
        opensAt: event.opensAt,
        closesAt: event.closesAt,
        reminderAt: payload.reminderAt || event.visibleFrom,
        sourceId: payload.sourceId || event.sourceKey,
    };
}

function mapInstanceToUi(instance, eventMap) {
    const event = eventMap.get(instance.eventId);
    if (!event) return null;

    return {
        id: event.eventId,
        audience: event.audience,
        educationLevel: event.educationLevel,
        stage: event.stage,
        phase: event.phase,
        title: event.title,
        message: event.message,
        href: event.href,
        ctaLabel: event.payload?.ctaLabel || 'ดำเนินการต่อ',
        opensAt: event.opensAt,
        closesAt: event.closesAt,
        reminderAt: event.payload?.reminderAt || event.visibleFrom,
        sourceId: event.payload?.sourceId || event.sourceKey,
        preview: Boolean(instance.preview),
        status: instance.status,
    };
}

export async function buildStudentLoanNotificationFeed(authContext) {
    const userId = String(authContext?.userId || '');
    const [centralProfile, legacyBorrowerProfile, rolloutOverride, allEvents, instances] = await Promise.all([
        userId ? getStudentLoanProfile(userId) : Promise.resolve(null),
        userId ? loadLegacyBorrowerProfile(userId) : Promise.resolve(null),
        userId ? getStudentLoanRolloutOverride(userId) : Promise.resolve(null),
        listStudentLoanEvents(),
        userId ? listStudentLoanNotificationInstances(userId, ['active']) : Promise.resolve([]),
    ]);

    const confirmedProfile = normalizeCentralProfile(centralProfile) || legacyBorrowerProfile || null;
    const rolloutEnabled = Boolean(rolloutOverride?.enabled);
    const eventMap = new Map(allEvents.map((event) => [event.eventId, event]));
    const notifications = rolloutEnabled
        ? sortNotifications(instances.map((instance) => mapInstanceToUi(instance, eventMap)).filter(Boolean))
        : [];

    return {
        notifications,
        needsSelection: !confirmedProfile,
        rollout: {
            enabled: rolloutEnabled,
            mode: rolloutOverride?.mode || 'live',
            previewNow: rolloutOverride?.previewNow || null,
        },
    };
}

function normalizeCentralProfile(profile) {
    if (!profile) return null;
    return {
        borrowerType: profile.borrowerType,
        educationLevel: profile.educationLevel,
        source: profile.source === 'seeded' ? 'manual' : profile.source,
        confirmedAt: profile.confirmedAt,
        updatedAt: profile.updatedAt,
    };
}

async function loadLegacyBorrowerProfile(userId) {
    if (!userId) return null;

    try {
        const legacyConfig = await getStoredPortfolioConfig(userId);
        return extractStudentLoanSettings(legacyConfig).borrowerProfile;
    } catch (error) {
        console.warn('[StudentLoan] Unable to load legacy borrower profile:', error.message);
        return null;
    }
}

export async function buildStudentLoanDashboard(authContext) {
    const userId = String(authContext?.userId || '');
    const [centralFeed, centralProfile, legacyBorrowerProfile, rolloutOverride, studentProfile, allEvents, instances] = await Promise.all([
        getStudentLoanCentralFeed(),
        userId ? getStudentLoanProfile(userId) : Promise.resolve(null),
        userId ? loadLegacyBorrowerProfile(userId) : Promise.resolve(null),
        userId ? getStudentLoanRolloutOverride(userId) : Promise.resolve(null),
        loadStudentProfile(authContext),
        listStudentLoanEvents(),
        userId ? listStudentLoanNotificationInstances(userId, ['active']) : Promise.resolve([]),
    ]);

    const recommendation = inferBorrowerProfile({ userCode: userId, studentProfile });
    const confirmedProfile = normalizeCentralProfile(centralProfile) || legacyBorrowerProfile || null;
    const effectiveProfile = confirmedProfile || recommendation;
    const activeEvents = allEvents
        .filter((event) => matchesAudience(event, effectiveProfile))
        .map(mapCentralEventToUi);
    const eventMap = new Map(allEvents.map((event) => [event.eventId, event]));
    const rollout = {
        enabled: Boolean(rolloutOverride?.enabled),
        mode: rolloutOverride?.mode || 'live',
        previewNow: rolloutOverride?.previewNow || null,
        latestSyncedAt: centralFeed.latestSyncedAt,
    };

    const notifications = rollout.enabled
        ? sortNotifications(instances.map((instance) => mapInstanceToUi(instance, eventMap)).filter(Boolean))
        : [];

    return {
        profile: {
            confirmed: confirmedProfile,
            recommended: recommendation,
            needsSelection: !confirmedProfile,
            studentCode: userId || null,
        },
        rollout,
        studentProfile,
        notifications: notifications.length > 0
            ? notifications
            : (!rollout.enabled || confirmedProfile ? [] : [buildSetupNotification(recommendation)]),
        events: sortEvents(activeEvents),
        resources: filterStudentLoanResources(centralFeed.resources, effectiveProfile),
        steps: filterStudentLoanSteps(centralFeed.steps || [], effectiveProfile, activeEvents),
        sources: centralFeed.sources,
    };
}
