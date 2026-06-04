import { canUseGoogleClassroomMailFlow, getGoogleClassroomMailNotificationFeed, markGoogleClassroomMailNotificationsSeenForUser } from './googleClassroomMailService.js';
import { getGoogleClassroomRolloutState } from './googleClassroomRollout.js';
import { getNotificationCenterPreferences, dismissNotificationPrompt } from './notificationPreferences.js';
import { listPendingPortfolioCollaboratorTags } from './portfolioCollaboratorService.js';
import { getStudentAffairsContinuouslyFeed } from './studentAffairsFeed.js';
import { getStudentEvaluationList } from './studentEvaluationService.js';
import { buildStudentLoanNotificationFeed } from './studentLoanService.js';
import { acknowledgeStudentLoanNotificationClick } from './studentLoanCentralService.js';
import { listStudentExamNotifications } from './examNotificationService.js';

const CLASSROOM_PROMPT_AUTH_REQUIRED_ID = 'classroom:prompt:auth-required';
const CLASSROOM_PROMPT_CONNECT_ID = 'classroom:prompt:connect-required';
const CLASSROOM_PROMPT_RECONNECT_ID = 'classroom:prompt:reconnect-required';
const CLASSROOM_PROMPT_UNAVAILABLE_ID = 'classroom:prompt:system-unavailable';

const NOTIFICATION_PRIORITY = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
};

const THAI_MONTHS = new Map([
    ['มกราคม', '01'],
    ['กุมภาพันธ์', '02'],
    ['มีนาคม', '03'],
    ['เมษายน', '04'],
    ['พฤษภาคม', '05'],
    ['มิถุนายน', '06'],
    ['กรกฎาคม', '07'],
    ['สิงหาคม', '08'],
    ['กันยายน', '09'],
    ['ตุลาคม', '10'],
    ['พฤศจิกายน', '11'],
    ['ธันวาคม', '12'],
    ['ม.ค.', '01'],
    ['ก.พ.', '02'],
    ['มี.ค.', '03'],
    ['เม.ย.', '04'],
    ['พ.ค.', '05'],
    ['มิ.ย.', '06'],
    ['ก.ค.', '07'],
    ['ส.ค.', '08'],
    ['ก.ย.', '09'],
    ['ต.ค.', '10'],
    ['พ.ย.', '11'],
    ['ธ.ค.', '12'],
]);

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeUserCode(value) {
    const normalized = readString(value);
    return normalized ? normalized.replace(/^s/i, '') : null;
}

function toIsoString(value) {
    const text = readString(value);
    if (!text) return null;
    const timestamp = Date.parse(text);
    return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function parseThaiDateToIso(value, fallbackTime = '09:00') {
    const text = readString(value);
    if (!text) return null;

    const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
        const [, day, month, year] = slashMatch;
        const normalizedYear = Number(year) > 2400 ? Number(year) - 543 : Number(year);
        return `${String(normalizedYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${fallbackTime}:00+07:00`;
    }

    const thaiMatch = text.match(/(\d{1,2})\s+([ก-๙.]+)\s+(\d{4})/);
    if (!thaiMatch) return null;
    const [, day, monthName, yearText] = thaiMatch;
    const month = THAI_MONTHS.get(monthName.trim());
    if (!month) return null;
    const buddhistYear = Number(yearText);
    const normalizedYear = buddhistYear > 2400 ? buddhistYear - 543 : buddhistYear;
    return `${String(normalizedYear).padStart(4, '0')}-${month}-${String(day).padStart(2, '0')}T${fallbackTime}:00+07:00`;
}

function parseExamDateTimeToIso(examDate, examTime) {
    const timeMatch = readString(examTime)?.match(/(\d{1,2}):(\d{2})/);
    const fallbackTime = timeMatch ? `${String(timeMatch[1]).padStart(2, '0')}:${timeMatch[2]}` : '09:00';
    return parseThaiDateToIso(examDate, fallbackTime);
}

