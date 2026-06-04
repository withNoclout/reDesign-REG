export function formatThaiDateTime(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Bangkok',
    }).format(new Date(value));
}

export function profileLabel(profile) {
    if (!profile) return 'ยังไม่ได้ตั้งค่า';

    const borrowerType = profile.borrowerType === 'continuing' ? 'ผู้กู้รายเก่าต่อเนื่อง' : 'ผู้กู้รายใหม่';
    const educationLevel = profile.educationLevel === 'bachelor' ? 'ปริญญาตรี' : 'ปวช. / อนุปริญญา';
    return `${borrowerType} · ${educationLevel}`;
}

function phaseMeta(phase) {
    switch (phase) {
        case 'closingSoon':
            return {
                label: 'ใกล้ถึงกำหนด',
                tone: 'amber',
            };
        case 'open':
            return {
                label: 'กำลังเปิดดำเนินการ',
                tone: 'emerald',
            };
        case 'setup':
            return {
                label: 'ต้องตั้งค่าก่อนใช้งาน',
                tone: 'sky',
            };
        default:
            return {
                label: 'ติดตามประกาศล่าสุด',
                tone: 'slate',
            };
    }
}

function getRelevantEvents(events, now = new Date()) {
    const currentTime = now.getTime();
    return events
        .filter((event) => {
            const closesAt = new Date(event.closesAt).getTime();
            return !Number.isNaN(closesAt) && closesAt >= currentTime;
        })
        .sort((left, right) => new Date(left.opensAt).getTime() - new Date(right.opensAt).getTime());
}

function buildSetupAction(recommendedProfile) {
    const recommendation = recommendedProfile ? `แนะนำ: ${profileLabel(recommendedProfile)}` : 'เลือกประเภทผู้กู้เพื่อให้ระบบคัดกำหนดการที่ตรงกับคุณ';
    return {
        kind: 'setup',
        title: 'ตั้งค่าประเภทผู้กู้ก่อนใช้งาน',
        description: recommendation,
        detail: 'เมื่อยืนยันประเภทผู้กู้แล้ว ระบบจะแสดงกำหนดการ ขั้นตอน และข่าวที่ตรงกับคุณในรูปแบบ feed และ monitoring panel',
        ctaLabel: 'ตั้งค่าประเภทผู้กู้',
        href: null,
        phase: 'setup',
        deadlineText: null,
    };
}

function buildNotificationAction(notification) {
    return {
        kind: 'notification',
        title: notification.title,
        description: notification.message,
        detail: notification.phase === 'closingSoon'
            ? 'กำหนดการนี้ใกล้ถึงวันปิดรับแล้ว ควรตรวจสอบความพร้อมและดำเนินการทันที'
            : 'กำหนดการนี้เปิดดำเนินการอยู่ สามารถกดต่อไปยังลิงก์ทางการเพื่อทำรายการได้ทันที',
        ctaLabel: notification.ctaLabel || 'ดำเนินการต่อ',
        href: notification.href,
        phase: notification.phase,
        deadlineText: notification.closesAt ? `ปิดรับ ${formatThaiDateTime(notification.closesAt)}` : null,
    };
}

function buildEventAction(event) {
    return {
        kind: 'event',
        title: event.title,
        description: event.message,
        detail: 'ยังไม่มีการแจ้งเตือนเร่งด่วนในกระดิ่ง แต่คุณสามารถเตรียมตัวล่วงหน้าและติดตามช่วงเวลาถัดไปได้จากกำหนดการนี้',
        ctaLabel: event.ctaLabel || 'ดูรายละเอียด',
        href: event.href,
        phase: event.phase,
        deadlineText: event.closesAt ? `ปิดรับ ${formatThaiDateTime(event.closesAt)}` : null,
    };
}

