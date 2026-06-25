import { buildClientGoogleMailSettingsSummary, getClientGoogleMailNotifications } from './googleClientMailState.js';
import { normalizeClientClassroomUserCode } from './googleClientMailConfig.js';

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function buildClientGoogleMailBellItems(userCode) {
    const normalizedUserCode = normalizeClientClassroomUserCode(userCode);
    const summary = buildClientGoogleMailSettingsSummary(normalizedUserCode);
    const notifications = getClientGoogleMailNotifications(normalizedUserCode).map((item) => ({
        id: item.id,
        source: 'classroom',
        sourceLabel: 'Google Classroom Email',
        kind: 'event',
        section: 'latest',
        priority: item.seenAt ? 'normal' : 'high',
        badgeLabel: item.sourceType === 'announcement' ? 'ประกาศ' : item.sourceType === 'returnedWork' ? 'ส่งคืน' : 'งานใหม่',
        title: item.title,
        message: item.message,
        ctaLabel: 'เปิดปลายทาง',
        href: item.href,
        sortAt: item.sortAt,
        unread: !item.seenAt,
        dismissible: false,
        requiresAuth: false,
        openAction: null,
        dismissAction: null,
        meta: {
            sourceType: item.sourceType,
            courseName: readString(item.courseHint) || null,
            clientManaged: true,
        },
    }));

    const prompt = summary.connected || !summary.configured || !summary.rollout?.enabled
        ? null
        : {
            id: 'classroom:prompt:client-connect',
            source: 'classroom',
            sourceLabel: 'Google Classroom Email',
            kind: 'system_prompt',
            section: 'actionRequired',
            priority: 'high',
            badgeLabel: 'ต้องตั้งค่า',
            title: 'เชื่อม Google Mail สำหรับ Classroom',
            message: 'อนุญาต Gmail readonly เพื่อให้ระบบอ่านข้อความแจ้งเตือนจาก Classroom ใน browser นี้',
            ctaLabel: 'เชื่อม Google Mail',
            href: null,
            sortAt: new Date().toISOString(),
            unread: true,
            dismissible: false,
            requiresAuth: false,
            openAction: null,
            dismissAction: null,
            meta: { clientManaged: true },
        };

    return {
        classroom: {
            ...summary,
            authRequired: !normalizedUserCode,
            lastSyncError: summary.lastSyncError,
        },
        items: prompt ? [prompt, ...notifications] : notifications,
    };
}