function sortBySection(items) {
    const sortByPriorityDesc = [...items].sort((left, right) => {
        const priorityDelta = (NOTIFICATION_PRIORITY[left.priority] ?? 99) - (NOTIFICATION_PRIORITY[right.priority] ?? 99);
        if (priorityDelta !== 0) return priorityDelta;
        return (Date.parse(right.sortAt || '') || 0) - (Date.parse(left.sortAt || '') || 0);
    });

    return {
        actionRequired: sortByPriorityDesc.filter((item) => item.section === 'actionRequired'),
        latest: [...items]
            .filter((item) => item.section === 'latest')
            .sort((left, right) => (Date.parse(right.sortAt || '') || 0) - (Date.parse(left.sortAt || '') || 0)),
        upcoming: [...items]
            .filter((item) => item.section === 'upcoming')
            .sort((left, right) => (Date.parse(left.sortAt || '') || Number.MAX_SAFE_INTEGER) - (Date.parse(right.sortAt || '') || Number.MAX_SAFE_INTEGER)),
    };
}

function buildClassroomPromptItem({ authRequired = false, reconnectRequired = false, configured = true, lastSyncError = null }) {
    if (!configured) {
        return {
            id: CLASSROOM_PROMPT_UNAVAILABLE_ID,
            source: 'classroom',
            sourceLabel: 'Google Classroom',
            kind: 'system_prompt',
            section: 'actionRequired',
            priority: 'normal',
            badgeLabel: 'รอระบบ',
            title: 'ระบบยังไม่พร้อมเชื่อม Google Mail สำหรับ Classroom',
            message: 'ผู้ดูแลระบบยังไม่ได้ตั้งค่า OAuth หรือฐานข้อมูลที่จำเป็นสำหรับการอ่านอีเมลแจ้งเตือนจาก Google Classroom',
            ctaLabel: 'ดูรายละเอียด',
            href: null,
            sortAt: new Date().toISOString(),
            unread: true,
            dismissible: false,
            requiresAuth: false,
            openAction: null,
            dismissAction: null,
            meta: { reconnectRequired: false, lastSyncError: null, configured: false },
        };
    }

    if (authRequired) {
        return {
            id: CLASSROOM_PROMPT_AUTH_REQUIRED_ID,
            source: 'classroom',
            sourceLabel: 'Google Classroom',
            kind: 'system_prompt',
            section: 'actionRequired',
            priority: 'high',
            badgeLabel: 'ต้องตั้งค่า',
            title: 'เชื่อม Google Mail สำหรับ Classroom',
            message: 'เข้าสู่ระบบและเชื่อม Google Mail เพื่อให้ระบบอ่านอีเมลแจ้งเตือนจาก Classroom มาแสดงในกระดิ่งนี้',
            ctaLabel: 'เข้าสู่ระบบเพื่อเชื่อม',
            href: null,
            sortAt: new Date().toISOString(),
            unread: true,
            dismissible: true,
            requiresAuth: true,
            openAction: null,
            dismissAction: null,
            meta: { reconnectRequired: false, lastSyncError: null, configured: true },
        };
    }

    const promptId = reconnectRequired ? CLASSROOM_PROMPT_RECONNECT_ID : CLASSROOM_PROMPT_CONNECT_ID;
    return {
        id: promptId,
        source: 'classroom',
        sourceLabel: 'Google Classroom',
        kind: 'system_prompt',
        section: 'actionRequired',
        priority: reconnectRequired ? 'critical' : 'high',
        badgeLabel: 'ต้องตั้งค่า',
        title: reconnectRequired ? 'เชื่อม Google Mail ใหม่' : 'เชื่อม Google Mail สำหรับ Classroom',
        message: reconnectRequired
            ? 'การเชื่อมต่อเดิมหมดอายุแล้ว เชื่อมใหม่เพื่อให้กระดิ่งกลับมาดึงอีเมลแจ้งเตือนจาก Classroom ของคุณ'
            : 'เชื่อมบัญชีของคุณเพื่อให้ระบบดึงอีเมลแจ้งเตือนจาก Google Classroom มาไว้ที่นี่',
        ctaLabel: reconnectRequired ? 'เชื่อมต่อใหม่' : 'เชื่อม Google Mail',
        href: null,
        sortAt: new Date().toISOString(),
        unread: true,
        dismissible: true,
        requiresAuth: false,
        openAction: null,
        dismissAction: { type: 'dismiss_prompt', promptId },
        meta: { reconnectRequired, lastSyncError: readString(lastSyncError), configured: true },
    };
}