function buildResourceAction(resource) {
    return {
        kind: 'resource',
        title: resource.title,
        description: resource.description,
        detail: 'ใช้ลิงก์นี้เพื่อตรวจสอบรายละเอียดล่าสุดจากกองกิจการนักศึกษา',
        ctaLabel: resource.kind === 'guide' ? 'เปิดคู่มือ' : 'เปิดลิงก์',
        href: resource.href,
        phase: null,
        deadlineText: null,
    };
}

export function buildNextAction({ confirmedProfile, recommendedProfile, notifications, events, resources, now = new Date() }) {
    if (!confirmedProfile) {
        return buildSetupAction(recommendedProfile);
    }

    if (notifications.length > 0) {
        return buildNotificationAction(notifications[0]);
    }

    const nextEvent = getRelevantEvents(events, now)[0] || null;
    if (nextEvent) {
        return buildEventAction(nextEvent);
    }

    const primaryResource = resources[0] || null;
    if (primaryResource) {
        return buildResourceAction(primaryResource);
    }

    return {
        kind: 'idle',
        title: 'ยังไม่มีขั้นตอนที่ต้องดำเนินการทันที',
        description: 'ขณะนี้ยังไม่พบกำหนดการที่เปิดดำเนินการหรือใกล้ถึงกำหนดปิดรับสำหรับสถานะผู้กู้ของคุณ',
        detail: 'สามารถติดตามขั้นตอนทั้งหมดและเอกสารที่เกี่ยวข้องจาก feed และแผงจัดการด้านขวาของหน้านี้ได้',
        ctaLabel: null,
        href: null,
        phase: null,
        deadlineText: null,
    };
}

function stepStatusMeta(step, notificationsByStage) {
    const stageNotification = notificationsByStage.get(step.stage);
    if (stageNotification?.phase === 'closingSoon') {
        return {
            label: 'ใกล้ถึงกำหนด',
            tone: 'amber',
            description: stageNotification.message,
            schedule: step.schedule || {
                opensAt: stageNotification.opensAt,
                closesAt: stageNotification.closesAt,
            },
        };
    }

    if (stageNotification?.phase === 'open') {
        return {
            label: 'กำลังเปิดดำเนินการ',
            tone: 'emerald',
            description: stageNotification.message,
            schedule: step.schedule || {
                opensAt: stageNotification.opensAt,
                closesAt: stageNotification.closesAt,
            },
        };
    }

    if (step.status === 'scheduled') {
        return {
            label: 'มีกำหนดการแล้ว',
            tone: 'emerald',
            description: step.summary,
            schedule: step.schedule || null,
        };
    }

    if (step.status === 'pendingAnnouncement') {
        return {
            label: 'รอประกาศ',
            tone: 'amber',
            description: step.summary,
            schedule: null,
        };
    }

    return {
        label: 'เผยแพร่แล้ว',
        tone: 'sky',
        description: step.summary,
        schedule: step.schedule || null,
    };
}

function buildNewBorrowerJourney(steps, notifications) {
    const notificationsByStage = new Map(
        notifications
            .filter((notification) => notification.stage)
            .map((notification) => [notification.stage, notification])
    );

    return steps.map((step, index) => {
        const status = stepStatusMeta(step, notificationsByStage);
        return {
            id: step.id,
            title: step.title,
            eyebrow: `Step ${index + 1}`,
            description: status.description,
            tone: status.tone,
            statusLabel: status.label,
            href: step.href,
            schedule: status.schedule,
            meta: `อัปเดตล่าสุด ${formatThaiDateTime(step.modifiedAt)}`,
            stage: step.stage,
        };
    });
}

