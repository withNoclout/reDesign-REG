import {
    createGoogleClassroomCourseWorkRegistration,
    isGoogleClassroomConfigured,
    isGoogleClassroomPushConfigured,
    listGoogleClassroomAnnouncements,
    listGoogleClassroomCourses,
    listGoogleClassroomCourseWork,
    listGoogleClassroomStudentSubmissions,
    refreshGoogleClassroomTokenBundle,
} from './googleClassroom.js';
import {
    countUnreadGoogleClassroomNotifications,
    deleteGoogleClassroomNotificationsBefore,
    getGoogleClassroomConnection,
    getGoogleClassroomRegistrationById,
    listGoogleClassroomNotifications,
    listGoogleClassroomRegistrations,
    markGoogleClassroomNotificationsSeen,
    revokeGoogleClassroomConnection,
    updateGoogleClassroomConnection,
    upsertGoogleClassroomNotifications,
    upsertGoogleClassroomRegistration,
} from './googleClassroomStore.js';

const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_NOTIFICATION_LIMIT = 20;
const DEFAULT_ANNOUNCEMENT_PAGE_SIZE = 20;
const DEFAULT_COURSEWORK_PAGE_SIZE = 20;
const DEFAULT_SUBMISSION_PAGE_SIZE = 50;

function readPositiveInteger(value, fallback) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getSyncIntervalMs() {
    return readPositiveInteger(process.env.GOOGLE_CLASSROOM_SYNC_MIN_INTERVAL_SECONDS, 60) * 1000;
}

function getLookbackMs() {
    return readPositiveInteger(process.env.GOOGLE_CLASSROOM_SYNC_LOOKBACK_DAYS, DEFAULT_LOOKBACK_DAYS) * 24 * 60 * 60 * 1000;
}

