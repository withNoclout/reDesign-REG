import { load } from 'cheerio';

const CONTINUOUSLY_PAGE_URL = 'https://sa.op.kmutnb.ac.th/continuously/';
const CONTINUOUSLY_PAGE_API_URL = 'https://sa.op.kmutnb.ac.th/wp-json/wp/v2/pages?slug=continuously&_fields=id,slug,link,modified,title,content';
const BANGKOK_TIMEZONE_OFFSET = '+07:00';

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

const CHECKLIST_WINDOW_REGEX = /ระดับ\s*(ปวช\.|ป\.ตรี)\s*เปิดระบบวันที่\s*(\d{1,2})\s+([ก-๙.]+)\s+(\d{4})\s+เวลา\s*(\d{1,2})[.:](\d{2})\s*น\.\s*ปิดระบบวันที่\s*(\d{1,2})\s+([ก-๙.]+)\s+(\d{4})\s+เวลา\s*(\d{1,2})[.:](\d{2})\s*น\./g;

const NOTIFICATION_PRIORITY = {
    open: 0,
    upcoming: 1,
    updated: 2,
    available: 3,
};

function normalizeWhitespace(value) {
    return String(value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function toAbsoluteUrl(href) {
    if (!href) return CONTINUOUSLY_PAGE_URL;
    return new URL(href, CONTINUOUSLY_PAGE_URL).toString();
}

function parseThaiDateTime(day, monthName, year, hour, minute) {
    const month = THAI_MONTHS.get(monthName.trim());
    if (!month) return null;

    const normalizedYear = Number(year) > 2400 ? Number(year) - 543 : Number(year);
    const isoValue = `${normalizedYear}-${month}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${BANGKOK_TIMEZONE_OFFSET}`;
    const parsed = new Date(isoValue);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatThaiDateTime(value) {
    return new Intl.DateTimeFormat('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Bangkok',
    }).format(value);
}

function buildChecklistNotifications(text, checklistUrl) {
    if (!checklistUrl) return [];

    const notifications = [];
    const now = new Date();

    for (const match of text.matchAll(CHECKLIST_WINDOW_REGEX)) {
        const [, level, startDay, startMonth, startYear, startHour, startMinute, endDay, endMonth, endYear, endHour, endMinute] = match;
        const opensAt = parseThaiDateTime(startDay, startMonth, startYear, startHour, startMinute);
        const closesAt = parseThaiDateTime(endDay, endMonth, endYear, endHour, endMinute);

        if (!opensAt || !closesAt || closesAt < now) {
            continue;
        }

        const isOpen = opensAt <= now && now <= closesAt;
        notifications.push({
            id: `student-affairs-checklist-${level}-${closesAt.toISOString()}`,
            kind: 'deadline',
            status: isOpen ? 'open' : 'upcoming',
            title: `ลงทะเบียน Check List ${level}`,
            message: isOpen
                ? `เปิดรับถึง ${formatThaiDateTime(closesAt)}`
                : `เปิดรับ ${formatThaiDateTime(opensAt)}`,
            href: checklistUrl,
            ctaLabel: 'ไปยังฟอร์ม',
            publishedAt: opensAt.toISOString(),
        });
    }

    return notifications;
}

function buildResources(links) {
    const resources = [];

    const pushResource = (id, title, href, kind) => {
        if (!href) return;
        resources.push({ id, title, href, kind });
    };

    const checklistLink = links.find((item) => /google\.com\/forms/i.test(item.href));
    pushResource('student-affairs-checklist-form', 'ลงทะเบียนขอรับ Check List', checklistLink?.href, 'form');

    const loanPortalLink = links.find((item) => item.text === 'เข้าระบบที่นี่');
    pushResource('student-affairs-loan-portal', 'ระบบ DSL / กยศ. Connect', loanPortalLink?.href, 'portal');

    const exceedCourseLink = links.find((item) => item.text === 'คลิกอ่าน' || item.text.includes('กู้เกินหลักสูตร'));
    pushResource('student-affairs-exceed-course', 'รายละเอียดกู้เกินหลักสูตร', exceedCourseLink?.href, 'article');

    const loanGuideLink = links.find((item) => item.text === 'วิธีการทำแบบเบิกเงิน');
    pushResource('student-affairs-loan-guide', 'คู่มือทำแบบเบิกเงิน', loanGuideLink?.href, 'guide');

    const signatureGuideLink = links.find((item) => item.text === 'ตัวอย่างการเซ็นชื่อในแบบเบิกเงิน');
    pushResource('student-affairs-signature-guide', 'ตัวอย่างการเซ็นชื่อ', signatureGuideLink?.href, 'guide');

    return resources;
}

function buildNotifications(page, resources, text) {
    const notifications = [
        {
            id: `student-affairs-page-update-${page.modified}`,
            kind: 'update',
            status: 'updated',
            title: 'กองกิจการนักศึกษาอัปเดตหน้า กยศ.',
            message: `อัปเดตล่าสุด ${formatThaiDateTime(new Date(page.modified))}`,
            href: page.link,
            ctaLabel: 'ดูประกาศ',
            publishedAt: page.modified,
        },
    ];

    const checklistResource = resources.find((item) => item.id === 'student-affairs-checklist-form');
    notifications.push(...buildChecklistNotifications(text, checklistResource?.href));

    const loanPortalResource = resources.find((item) => item.id === 'student-affairs-loan-portal');
    if (loanPortalResource) {
        notifications.push({
            id: 'student-affairs-loan-portal',
            kind: 'action',
            status: 'available',
            title: 'เข้า DSL เพื่อทำแบบเบิกเงิน',
            message: 'ลิงก์ทางการจากกองกิจการนักศึกษา สำหรับขั้นตอนเบิกเงินกู้ยืม',
            href: loanPortalResource.href,
            ctaLabel: 'เปิดระบบ',
            publishedAt: page.modified,
        });
    }

    return notifications.sort((left, right) => {
        const leftPriority = NOTIFICATION_PRIORITY[left.status] ?? 99;
        const rightPriority = NOTIFICATION_PRIORITY[right.status] ?? 99;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
    });
}

/**
 * @returns {Promise<StudentAffairsFeed>}
 */
export async function getStudentAffairsContinuouslyFeed() {
    const response = await fetch(CONTINUOUSLY_PAGE_API_URL, {
        headers: {
            accept: 'application/json',
        },
        next: { revalidate: 300 },
    });

    if (!response.ok) {
        throw new Error(`Student affairs upstream returned ${response.status}`);
    }

    const pages = await response.json();
    const page = pages?.[0];

    if (!page?.content?.rendered) {
        throw new Error('Student affairs continuously page is unavailable');
    }

    const html = page.content.rendered;
    const $ = load(html);
    const text = normalizeWhitespace($.text());
    const links = $('a')
        .toArray()
        .map((element) => ({
            text: normalizeWhitespace($(element).text()),
            href: toAbsoluteUrl($(element).attr('href')),
        }))
        .filter((item) => item.text && item.href);

    const resources = buildResources(links);
    const notifications = buildNotifications({
        modified: page.modified,
        link: toAbsoluteUrl(page.link),
    }, resources, text);

    return {
        source: {
            id: page.id,
            slug: page.slug,
            title: normalizeWhitespace(page.title?.rendered),
            url: toAbsoluteUrl(page.link),
            modifiedAt: page.modified,
        },
        notifications,
        resources,
    };
}