function buildContinuingJourney(events, resources, notifications) {
    const eventByStage = new Map();
    const activeNotificationsByStage = new Map();

    events.forEach((event) => {
        if (!eventByStage.has(event.stage) || new Date(event.opensAt).getTime() < new Date(eventByStage.get(event.stage).opensAt).getTime()) {
            eventByStage.set(event.stage, event);
        }
    });

    notifications.forEach((notification) => {
        if (!activeNotificationsByStage.has(notification.stage)) {
            activeNotificationsByStage.set(notification.stage, notification);
        }
    });

    const checklistEvent = eventByStage.get('checklist');
    const checklistNotification = activeNotificationsByStage.get('checklist');
    const checklistResource = resources.find((resource) => resource.id === 'continuing-checklist-form') || resources[0] || null;
    const dslResource = resources.find((resource) => resource.id === 'continuing-dsl-portal') || null;
    const guideResources = resources.filter((resource) => resource.kind === 'guide');

    const checklistStatus = checklistNotification
        ? phaseMeta(checklistNotification.phase)
        : checklistEvent
            ? { label: 'ตรวจสอบกำหนดการ', tone: 'slate' }
            : { label: 'รอประกาศ', tone: 'amber' };

    return [
        {
            id: 'continuing-checklist',
            eyebrow: 'Step 1',
            title: 'ลงทะเบียน Check List',
            description: checklistNotification?.message || checklistEvent?.message || 'ตรวจสอบประกาศและลงทะเบียน Check List ตามช่วงเวลาที่เปิดระบบ',
            tone: checklistStatus.tone,
            statusLabel: checklistStatus.label,
            href: checklistNotification?.href || checklistEvent?.href || checklistResource?.href || null,
            schedule: checklistEvent ? { opensAt: checklistEvent.opensAt, closesAt: checklistEvent.closesAt } : null,
            meta: checklistResource?.description || 'ใช้ฟอร์มจากกองกิจการนักศึกษาเพื่อยืนยันสิทธิ์การดำเนินการ',
            stage: 'checklist',
        },
        {
            id: 'continuing-dsl',
            eyebrow: 'Step 2',
            title: 'เข้าใช้งานระบบ DSL / กยศ. Connect',
            description: dslResource?.description || 'ใช้ระบบหลักเพื่อตรวจสอบและทำรายการกู้ยืมตามประกาศ',
            tone: 'sky',
            statusLabel: 'ระบบที่ต้องใช้',
            href: dslResource?.href || null,
            schedule: null,
            meta: 'ดำเนินการต่อเนื่องจากประกาศและคำแนะนำของมหาวิทยาลัย',
            stage: 'dsl-request',
        },
        {
            id: 'continuing-guides',
            eyebrow: 'Step 3',
            title: 'ตรวจสอบคู่มือและเอกสารประกอบ',
            description: guideResources.length > 0
                ? guideResources.map((resource) => resource.title).join(' · ')
                : 'เตรียมเอกสารและตรวจสอบรูปแบบการกรอกข้อมูลก่อนดำเนินการ',
            tone: 'slate',
            statusLabel: guideResources.length > 0 ? 'เอกสารพร้อมใช้งาน' : 'ติดตามเพิ่มเติม',
            href: guideResources[0]?.href || null,
            schedule: null,
            meta: `อ้างอิงได้ตลอด${guideResources.length > 1 ? ` (${guideResources.length} รายการ)` : ''}`,
            stage: 'guides',
        },
    ];
}

export function buildJourneyItems({ confirmedProfile, steps, events, resources, notifications }) {
    if (!confirmedProfile) {
        return [];
    }

    if (confirmedProfile.borrowerType === 'new') {
        return buildNewBorrowerJourney(steps, notifications);
    }

    return buildContinuingJourney(events, resources, notifications);
}

export function buildLinkGroups(resources) {
    const groups = [
        {
            key: 'systems',
            title: 'ระบบที่ต้องใช้',
            description: 'ลิงก์สำหรับดำเนินการในระบบหลักที่เกี่ยวข้องกับการกู้ยืม',
            items: resources.filter((resource) => resource.kind === 'portal'),
        },
        {
            key: 'forms',
            title: 'ขั้นตอนและแบบฟอร์ม',
            description: 'แบบฟอร์มและหน้าประกาศที่ต้องใช้ติดตามการดำเนินการ',
            items: resources.filter((resource) => resource.kind === 'form' || resource.kind === 'article'),
        },
        {
            key: 'guides',
            title: 'คู่มือและเอกสาร',
            description: 'เอกสารอ้างอิงเพื่อเตรียมความพร้อมก่อนส่งข้อมูลหรือเอกสาร',
            items: resources.filter((resource) => resource.kind === 'guide'),
        },
    ];

    return groups.filter((group) => group.items.length > 0);
}