function buildClassroomRolloutPromptItem(mode) {
    return {
        id: 'classroom:prompt:rollout-restricted',
        source: 'classroom',
        sourceLabel: 'Google Classroom',
        kind: 'system_prompt',
        section: 'actionRequired',
        priority: 'normal',
        badgeLabel: mode === 'off' ? 'ปิดใช้งาน' : 'ทยอยเปิด',
        title: mode === 'off' ? 'Google Mail Classroom POC ถูกปิดใช้งานชั่วคราว' : 'Google Mail Classroom POC ยังไม่เปิดใช้สำหรับบัญชีนี้',
        message: mode === 'off'
            ? 'ระบบได้ปิดการเชื่อมต่อ Google Mail Classroom POC ชั่วคราวเพื่อลดผลกระทบระหว่างการทดสอบหรือปรับปรุง'
            : 'ขณะนี้การเชื่อมต่อ Google Mail สำหรับ Classroom ยังจำกัดเฉพาะผู้ใช้ใน pilot rollout เท่านั้น',
        ctaLabel: 'ดูรายละเอียด',
        href: null,
        sortAt: new Date().toISOString(),
        unread: true,
        dismissible: false,
        requiresAuth: false,
        openAction: null,
        dismissAction: null,
        meta: { reconnectRequired: false, lastSyncError: null, configured: true, rolloutRestricted: true },
    };
}

function mapClassroomNotification(item) {
    const badgeLabel = item.sourceType === 'announcement'
        ? 'ประกาศ'
        : item.sourceType === 'returnedWork'
            ? 'ส่งคืน'
            : 'งานใหม่';

    return {
        id: item.id,
        source: 'classroom',
        sourceLabel: 'Google Classroom Email',
        kind: 'event',
        section: 'latest',
        priority: item.seenAt ? 'normal' : 'high',
        badgeLabel,
        title: item.title,
        message: item.message,
        ctaLabel: 'เปิดปลายทาง',
        href: item.href,
        sortAt: item.sortAt,
        unread: !item.seenAt,
        dismissible: false,
        requiresAuth: false,
        openAction: !item.seenAt ? { type: 'mark_classroom_seen', notificationIds: [item.id] } : null,
        dismissAction: null,
        meta: {
            sourceType: item.sourceType,
            courseName: item.courseName || null,
        },
    };
}

function mapStudentLoanNotification(item) {
    let section = 'actionRequired';
    let priority = 'normal';
    let badgeLabel = 'กยศ.';
    let openAction = null;

    if (item.phase === 'closingSoon') {
        section = 'upcoming';
        priority = 'high';
        badgeLabel = 'ใกล้ปิด';
    } else if (item.phase === 'open') {
        section = 'actionRequired';
        priority = 'high';
        badgeLabel = 'เปิดระบบ';
        openAction = { type: 'student_loan_click', notificationId: item.id };
    } else if (item.phase === 'setup') {
        section = 'actionRequired';
        priority = 'high';
        badgeLabel = 'ตั้งค่า';
    }

    return {
        id: item.id,
        source: 'studentLoan',
        sourceLabel: 'กยศ.',
        kind: 'action_required',
        section,
        priority,
        badgeLabel,
        title: item.title,
        message: item.message,
        ctaLabel: item.ctaLabel || 'ดำเนินการต่อ',
        href: item.href,
        sortAt: item.phase === 'closingSoon' ? (item.closesAt || item.reminderAt || item.opensAt) : (item.opensAt || item.closesAt || new Date().toISOString()),
        unread: false,
        dismissible: false,
        requiresAuth: false,
        openAction,
        dismissAction: null,
        meta: {
            phase: item.phase,
            preview: Boolean(item.preview),
            status: item.status || null,
        },
    };
}

