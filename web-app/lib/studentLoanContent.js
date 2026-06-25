import { load } from 'cheerio';

const WP_PAGES_API = 'https://sa.op.kmutnb.ac.th/wp-json/wp/v2/pages';
const WP_POSTS_API = 'https://sa.op.kmutnb.ac.th/wp-json/wp/v2/posts';
const BANGKOK_TIMEZONE_OFFSET = '+07:00';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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

const CONTINUING_WINDOW_REGEX = /ระดับ\s*(ปวช\.|ป\.ตรี)\s*เปิดระบบวันที่\s*(\d{1,2})\s+([ก-๙.]+)\s+(\d{4})\s+เวลา\s*(\d{1,2})[.:](\d{2})\s*น\.\s*ปิดระบบวันที่\s*(\d{1,2})\s+([ก-๙.]+)\s+(\d{4})\s+เวลา\s*(\d{1,2})[.:](\d{2})\s*น\./g;
const NEW_PREAPPROVE_WINDOW_REGEX = /สำหรับ\s*(ปวช\.|อนุปริญญา|ป\.ตรี)\s*วันที่\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s+([ก-๙.]+)\s+(\d{4})/g;
const NEW_GENERIC_LEVEL_WINDOW_REGEX = /(?:สำหรับ|ระดับ)\s*(ปวช\.|อนุปริญญา|ป\.ตรี)\s*(?:เปิดให้ทำ(?:การ)?|เปิดระบบ|วันที่)\s*(?:วันที่)?\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s+([ก-๙.]+)\s+(\d{4})/g;