export function buildTickerItems({ confirmedProfile, recommendedProfile, notifications, events, steps, resources, sources, now = new Date() }) {
    const items = [];
    const relevantEvents = getRelevantEvents(events, now);

    if (confirmedProfile) {
        items.push({
            id: 'ticker-profile',
            tone: 'slate',
            text: `${profileLabel(confirmedProfile)} · ${notifications.length > 0 ? 'มีการแจ้งเตือนที่ต้องติดตาม' : 'ติดตามสถานะได้จาก dashboard นี้'}`,
            href: null,
        });
    } else if (recommendedProfile) {
        items.push({
            id: 'ticker-recommended',
            tone: 'sky',
            text: `แนะนำให้ตั้งค่าประเภทผู้กู้เป็น ${profileLabel(recommendedProfile)} เพื่อดูข้อมูลที่ตรงกับคุณ`,
            href: null,
        });
    }

    notifications.slice(0, 3).forEach((notification) => {
        items.push({
            id: `ticker-notification-${notification.id}`,
            tone: notification.phase === 'closingSoon' ? 'amber' : 'emerald',
            text: `${notification.title} · ${notification.message}`,
            href: notification.href,
        });
    });

    relevantEvents.slice(0, 2).forEach((event) => {
        items.push({
            id: `ticker-event-${event.id}`,
            tone: event.phase === 'closingSoon' ? 'amber' : 'slate',
            text: `${event.title} · ปิดรับ ${formatThaiDateTime(event.closesAt)}`,
            href: event.href,
        });
    });

    steps
        .filter((step) => step.status === 'pendingAnnouncement')
        .slice(0, 1)
        .forEach((step) => {
            items.push({
                id: `ticker-step-${step.id}`,
                tone: 'amber',
                text: `${step.title} · ${step.summary}`,
                href: step.href,
            });
        });

    resources.slice(0, 2).forEach((resource) => {
        items.push({
            id: `ticker-resource-${resource.id}`,
            tone: resource.kind === 'guide' ? 'sky' : 'slate',
            text: `${resource.title} · ${resource.description}`,
            href: resource.href,
        });
    });

    sources.slice(0, 1).forEach((source) => {
        items.push({
            id: `ticker-source-${source.id}`,
            tone: 'slate',
            text: `${source.title} · อัปเดตล่าสุด ${formatThaiDateTime(source.modifiedAt)}`,
            href: source.url,
        });
    });

    const seen = new Set();
    return items.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
}