function mapStudentAffairsNotification(item) {
    const status = readString(item.status) || 'available';
    const section = status === 'update'
        ? 'latest'
        : (status === 'upcoming' ? 'upcoming' : 'actionRequired');
    const priority = status === 'open' ? 'high' : 'normal';
    const badgeLabel = status === 'update'
        ? 'อัปเดต'
        : (status === 'upcoming' ? 'กำลังจะเปิด' : 'ประกาศ');

    return {
        id: item.id,
        source: 'studentAffairs',
        sourceLabel: 'กิจการนักศึกษา',
        kind: item.kind === 'update' ? 'event' : 'action_required',
        section,
        priority,
        badgeLabel,
        title: item.title,
        message: item.message,
        ctaLabel: item.ctaLabel || 'ดูประกาศ',
        href: item.href,
        sortAt: toIsoString(item.publishedAt) || new Date().toISOString(),
        unread: false,
        dismissible: false,
        requiresAuth: false,
        openAction: null,
        dismissAction: null,
        meta: { status, rawKind: item.kind },
    };
}

function mapEvaluationNotification(item) {
    const dueAt = parseThaiDateToIso(item.eva_date);
    return {
        id: `evaluation:${item.evaluate_id}:${item.class_id}:${item.officer_id}`,
        source: 'evaluation',
        sourceLabel: 'ประเมินอาจารย์',
        kind: 'action_required',
        section: 'actionRequired',
        priority: 'high',
        badgeLabel: 'ประเมิน',
        title: `${item.course_code} · ${item.course_name}`,
        message: `${item.officer_name}${item.eva_date ? ` · ถึง ${item.eva_date}` : ''}`,
        ctaLabel: 'ประเมินตอนนี้',
        href: `/evaluation/form/${encodeURIComponent(item.evaluate_id)}?classId=${encodeURIComponent(item.class_id)}&officerId=${encodeURIComponent(item.officer_id)}`,
        sortAt: dueAt || new Date().toISOString(),
        unread: false,
        dismissible: false,
        requiresAuth: false,
        openAction: null,
        dismissAction: null,
        meta: {
            classId: String(item.class_id),
            evaluateId: String(item.evaluate_id),
            officerId: String(item.officer_id),
        },
    };
}

function mapPortfolioInviteNotification(item) {
    const adderName = readString(item.added_by_info?.name_th)
        || readString(item.added_by_info?.name_en)
        || readString(item.added_by_info?.user_code)
        || readString(item.added_by)
        || 'เพื่อนร่วมงาน';
    const topic = readString(item.portfolio?.topic);
    const description = readString(item.portfolio?.description);
    const message = topic
        ? `${adderName} เพิ่มคุณในผลงาน ${topic}`
        : `${adderName} เพิ่มคุณเป็นผู้ร่วมจัดการผลงาน`;

    return {
        id: `portfolio-collab:${item.id}`,
        source: 'portfolio',
        sourceLabel: 'Portfolio',
        kind: 'action_required',
        section: 'actionRequired',
        priority: 'high',
        badgeLabel: 'คำเชิญ',
        title: 'มีคนแท็กคุณใน Portfolio',
        message: description ? `${message} · ${description}` : message,
        ctaLabel: 'ตรวจสอบคำเชิญ',
        href: '/portfolio',
        sortAt: toIsoString(item.created_at) || new Date().toISOString(),
        unread: false,
        dismissible: false,
        requiresAuth: false,
        openAction: null,
        dismissAction: null,
        meta: {
            portfolioId: item.portfolio_id,
            collaboratorId: item.id,
        },
    };
}

function mapExamNotification(item) {
    return {
        id: item.id,
        source: 'exam',
        sourceLabel: 'สอบ',
        kind: 'event',
        section: 'upcoming',
        priority: 'normal',
        badgeLabel: item.courseCode,
        title: item.courseName,
        message: `${item.examDate} ${item.examTime} · ${item.location} · ${item.mySeat}`,
        ctaLabel: 'ดูรายละเอียดสอบ',
        href: '/grade/schedule?tab=exam',
        sortAt: parseExamDateTimeToIso(item.examDate, item.examTime) || new Date().toISOString(),
        unread: false,
        dismissible: false,
        requiresAuth: false,
        openAction: null,
        dismissAction: null,
        meta: {
            examDate: item.examDate,
            examTime: item.examTime,
            location: item.location,
            mySeat: item.mySeat,
        },
    };
}