function normalizeWhitespace(value) {
    return String(value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function toAbsoluteUrl(href, fallback = 'https://sa.op.kmutnb.ac.th/studentloan/') {
    if (!href) return fallback;
    return new URL(href, fallback).toString();
}

function educationLevelFromLabel(label) {
    return /ป\.ตรี/.test(label) ? 'bachelor' : 'vocational';
}

function educationLabel(level) {
    return level === 'bachelor' ? 'ป.ตรี' : 'ปวช./อนุปริญญา';
}

function parseThaiDateTime(day, monthName, year, hour = '0', minute = '0') {
    const month = THAI_MONTHS.get(monthName.trim());
    if (!month) return null;

    const normalizedYear = Number(year) > 2400 ? Number(year) - 543 : Number(year);
    const isoValue = `${normalizedYear}-${month}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${BANGKOK_TIMEZONE_OFFSET}`;
    const parsed = new Date(isoValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function createScheduleEvents({ audience, educationLevel, stage, title, href, opensAt, closesAt, sourceId }) {
    const baseId = `loan-${audience}-${educationLevel}-${stage}-${opensAt.toISOString()}-${closesAt.toISOString()}`;
    const reminderAt = new Date(closesAt.getTime() - SEVEN_DAYS_MS);

    return [
        {
            id: `${baseId}-open`,
            audience,
            educationLevel,
            stage,
            phase: 'open',
            title,
            message: `เปิดระบบแล้ว ถึง ${formatThaiDateTime(closesAt)}`,
            href,
            ctaLabel: 'ดำเนินการต่อ',
            opensAt: opensAt.toISOString(),
            closesAt: closesAt.toISOString(),
            reminderAt: reminderAt.toISOString(),
            sourceId,
        },
        {
            id: `${baseId}-closing-soon`,
            audience,
            educationLevel,
            stage,
            phase: 'closingSoon',
            title: `${title} ใกล้ปิดระบบ`,
            message: `เหลือ 7 วันก่อนปิดรับในวันที่ ${formatThaiDateTime(closesAt)}`,
            href,
            ctaLabel: 'ตรวจสอบกำหนดการ',
            opensAt: opensAt.toISOString(),
            closesAt: closesAt.toISOString(),
            reminderAt: reminderAt.toISOString(),
            sourceId,
        },
    ];
}

async function fetchJson(url) {
    const response = await fetch(url, {
        headers: { accept: 'application/json' },
        next: { revalidate: 300 },
    });

    if (!response.ok) {
        throw new Error(`Student loan upstream returned ${response.status} for ${url}`);
    }

    return response.json();
}

async function fetchPageBySlug(slug) {
    const pages = await fetchJson(`${WP_PAGES_API}?slug=${encodeURIComponent(slug)}&_fields=id,slug,link,modified,title,content`);
    const page = pages?.[0];
    if (!page?.content?.rendered) {
        throw new Error(`Student loan page '${slug}' is unavailable`);
    }
    return page;
}

async function fetchPostBySlug(slug) {
    const posts = await fetchJson(`${WP_POSTS_API}?slug=${encodeURIComponent(slug)}&_fields=id,slug,link,modified,title,content`);
    const post = posts?.[0];
    if (!post?.content?.rendered) {
        throw new Error(`Student loan post '${slug}' is unavailable`);
    }
    return post;
}

function extractLinksFromHtml(html, baseUrl) {
    const $ = load(html);
    return $('a')
        .toArray()
        .map((element) => ({
            text: normalizeWhitespace($(element).text()),
            href: toAbsoluteUrl($(element).attr('href'), baseUrl),
        }))
        .filter((item) => item.href);
}

function extractTextFromHtml(html) {
    const $ = load(html);
    return normalizeWhitespace($.text());
}

export function parseContinuingWindowsFromText(text, checklistUrl) {
    if (!checklistUrl) return [];

    const events = [];
    for (const match of text.matchAll(CONTINUING_WINDOW_REGEX)) {
        const [, levelLabel, startDay, startMonth, startYear, startHour, startMinute, endDay, endMonth, endYear, endHour, endMinute] = match;
        const educationLevel = educationLevelFromLabel(levelLabel);
        const opensAt = parseThaiDateTime(startDay, startMonth, startYear, startHour, startMinute);
        const closesAt = parseThaiDateTime(endDay, endMonth, endYear, endHour, endMinute);

        if (!opensAt || !closesAt) {
            continue;
        }

        events.push(...createScheduleEvents({
            audience: 'continuing',
            educationLevel,
            stage: 'checklist',
            title: `ผู้กู้ต่อเนื่อง ${educationLabel(educationLevel)} ลงทะเบียน Check List`,
            href: checklistUrl,
            opensAt,
            closesAt,
            sourceId: 'continuing-page',
        }));
    }

    return events;
}

export function parseNewPreApproveWindowsFromText(text, actionUrl) {
    if (!actionUrl) return [];

    const events = [];
    for (const match of text.matchAll(NEW_PREAPPROVE_WINDOW_REGEX)) {
        const [, levelLabel, startDay, endDayRaw, monthName, year] = match;
        const educationLevel = educationLevelFromLabel(levelLabel);
        const endDay = endDayRaw || startDay;
        const opensAt = parseThaiDateTime(startDay, monthName, year, '0', '0');
        const closesAt = parseThaiDateTime(endDay, monthName, year, '23', '59');

        if (!opensAt || !closesAt) {
            continue;
        }

        events.push(...createScheduleEvents({
            audience: 'new',
            educationLevel,
            stage: 'preapprove',
            title: `ผู้กู้รายใหม่ ${educationLabel(educationLevel)} ยื่น Pre-Approve`,
            href: actionUrl,
            opensAt,
            closesAt,
            sourceId: 'new-preapprove-post',
        }));
    }
    return events;
}

function buildNewStageTitle(stage, educationLevel) {
    const levelLabel = educationLabel(educationLevel);

    switch (stage) {
        case 'preapprove':
            return `ผู้กู้รายใหม่ ${levelLabel} ยื่น Pre-Approve`;
        case 'dsl-request':
            return `ผู้กู้รายใหม่ ${levelLabel} ยื่นคำขอกู้ในระบบ DSL / กยศ. Connect`;
        case 'appointment':
            return `ผู้กู้รายใหม่ ${levelLabel} จองคิวนัดส่งสัญญา`;
        case 'contract':
            return `ผู้กู้รายใหม่ ${levelLabel} ทำสัญญาในระบบ DSL / กยศ. Connect`;
        case 'document-submit':
            return `ผู้กู้รายใหม่ ${levelLabel} ส่งสัญญาและแบบเบิกเงินกู้ยืม`;
        default:
            return `ผู้กู้รายใหม่ ${levelLabel} ${stage}`;
    }
}

export function parseNewBorrowerStageWindowsFromText(text, { href, stage, sourceId }) {
    if (!href) return [];

    const events = [];
    for (const match of text.matchAll(NEW_GENERIC_LEVEL_WINDOW_REGEX)) {
        const [, levelLabel, startDay, endDayRaw, monthName, year] = match;
        const educationLevel = educationLevelFromLabel(levelLabel);
        const endDay = endDayRaw || startDay;
        const opensAt = parseThaiDateTime(startDay, monthName, year, '0', '0');
        const closesAt = parseThaiDateTime(endDay, monthName, year, '23', '59');

        if (!opensAt || !closesAt) {
            continue;
        }

        events.push(...createScheduleEvents({
            audience: 'new',
            educationLevel,
            stage,
            title: buildNewStageTitle(stage, educationLevel),
            href,
            opensAt,
            closesAt,
            sourceId,
        }));
    }

    return events;
}
function summarizeStepText(text) {
    const normalized = normalizeWhitespace(text);
    if (!normalized) return '';

    const firstSentence = normalized.match(/^(.{1,220}?)(?:[.?!]|\u0e2f|$)/);
    return firstSentence ? firstSentence[1].trim() : normalized.slice(0, 220);
}

export function inferStepStatusFromText(text) {
    const normalized = normalizeWhitespace(text);
    if (!normalized) {
        return 'pendingAnnouncement';
    }

    if (/ยังไม่เปิดให้ทำ|รอประกาศจากสถานศึกษา/.test(normalized)) {
        return 'pendingAnnouncement';
    }

    if (/เปิดให้ทำ|กำหนดการ|วันที่/.test(normalized)) {
        return 'scheduled';
    }

    return 'published';
}

function createProcessStep({ id, title, href, text, stage, modifiedAt }) {
    return {
        id,
        title,
        href,
        stage,
        audience: 'new',
        educationLevel: 'all',
        status: inferStepStatusFromText(text),
        summary: summarizeStepText(text),
        modifiedAt,
    };
}

function extractSlugFromUrl(url) {
    try {
        const { pathname } = new URL(url);
        const segments = pathname.split('/').filter(Boolean);
        return segments.at(-1) || null;
    } catch {
        return null;
    }
}

async function buildContinuingContent() {
    const page = await fetchPageBySlug('continuously');
    const html = page.content.rendered;
    const text = extractTextFromHtml(html);
    const links = extractLinksFromHtml(html, page.link);

    const checklistLink = links.find((item) => /google\.com\/forms/i.test(item.href));
    const dslLink = links.find((item) => item.text === 'เข้าระบบที่นี่');
    const guideLink = links.find((item) => item.text === 'วิธีการทำแบบเบิกเงิน');
    const signatureLink = links.find((item) => item.text === 'ตัวอย่างการเซ็นชื่อในแบบเบิกเงิน');

    return {
        source: {
            id: 'continuing-page',
            title: normalizeWhitespace(page.title?.rendered),
            url: toAbsoluteUrl(page.link),
            modifiedAt: page.modified,
        },
        events: parseContinuingWindowsFromText(text, checklistLink?.href),
        resources: [
            checklistLink && {
                id: 'continuing-checklist-form',
                title: 'ลงทะเบียนขอรับ Check List',
                href: checklistLink.href,
                kind: 'form',
                audience: 'continuing',
                educationLevel: 'all',
                description: 'สำหรับผู้กู้ต่อเนื่องที่ต้องทำ Check List ตามประกาศของมหาวิทยาลัย',
            },
            dslLink && {
                id: 'continuing-dsl-portal',
                title: 'ระบบ DSL / กยศ. Connect',
                href: dslLink.href,
                kind: 'portal',
                audience: 'continuing',
                educationLevel: 'all',
                description: 'ระบบหลักสำหรับทำรายการกู้ยืมและเบิกเงินตามที่มหาวิทยาลัยอ้างอิง',
            },
            guideLink && {
                id: 'continuing-loan-guide',
                title: 'คู่มือทำแบบเบิกเงิน',
                href: guideLink.href,
                kind: 'guide',
                audience: 'continuing',
                educationLevel: 'all',
                description: 'คู่มือประกอบการทำแบบเบิกเงินกู้ยืม',
            },
            signatureLink && {
                id: 'continuing-signature-guide',
                title: 'ตัวอย่างการเซ็นชื่อในแบบเบิกเงิน',
                href: signatureLink.href,
                kind: 'guide',
                audience: 'continuing',
                educationLevel: 'all',
                description: 'ตัวอย่างการลงลายมือชื่อที่ถูกต้องในเอกสารกู้ยืม',
            },
        ].filter(Boolean),
    };
}

async function buildNewBorrowerContent() {
    const page = await fetchPageBySlug('new');
    const html = page.content.rendered;
    const links = extractLinksFromHtml(html, page.link);

    const stepDefinitions = [
        { id: 'new-step-1', stage: 'preapprove', title: 'ขั้นตอนที่ 1 ยื่นความประสงค์ขอกู้ยืม (Pre-Approve)', matcher: 'ขั้นตอนที่ 1 ยื่นความประสงค์ขอกู้ยืม' },
        { id: 'new-step-2', stage: 'dsl-request', title: 'ขั้นตอนที่ 2 ยื่นคำขอกู้ยืมเงินในระบบ DSL / กยศ. Connect', matcher: 'ขั้นตอนที่ 2 ยื่นคำขอกู้ยืมเงินในระบบ DSL / กยศ. Connect' },
        { id: 'new-step-3', stage: 'appointment', title: 'ขั้นตอนที่ 3 จองคิวนัดส่ง “สัญญาและแบบเบิกเงินกู้ยืม”', matcher: 'ขั้นตอนที่ 3 จองคิวนัดส่ง' },
        { id: 'new-step-4', stage: 'contract', title: 'ขั้นตอนที่ 4 ทำสัญญาและแบบกู้ยืมเงินในระบบ DSL / กยศ. Connect', matcher: 'ขั้นตอนที่ 4 ทำสัญญาและแบบกู้ยืมเงินในระบบ DSL / กยศ. Connect' },
        { id: 'new-step-5', stage: 'document-submit', title: 'ขั้นตอนที่ 5 ส่ง “สัญญาและแบบเบิกเงินกู้ยืม”', matcher: 'ขั้นตอนที่ 5 ส่ง' },
    ];

    const stepLinks = stepDefinitions
        .map((definition) => ({
            ...definition,
            href: links.find((item) => item.text.includes(definition.matcher))?.href || null,
        }))
        .filter((definition) => Boolean(definition.href));

    const stepPosts = await Promise.all(stepLinks.map(async (stepLink) => {
        const slug = extractSlugFromUrl(stepLink.href);
        const post = slug ? await fetchPostBySlug(slug) : null;
        const text = post ? extractTextFromHtml(post.content.rendered) : '';
        const postLinks = post ? extractLinksFromHtml(post.content.rendered, post.link) : [];

        return {
            ...stepLink,
            post,
            text,
            postLinks,
        };
    }));

    const stepOnePost = stepPosts.find((item) => item.id === 'new-step-1');
    const preApprovePortal = stepOnePost?.postLinks.find((item) => /pre-approve\.studentloan\.or\.th/i.test(item.href));
    const preApproveManual = stepOnePost?.postLinks.find((item) => /manual|pdf/i.test(item.href));

    const stepEvents = stepPosts.flatMap((stepPost) => {
        if (stepPost.stage === 'preapprove') {
            return parseNewPreApproveWindowsFromText(
                stepPost.text || '',
                preApprovePortal?.href || stepPost.post?.link || stepPost.href
            ).map((event) => ({ ...event, sourceId: stepPost.id }));
        }

        return parseNewBorrowerStageWindowsFromText(stepPost.text || '', {
            href: stepPost.post?.link || stepPost.href,
            stage: stepPost.stage,
            sourceId: stepPost.id,
        });
    });

    return {
        source: {
            id: 'new-page',
            title: normalizeWhitespace(page.title?.rendered),
            url: toAbsoluteUrl(page.link),
            modifiedAt: page.modified,
        },
        events: stepEvents,
        steps: stepPosts.map((stepPost) => createProcessStep({
            id: stepPost.id,
            title: stepPost.title,
            href: stepPost.href,
            text: stepPost.text,
            stage: stepPost.stage,
            modifiedAt: stepPost.post?.modified || page.modified,
        })),
        resources: [
            {
                id: 'new-main-page',
                title: 'หน้า ผู้กู้รายใหม่',
                href: toAbsoluteUrl(page.link),
                kind: 'article',
                audience: 'new',
                educationLevel: 'all',
                description: 'หน้าอ้างอิงหลักของผู้กู้รายใหม่จากกองกิจการนักศึกษา',
            },
            ...stepPosts.map((stepPost) => ({
                id: `${stepPost.id}-article`,
                title: stepPost.title,
                href: stepPost.href,
                kind: 'article',
                audience: 'new',
                educationLevel: 'all',
                description: stepPost.text
                    ? summarizeStepText(stepPost.text)
                    : `รายละเอียด${stepPost.title}`,
            })),
            preApprovePortal && {
                id: 'new-preapprove-portal',
                title: 'เข้าใช้งานระบบ Pre-Approve',
                href: preApprovePortal.href,
                kind: 'portal',
                audience: 'new',
                educationLevel: 'all',
                description: 'ระบบยื่นความประสงค์ขอกู้ยืมสำหรับผู้กู้รายใหม่',
            },
            preApproveManual && {
                id: 'new-preapprove-manual',
                title: 'คู่มือระบบ Pre-Approve',
                href: preApproveManual.href,
                kind: 'guide',
                audience: 'new',
                educationLevel: 'all',
                description: 'คู่มือการใช้งานระบบยื่นความประสงค์ขอกู้ยืมจากกองทุน',
            },
        ].filter(Boolean),
    };
}

export function formatThaiDateTime(value) {
    return new Intl.DateTimeFormat('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Bangkok',
    }).format(value);
}

export async function getStudentLoanContent() {
    const [continuingContent, newBorrowerContent] = await Promise.all([
        buildContinuingContent(),
        buildNewBorrowerContent(),
    ]);

    return {
        sources: [continuingContent.source, newBorrowerContent.source],
        events: [...continuingContent.events, ...newBorrowerContent.events],
        resources: [...continuingContent.resources, ...newBorrowerContent.resources],
        steps: newBorrowerContent.steps || [],
    };
}