export function buildOverviewCards({ confirmedProfile, recommendedProfile, notifications, events, steps, resources, nextDeadline, now = new Date() }) {
    const relevantEvents = getRelevantEvents(events, now);
    const openItems = notifications.filter((notification) => notification.phase === 'open').length;
    const closingSoonItems = notifications.filter((notification) => notification.phase === 'closingSoon').length;
    const pendingAnnouncements = steps.filter((step) => step.status === 'pendingAnnouncement').length;

    return [
        {
            id: 'overview-profile',
            eyebrow: 'สถานะผู้กู้',
            value: profileLabel(confirmedProfile || recommendedProfile),
            description: confirmedProfile ? 'กำลังใช้สถานะนี้เพื่อกรองข้อมูล กยศ. ทั้งหมด' : 'ยังใช้ค่าแนะนำอยู่จนกว่าจะยืนยันประเภทผู้กู้',
            tone: confirmedProfile ? 'emerald' : 'amber',
        },
        {
            id: 'overview-active',
            eyebrow: 'รายการกำลังเปิด',
            value: openItems > 0 ? `${openItems} รายการ` : 'ยังไม่มี',
            description: openItems > 0 ? 'มีงานที่เปิดดำเนินการอยู่และสามารถกดไปยังลิงก์ทางการได้ทันที' : 'รอติดตามประกาศเปิดรับรอบถัดไปจาก feed ด้านล่าง',
            tone: openItems > 0 ? 'emerald' : 'slate',
        },
        {
            id: 'overview-watch',
            eyebrow: 'สิ่งที่ต้องเฝ้าดู',
            value: closingSoonItems > 0 ? `${closingSoonItems} ใกล้ปิดรับ` : pendingAnnouncements > 0 ? `${pendingAnnouncements} รอประกาศ` : `${resources.length} ลิงก์อ้างอิง`,
            description: closingSoonItems > 0 ? 'มีเดดไลน์ใกล้ถึงกำหนด ควรจัดการก่อนวันปิดรับ' : pendingAnnouncements > 0 ? 'บางขั้นตอนยังรอประกาศจากสถานศึกษา' : 'ยังไม่มีสถานะเร่งด่วน แต่สามารถติดตามลิงก์และเอกสารได้จากแผงด้านขวา',
            tone: closingSoonItems > 0 ? 'amber' : pendingAnnouncements > 0 ? 'sky' : 'slate',
        },
        {
            id: 'overview-deadline',
            eyebrow: 'เดดไลน์ถัดไป',
            value: relevantEvents[0]?.closesAt ? formatThaiDateTime(relevantEvents[0].closesAt) : 'ยังไม่มีกำหนด',
            description: nextDeadline,
            tone: relevantEvents[0] ? phaseMeta(relevantEvents[0].phase).tone : 'slate',
        },
    ];
}

function buildFeedItemFromNotification(notification) {
    return {
        id: `feed-notification-${notification.id}`,
        type: 'notification',
        eyebrow: notification.phase === 'closingSoon' ? 'กำหนดการใกล้ปิดรับ' : 'การแจ้งเตือนที่กำลังเปิด',
        title: notification.title,
        description: notification.message,
        tone: notification.phase === 'closingSoon' ? 'amber' : 'emerald',
        statusLabel: phaseMeta(notification.phase).label,
        href: notification.href,
        ctaLabel: notification.ctaLabel || 'ดำเนินการต่อ',
        schedule: notification.closesAt ? { opensAt: notification.opensAt, closesAt: notification.closesAt } : null,
        meta: notification.closesAt ? `ติดตามถึง ${formatThaiDateTime(notification.closesAt)}` : 'ติดตามประกาศล่าสุด',
    };
}

function buildFeedItemFromJourneyItem(item) {
    return {
        id: `feed-journey-${item.id}`,
        type: 'flow',
        eyebrow: item.eyebrow,
        title: item.title,
        description: item.description,
        tone: item.tone,
        statusLabel: item.statusLabel,
        href: item.href,
        ctaLabel: 'ดูรายละเอียด',
        schedule: item.schedule,
        meta: item.meta,
    };
}

function buildFeedFallbackFromEvent(event) {
    return {
        id: `feed-event-${event.id}`,
        type: 'event',
        eyebrow: 'ประกาศที่ต้องติดตาม',
        title: event.title,
        description: event.message,
        tone: event.phase === 'closingSoon' ? 'amber' : 'slate',
        statusLabel: phaseMeta(event.phase).label,
        href: event.href,
        ctaLabel: event.ctaLabel || 'ดูรายละเอียด',
        schedule: event.closesAt ? { opensAt: event.opensAt, closesAt: event.closesAt } : null,
        meta: event.closesAt ? `ปิดรับ ${formatThaiDateTime(event.closesAt)}` : 'ตรวจสอบประกาศล่าสุด',
    };
}