function buildSourceError(source, result) {
    const reason = result?.reason;
    const message = readString(reason?.message) || readString(reason?.error?.message) || 'Unknown source failure';
    return { source, message };
}

export function buildUnifiedNotificationSections(items) {
    const sections = sortBySection(items);
    return {
        actionRequired: sections.actionRequired,
        latest: sections.latest,
        upcoming: sections.upcoming,
        all: [...sections.actionRequired, ...sections.latest, ...sections.upcoming],
    };
}

export async function getUnifiedNotificationsFeed(authContext) {
    const userCode = normalizeUserCode(authContext?.userId);
    const isAuthenticated = Boolean(userCode && authContext?.token);

    if (!isAuthenticated) {
        const classroomConfigured = canUseGoogleClassroomMailFlow();
        const guestRollout = getGoogleClassroomRolloutState(null);
        const items = [
            guestRollout.mode === 'off'
                ? buildClassroomRolloutPromptItem(guestRollout.mode)
                : buildClassroomPromptItem({
                    authRequired: classroomConfigured,
                    configured: classroomConfigured,
                }),
        ];

        return {
            viewer: { authenticated: false, userCode: null },
            classroom: {
                configured: classroomConfigured,
                pushConfigured: false,
                connected: false,
                reconnectRequired: false,
                authRequired: classroomConfigured,
                rollout: guestRollout,
                lastSyncError: null,
            },
            sections: buildUnifiedNotificationSections(items),
            counts: {
                total: items.length,
                unread: items.filter((item) => item.unread).length,
                actionRequired: items.filter((item) => item.section === 'actionRequired').length,
            },
            sourceErrors: [],
        };
    }
    const preferences = await getNotificationCenterPreferences(userCode);
    const dismissedPromptIds = preferences.dismissedPromptIds || {};
    const classroomRollout = getGoogleClassroomRolloutState(userCode);

    const [classroomResult, loanResult, affairsResult, evaluationResult, portfolioResult, examResult] = await Promise.allSettled([
        classroomRollout.enabled
            ? getGoogleClassroomMailNotificationFeed(userCode, { limit: 20 })
            : Promise.resolve({
                configured: canUseGoogleClassroomMailFlow(),
                connected: false,
                reconnectRequired: false,
                notifications: [],
                unreadCount: 0,
                lastSyncError: null,
            }),
        buildStudentLoanNotificationFeed(authContext),
        getStudentAffairsContinuouslyFeed(),
        getStudentEvaluationList(authContext),
        listPendingPortfolioCollaboratorTags(userCode),
        listStudentExamNotifications(userCode),
    ]);

    const sourceErrors = [];
    const items = [];
    let classroomState = {
        configured: canUseGoogleClassroomMailFlow(),
        pushConfigured: false,
        connected: false,
        reconnectRequired: false,
        authRequired: false,
        rollout: classroomRollout,
        lastSyncError: null,
    };

    if (classroomResult.status === 'fulfilled') {
        const classroomFeed = classroomResult.value;
        classroomState = {
            configured: classroomFeed.configured,
            pushConfigured: false,
            connected: classroomFeed.connected,
            reconnectRequired: Boolean(classroomFeed.reconnectRequired),
            authRequired: false,
            rollout: classroomRollout,
            lastSyncError: classroomFeed.lastSyncError || null,
        };

        const promptItem = !classroomRollout.enabled
            ? buildClassroomRolloutPromptItem(classroomRollout.mode)
            : ((!classroomFeed.connected)
                ? buildClassroomPromptItem({
                    configured: classroomFeed.configured,
                    reconnectRequired: classroomFeed.reconnectRequired,
                    lastSyncError: classroomFeed.lastSyncError,
                })
                : null);

        if (promptItem && !dismissedPromptIds[promptItem.id]) {
            items.push(promptItem);
        }

        items.push(...(classroomFeed.notifications || []).map(mapClassroomNotification));
    } else {
        sourceErrors.push(buildSourceError('classroom', classroomResult));
    }

    if (loanResult.status === 'fulfilled') {
        items.push(...(loanResult.value.notifications || []).map(mapStudentLoanNotification));
    } else {
        sourceErrors.push(buildSourceError('studentLoan', loanResult));
    }

    if (affairsResult.status === 'fulfilled') {
        items.push(...(affairsResult.value.notifications || []).map(mapStudentAffairsNotification));
    } else {
        sourceErrors.push(buildSourceError('studentAffairs', affairsResult));
    }

    if (evaluationResult.status === 'fulfilled') {
        items.push(...(evaluationResult.value || []).filter((item) => !item.is_evaluated).map(mapEvaluationNotification));
    } else {
        sourceErrors.push(buildSourceError('evaluation', evaluationResult));
    }

    if (portfolioResult.status === 'fulfilled') {
        items.push(...(portfolioResult.value || []).map(mapPortfolioInviteNotification));
    } else {
        sourceErrors.push(buildSourceError('portfolio', portfolioResult));
    }

    if (examResult.status === 'fulfilled') {
        items.push(...(examResult.value || []).map(mapExamNotification));
    } else {
        sourceErrors.push(buildSourceError('exam', examResult));
    }

    const sections = buildUnifiedNotificationSections(items);
    return {
        viewer: { authenticated: true, userCode },
        classroom: classroomState,
        sections,
        counts: {
            total: sections.all.length,
            unread: sections.all.filter((item) => item.unread).length,
            actionRequired: sections.actionRequired.length,
        },
        sourceErrors,
    };
}