function getRetentionMs() {
    return readPositiveInteger(process.env.GOOGLE_CLASSROOM_NOTIFICATION_RETENTION_DAYS, DEFAULT_RETENTION_DAYS) * 24 * 60 * 60 * 1000;
}

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function truncateText(value, maxLength = 220) {
    const text = readString(value)?.replace(/\s+/g, ' ') || '';
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function toIsoString(value) {
    const text = readString(value);
    if (!text) return null;
    const timestamp = Date.parse(text);
    return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function toTimestampMs(value) {
    const iso = toIsoString(value);
    return iso ? Date.parse(iso) : Number.NaN;
}

function isWithinLookback(isoString, nowMs, lookbackMs) {
    const timestamp = toTimestampMs(isoString);
    if (!Number.isFinite(timestamp)) return false;
    return timestamp >= nowMs - lookbackMs;
}

function sortNotificationsDescending(notifications) {
    return [...notifications].sort((left, right) => Date.parse(right.sortAt) - Date.parse(left.sortAt));
}

function buildCourseLink(courseId) {
    return `https://classroom.google.com/c/${encodeURIComponent(courseId)}`;
}

function buildAnnouncementLink(courseId, announcementId) {
    return `https://classroom.google.com/c/${encodeURIComponent(courseId)}/m/${encodeURIComponent(announcementId)}`;
}

function buildCourseWorkLink(courseId, courseWorkId) {
    return `https://classroom.google.com/c/${encodeURIComponent(courseId)}/a/${encodeURIComponent(courseWorkId)}/details`;
}

function formatAssignedGrade(assignedGrade) {
    if (assignedGrade === null || assignedGrade === undefined || assignedGrade === '') return null;
    return Number.isFinite(Number(assignedGrade)) ? String(Number(assignedGrade)) : String(assignedGrade);
}

function normalizeCourseName(course) {
    return readString(course?.name) || readString(course?.section) || `วิชา ${course?.id || ''}`.trim();
}

function buildAnnouncementNotification(course, announcement, nowMs, lookbackMs) {
    const updatedAt = toIsoString(announcement?.updateTime || announcement?.creationTime);
    if (!updatedAt || !isWithinLookback(updatedAt, nowMs, lookbackMs)) return null;

    const text = truncateText(announcement?.text, 160);
    return {
        id: `classroom:announcement:${course.id}:${announcement.id}:${updatedAt}`,
        sourceType: 'announcement',
        eventType: 'published',
        courseId: String(course.id),
        courseName: course.name,
        announcementId: String(announcement.id),
        href: readString(announcement?.alternateLink) || buildAnnouncementLink(course.id, announcement.id),
        title: `${course.name}: ประกาศใหม่`,
        message: text || 'มีประกาศใหม่ในห้องเรียนนี้',
        sortAt: updatedAt,
        resourceUpdatedAt: updatedAt,
        payload: {
            text: announcement?.text || '',
            alternateLink: announcement?.alternateLink || null,
        },
    };
}

function buildCourseWorkNotification(course, courseWork, nowMs, lookbackMs) {
    const updatedAt = toIsoString(courseWork?.updateTime || courseWork?.creationTime);
    if (!updatedAt || !isWithinLookback(updatedAt, nowMs, lookbackMs)) return null;

    const workType = readString(courseWork?.workType)?.toLowerCase() || 'coursework';
    const itemTitle = truncateText(courseWork?.title, 140) || 'มีงานใหม่';
    const description = truncateText(courseWork?.description, 120);
    const dueDate = courseWork?.dueDate
        ? `${courseWork.dueDate.year}-${String(courseWork.dueDate.month || 1).padStart(2, '0')}-${String(courseWork.dueDate.day || 1).padStart(2, '0')}`
        : null;

    return {
        id: `classroom:coursework:${course.id}:${courseWork.id}:${updatedAt}`,
        sourceType: 'courseWork',
        eventType: workType,
        courseId: String(course.id),
        courseName: course.name,
        courseWorkId: String(courseWork.id),
        href: readString(courseWork?.alternateLink) || buildCourseWorkLink(course.id, courseWork.id),
        title: `${course.name}: งานใหม่`,
        message: description ? `${itemTitle} — ${description}` : itemTitle,
        sortAt: updatedAt,
        resourceUpdatedAt: updatedAt,
        payload: {
            workType,
            title: courseWork?.title || '',
            description: courseWork?.description || '',
            dueDate,
            alternateLink: courseWork?.alternateLink || null,
        },
    };
}

function buildStudentSubmissionNotification(course, submission, courseWorkMap, nowMs, lookbackMs) {
    const updatedAt = toIsoString(submission?.updateTime || submission?.creationTime);
    if (!updatedAt || !isWithinLookback(updatedAt, nowMs, lookbackMs)) return null;

    const state = readString(submission?.state)?.toUpperCase() || '';
    const assignedGrade = formatAssignedGrade(submission?.assignedGrade);
    const draftGrade = formatAssignedGrade(submission?.draftGrade);
    const hasGrade = assignedGrade !== null || draftGrade !== null;
    const isReturned = state === 'RETURNED';

    if (!isReturned && !hasGrade) return null;

    const courseWork = courseWorkMap.get(String(submission.courseWorkId || '')) || null;
    const courseWorkTitle = truncateText(courseWork?.title, 120) || 'งานของคุณ';
    const gradeLabel = assignedGrade !== null ? ` คะแนน ${assignedGrade}` : '';

    return {
        id: `classroom:submission:${course.id}:${submission.courseWorkId}:${submission.id}:${updatedAt}:${state}:${assignedGrade || ''}:${draftGrade || ''}`,
        sourceType: 'studentSubmission',
        eventType: isReturned ? 'returned' : 'graded',
        courseId: String(course.id),
        courseName: course.name,
        courseWorkId: String(submission.courseWorkId),
        studentSubmissionId: String(submission.id),
        href: readString(submission?.alternateLink) || readString(courseWork?.alternateLink) || buildCourseWorkLink(course.id, submission.courseWorkId),
        title: `${course.name}: ${isReturned ? 'ส่งคืนงานแล้ว' : 'มีการอัปเดตคะแนน'}`,
        message: `${courseWorkTitle}${gradeLabel}`,
        sortAt: updatedAt,
        resourceUpdatedAt: updatedAt,
        payload: {
            state,
            assignedGrade,
            draftGrade,
            late: Boolean(submission?.late),
            alternateLink: submission?.alternateLink || null,
        },
    };
}

export function buildGoogleClassroomNotificationsSnapshot({ courses = [], announcementsByCourseId = {}, courseWorkByCourseId = {}, submissionsByCourseId = {} }, now = new Date()) {
    const nowMs = now.getTime();
    const lookbackMs = getLookbackMs();
    const notifications = [];

    for (const rawCourse of courses) {
        const course = {
            id: String(rawCourse.id),
            name: normalizeCourseName(rawCourse),
            href: readString(rawCourse.alternateLink) || buildCourseLink(rawCourse.id),
        };

        const courseWorkItems = Array.isArray(courseWorkByCourseId[course.id]) ? courseWorkByCourseId[course.id] : [];
        const courseWorkMap = new Map(courseWorkItems.map((item) => [String(item.id), item]));

        for (const announcement of Array.isArray(announcementsByCourseId[course.id]) ? announcementsByCourseId[course.id] : []) {
            const notification = buildAnnouncementNotification(course, announcement, nowMs, lookbackMs);
            if (notification) notifications.push(notification);
        }

        for (const courseWork of courseWorkItems) {
            const notification = buildCourseWorkNotification(course, courseWork, nowMs, lookbackMs);
            if (notification) notifications.push(notification);
        }

        for (const submission of Array.isArray(submissionsByCourseId[course.id]) ? submissionsByCourseId[course.id] : []) {
            const notification = buildStudentSubmissionNotification(course, submission, courseWorkMap, nowMs, lookbackMs);
            if (notification) notifications.push(notification);
        }
    }

    return sortNotificationsDescending(notifications);
}


function needsRegistrationRefresh(registration) {
    if (!registration?.expiryTime) return true;
    const expiryMs = Date.parse(registration.expiryTime);
    if (Number.isNaN(expiryMs)) return true;
    return expiryMs <= Date.now() + (24 * 60 * 60 * 1000);
}

async function ensureGoogleClassroomPushRegistrations(userCode, accessToken, courses) {
    if (!isGoogleClassroomPushConfigured()) return;

    const existingRegistrations = await listGoogleClassroomRegistrations(userCode);
    const registrationsByCourseId = new Map(existingRegistrations.map((registration) => [String(registration.courseId), registration]));

    await Promise.all(courses.map(async (course) => {
        const courseId = String(course.id);
        const existingRegistration = registrationsByCourseId.get(courseId);
        if (existingRegistration && !needsRegistrationRefresh(existingRegistration)) return;

        try {
            const createdRegistration = await createGoogleClassroomCourseWorkRegistration(accessToken, courseId);
            await upsertGoogleClassroomRegistration({
                userCode,
                courseId,
                registrationId: createdRegistration.registrationId,
                topicName: createdRegistration.topicName,
                feedType: createdRegistration.feedType,
                expiryTime: createdRegistration.expiryTime,
            });
        } catch (error) {
            console.error(`[Google Classroom] Failed to ensure push registration for course ${courseId}:`, error.message || error);
        }
    }));
}

function shouldSyncConnection(connection, force) {
    if (force) return true;
    if (!connection?.lastSyncedAt) return true;
    const lastSyncedAtMs = Date.parse(connection.lastSyncedAt);
    if (Number.isNaN(lastSyncedAtMs)) return true;
    return Date.now() - lastSyncedAtMs >= getSyncIntervalMs();
}

function isReconnectRequiredError(error) {
    const code = readString(error?.code)?.toLowerCase();
    const message = readString(error?.message)?.toLowerCase() || '';
    return code === 'invalid_grant'
        || code === 'google_classroom_reconnect_required'
        || error?.status === 401
        || message.includes('invalid_grant')
        || message.includes('token has been expired or revoked');
}

async function ensureFreshGoogleClassroomConnection(connection) {
    const expiresAtMs = Date.parse(connection?.accessTokenExpiresAt || '');
    const needsRefresh = !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now() + 60_000;
    if (!needsRefresh) return connection;

    if (!connection?.refreshToken) {
        const error = new Error('Google Classroom reconnect is required because no refresh token is available');
        error.code = 'GOOGLE_CLASSROOM_RECONNECT_REQUIRED';
        error.status = 401;
        throw error;
    }

    const refreshed = await refreshGoogleClassroomTokenBundle(connection.refreshToken);
    const updatedConnection = await updateGoogleClassroomConnection(connection.userCode, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken || connection.refreshToken,
        tokenType: refreshed.tokenType,
        scope: refreshed.scope,
        accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
        revokedAt: null,
        lastSyncError: null,
    });

    return updatedConnection;
}

async function collectGoogleClassroomSnapshot(accessToken) {
    const courses = await listGoogleClassroomCourses(accessToken);
    const announcementsByCourseId = {};
    const courseWorkByCourseId = {};
    const submissionsByCourseId = {};

    await Promise.all(courses.map(async (course) => {
        const courseId = String(course.id);
        const [announcementsResult, courseWorkResult, submissionsResult] = await Promise.allSettled([
            listGoogleClassroomAnnouncements(accessToken, courseId, { pageSize: DEFAULT_ANNOUNCEMENT_PAGE_SIZE, maxPages: 2 }),
            listGoogleClassroomCourseWork(accessToken, courseId, { pageSize: DEFAULT_COURSEWORK_PAGE_SIZE, maxPages: 2 }),
            listGoogleClassroomStudentSubmissions(accessToken, courseId, { courseWorkId: '-', pageSize: DEFAULT_SUBMISSION_PAGE_SIZE, maxPages: 2 }),
        ]);

        if (announcementsResult.status === 'fulfilled') {
            announcementsByCourseId[courseId] = announcementsResult.value;
        } else {
            console.error(`[Google Classroom] Failed to load announcements for course ${courseId}:`, announcementsResult.reason?.message || announcementsResult.reason);
        }

        if (courseWorkResult.status === 'fulfilled') {
            courseWorkByCourseId[courseId] = courseWorkResult.value;
        } else {
            console.error(`[Google Classroom] Failed to load coursework for course ${courseId}:`, courseWorkResult.reason?.message || courseWorkResult.reason);
        }

        if (submissionsResult.status === 'fulfilled') {
            submissionsByCourseId[courseId] = submissionsResult.value;
        } else {
            console.error(`[Google Classroom] Failed to load submissions for course ${courseId}:`, submissionsResult.reason?.message || submissionsResult.reason);
        }
    }));

    return { courses, announcementsByCourseId, courseWorkByCourseId, submissionsByCourseId };
}

export async function syncGoogleClassroomNotifications(userCode, { force = false } = {}) {
    if (!isGoogleClassroomConfigured()) {
        return { configured: false, connected: false, notifications: [], unreadCount: 0 };
    }

    const existingConnection = await getGoogleClassroomConnection(userCode);
    if (!existingConnection || existingConnection.revokedAt) {
        return {
            configured: true,
            connected: false,
            reconnectRequired: Boolean(existingConnection?.revokedAt),
            notifications: [],
            unreadCount: 0,
            lastSyncedAt: existingConnection?.lastSyncedAt || null,
            lastSyncError: existingConnection?.lastSyncError || null,
        };
    }

    if (!shouldSyncConnection(existingConnection, force)) {
        const [notifications, unreadCount] = await Promise.all([
            listGoogleClassroomNotifications(userCode, { limit: DEFAULT_NOTIFICATION_LIMIT }),
            countUnreadGoogleClassroomNotifications(userCode),
        ]);

        return {
            configured: true,
            connected: true,
            reconnectRequired: false,
            notifications,
            unreadCount,
            lastSyncedAt: existingConnection.lastSyncedAt,
            lastSyncError: existingConnection.lastSyncError,
        };
    }

    await updateGoogleClassroomConnection(userCode, {
        lastSyncStartedAt: new Date().toISOString(),
        lastSyncError: null,
    });

    try {


        const freshConnection = await ensureFreshGoogleClassroomConnection(existingConnection);
        const snapshot = await collectGoogleClassroomSnapshot(freshConnection.accessToken);
        const notifications = buildGoogleClassroomNotificationsSnapshot(snapshot);
        await ensureGoogleClassroomPushRegistrations(userCode, freshConnection.accessToken, snapshot.courses);

        const retentionCutoff = new Date(Date.now() - getRetentionMs()).toISOString();

        await Promise.all([
            upsertGoogleClassroomNotifications(userCode, notifications),
            deleteGoogleClassroomNotificationsBefore(userCode, retentionCutoff),
        ]);

        const nowIso = new Date().toISOString();
        const updatedConnection = await updateGoogleClassroomConnection(userCode, {
            lastSyncedAt: nowIso,
            lastSyncStartedAt: nowIso,
            lastSyncError: null,
            revokedAt: null,
        });

        const [storedNotifications, unreadCount] = await Promise.all([
            listGoogleClassroomNotifications(userCode, { limit: DEFAULT_NOTIFICATION_LIMIT }),
            countUnreadGoogleClassroomNotifications(userCode),
        ]);

        return {
            configured: true,
            connected: true,
            reconnectRequired: false,
            notifications: storedNotifications,
            unreadCount,
            lastSyncedAt: updatedConnection.lastSyncedAt,
            lastSyncError: null,
        };
    } catch (error) {
        if (isReconnectRequiredError(error)) {
            await revokeGoogleClassroomConnection(userCode, error.message || 'Google Classroom reconnect required');
            return {
                configured: true,
                connected: false,
                reconnectRequired: true,
                notifications: [],
                unreadCount: 0,
                lastSyncedAt: existingConnection.lastSyncedAt,
                lastSyncError: error.message || 'Google Classroom reconnect required',
            };
        }

        await updateGoogleClassroomConnection(userCode, {
            lastSyncStartedAt: new Date().toISOString(),
            lastSyncError: error.message || 'Google Classroom sync failed',
        });
        throw error;
    }
}

export async function getGoogleClassroomNotificationFeed(userCode, { force = false, limit = DEFAULT_NOTIFICATION_LIMIT } = {}) {
    if (!isGoogleClassroomConfigured()) {
        return {
            configured: false,
            connected: false,
            reconnectRequired: false,
            notifications: [],
            unreadCount: 0,
            lastSyncedAt: null,
            lastSyncError: null,
        };
    }

    const syncResult = await syncGoogleClassroomNotifications(userCode, { force });
    if (!syncResult.connected) {
        return syncResult;
    }

    const notifications = limit === DEFAULT_NOTIFICATION_LIMIT
        ? syncResult.notifications
        : await listGoogleClassroomNotifications(userCode, { limit });

    return {
        ...syncResult,
        notifications,
    };
}

export async function markGoogleClassroomNotificationsSeenForUser(userCode, notificationIds) {
    const updated = await markGoogleClassroomNotificationsSeen(userCode, notificationIds);
    const unreadCount = await countUnreadGoogleClassroomNotifications(userCode);
    return { updated, unreadCount };
}

export async function processGoogleClassroomPushEvent(registrationId, payload) {
    const registration = await getGoogleClassroomRegistrationById(registrationId);
    if (!registration) {
        return { handled: false, reason: 'registration-not-found' };
    }

    const payloadCourseId = readString(payload?.resourceId?.courseId);
    if (payloadCourseId && String(payloadCourseId) !== String(registration.courseId)) {
        return { handled: false, reason: 'course-mismatch' };
    }

    await syncGoogleClassroomNotifications(registration.userCode, { force: true });
    return {
        handled: true,
        userCode: registration.userCode,
        courseId: registration.courseId,
        registrationId: registration.registrationId,
        eventType: readString(payload?.eventType) || null,
        collection: readString(payload?.collection) || null,
    };
}