export function buildFeedItems({ confirmedProfile, recommendedProfile, notifications, events, resources, steps, now = new Date() }) {
    if (!confirmedProfile) {
        return [
            {
                id: 'feed-setup',
                type: 'setup',
                eyebrow: 'เริ่มต้นการใช้งาน',
                title: 'ยืนยันประเภทผู้กู้ก่อนใช้งาน feed แบบเต็ม',
                description: recommendedProfile
                    ? `ระบบแนะนำให้คุณเริ่มต้นด้วย ${profileLabel(recommendedProfile)} แล้วค่อยปรับแก้ภายหลังได้`
                    : 'เลือกประเภทผู้กู้และระดับการศึกษาเพื่อให้ระบบคัดเฉพาะกำหนดการและข่าวที่เกี่ยวข้องกับคุณ',
                tone: 'sky',
                statusLabel: 'ต้องตั้งค่า',
                href: null,
                ctaLabel: 'ตั้งค่าประเภทผู้กู้',
                schedule: null,
                meta: 'เมื่อตั้งค่าแล้ว feed และการแจ้งเตือนจะอัปเดตตามสถานะของคุณ',
            },
        ];
    }

    const items = [
        ...notifications.map(buildFeedItemFromNotification),
        ...buildJourneyItems({ confirmedProfile, steps, events, resources, notifications }).map(buildFeedItemFromJourneyItem),
    ];

    if (items.length === 0) {
        return getRelevantEvents(events, now).slice(0, 3).map(buildFeedFallbackFromEvent);
    }

    return items;
}

export function buildManagementHighlights({ confirmedProfile, recommendedProfile, notifications, resources, sources }) {
    const baseProfile = confirmedProfile || recommendedProfile;

    return [
        {
            id: 'highlight-profile',
            title: 'ประเภทผู้กู้ที่กำลังใช้งาน',
            value: profileLabel(baseProfile),
            description: confirmedProfile ? 'ยืนยันแล้วและใช้เป็นค่าหลักของ dashboard นี้' : 'ยังเป็นค่าแนะนำจนกว่าจะยืนยันประเภทผู้กู้',
            tone: confirmedProfile ? 'emerald' : 'amber',
        },
        {
            id: 'highlight-bell',
            title: 'การแจ้งเตือนในกระดิ่ง',
            value: `${notifications.length} รายการ`,
            description: notifications.length > 0 ? 'มีรายการที่ต้องติดตามจากกำหนดการและประกาศล่าสุด' : 'ขณะนี้ยังไม่มีรายการเร่งด่วนในกระดิ่ง',
            tone: notifications.length > 0 ? 'sky' : 'slate',
        },
        {
            id: 'highlight-sources',
            title: 'ประกาศต้นทางที่ติดตาม',
            value: `${sources.length} แหล่งข้อมูล`,
            description: resources.length > 0 ? 'มีลิงก์ระบบ แบบฟอร์ม และคู่มือพร้อมใช้งานในแผงจัดการ' : 'กำลังรอข้อมูลประกาศและลิงก์อ้างอิงเพิ่มเติม',
            tone: sources.length > 0 ? 'slate' : 'amber',
        },
    ];
}

export function buildPageSummary({ confirmedProfile, recommendedProfile, notifications, events, resources, now = new Date() }) {
    const nextAction = buildNextAction({ confirmedProfile, recommendedProfile, notifications, events, resources, now });
    const summaryPhase = nextAction.phase || (confirmedProfile ? null : 'setup');
    const summaryMeta = phaseMeta(summaryPhase);
    const relevantEvents = getRelevantEvents(events, now);
    const nextDeadline = nextAction.deadlineText
        || (relevantEvents[0]?.closesAt ? `กำหนดการถัดไปปิดรับ ${formatThaiDateTime(relevantEvents[0].closesAt)}` : 'ยังไม่มีเดดไลน์ที่เปิดเผยเพิ่มเติมในตอนนี้');

    return {
        nextAction,
        statusLabel: summaryMeta.label,
        statusTone: summaryMeta.tone,
        nextDeadline,
    };
}