export async function dismissUnifiedNotificationPrompt(userCode, notificationId) {
    const normalizedUserCode = normalizeUserCode(userCode);
    const normalizedNotificationId = readString(notificationId);

    if (!normalizedUserCode) {
        throw new Error('Authenticated user is required to dismiss notification prompts');
    }

    if (![CLASSROOM_PROMPT_CONNECT_ID, CLASSROOM_PROMPT_RECONNECT_ID].includes(normalizedNotificationId)) {
        throw new Error('Only authenticated Google Classroom prompts can be dismissed');
    }

    await dismissNotificationPrompt(normalizedUserCode, normalizedNotificationId);
    return { dismissed: true, notificationId: normalizedNotificationId };
}

export async function markUnifiedNotificationsSeen(userCode, notificationIds) {
    const ids = Array.from(new Set((notificationIds || []).map((item) => readString(item)).filter(Boolean)));
    const classroomIds = ids.filter((item) => item.startsWith('classroom:'));

    if (!normalizeUserCode(userCode)) {
        throw new Error('Authenticated user is required to mark notifications as seen');
    }

    if (classroomIds.length === 0) {
        return { updatedIds: [], unreadCount: 0 };
    }

    const result = await markGoogleClassroomMailNotificationsSeenForUser(normalizeUserCode(userCode), classroomIds);
    return { updatedIds: classroomIds, unreadCount: result.unreadCount };
}

export async function actOnUnifiedNotification(userCode, notificationId) {
    const normalizedUserCode = normalizeUserCode(userCode);
    const normalizedNotificationId = readString(notificationId);

    if (!normalizedUserCode) {
        throw new Error('Authenticated user is required to act on notifications');
    }

    if (!normalizedNotificationId) {
        throw new Error('Notification ID is required');
    }

    if (normalizedNotificationId.startsWith('loan-')) {
        return acknowledgeStudentLoanNotificationClick(normalizedUserCode, normalizedNotificationId);
    }

    if (normalizedNotificationId.startsWith('classroom:')) {
        const result = await markUnifiedNotificationsSeen(normalizedUserCode, [normalizedNotificationId]);
        return { updated: result.updatedIds.length > 0, unreadCount: result.unreadCount };
    }

    if ([CLASSROOM_PROMPT_CONNECT_ID, CLASSROOM_PROMPT_RECONNECT_ID].includes(normalizedNotificationId)) {
        await dismissNotificationPrompt(normalizedUserCode, normalizedNotificationId);
        return { updated: true, notificationId: normalizedNotificationId };
    }

    return { updated: false, reason: 'no-op' };
}
