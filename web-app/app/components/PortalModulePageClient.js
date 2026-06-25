'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useGuest } from '../context/GuestContext';
import { LOGIN_TRANSITION_NAV_ITEMS, ProductionHeroShell } from './LoginTransitionShell';
import shellStyles from './LoginTransitionShell.module.css';
import {
    buildUserMeta,
    getDisplayGpaxForStudent,
    getDisplayName,
    getUserCode,
} from '@/lib/studentPortalSummary.mjs';

export const PORTAL_NAV_ITEMS = [
    { id: 'grade', label: 'GRADE', href: '/grade', slot: 'grade', module: 'grade' },
    { id: 'schedule', label: 'SCHEDULE', href: '/grade/schedule', slot: 'schedule', module: 'grade' },
];

export const MODULES = {
    grade: {
        activeMenu: 'grade',
        module: 'grade',
        eyebrow: 'ACADEMIC RECORD',
        title: 'ผลการเรียน',
        description: 'แสดง GPAX และสถานะผลการเรียนผ่าน shell ใหม่เท่านั้น',
        primaryAction: { label: 'กลับศูนย์กลาง', href: '/main' },
    },
    schedule: {
        activeMenu: 'schedule',
        module: 'grade',
        eyebrow: 'CLASS SCHEDULE',
        title: 'ตารางเรียน',
        description: 'ปิดหน้า frontend เดิมแล้ว เหลือเฉพาะ shell ใหม่ที่รอข้อมูลจาก backend',
        primaryAction: { label: 'กลับศูนย์กลาง', href: '/main' },
    },
    registry: {
        activeMenu: 'registry',
        module: 'registration',
        eyebrow: 'REGISTRY',
        title: 'ลงทะเบียนเรียน',
        description: 'ตรวจสิทธิ์จาก REG backend ก่อนเปิดทางไปหน้าลงทะเบียนทางการ',
        primaryAction: { label: 'กลับศูนย์กลาง', href: '/main' },
    },
    evaluation: {
        activeMenu: 'evaluation',
        module: 'grade',
        eyebrow: 'EVALUATION',
        title: 'ประเมินอาจารย์',
        description: 'ปิดหน้า evaluation เดิมแล้ว จะแสดงเฉพาะ shell ใหม่ในรอบถัดไป',
        primaryAction: { label: 'กลับศูนย์กลาง', href: '/main' },
    },
    evaluationForm: {
        activeMenu: 'evaluation',
        module: 'grade',
        eyebrow: 'EVALUATION FORM',
        title: 'แบบประเมิน',
        description: 'ปิด form frontend เดิมแล้วเพื่อไม่ให้ legacy UI กลับมาแสดงผล',
        primaryAction: { label: 'กลับศูนย์กลาง', href: '/main' },
    },
    loan: {
        activeMenu: 'loan',
        module: 'student-loan',
        eyebrow: 'STUDENT LOAN',
        title: 'กองทุนกู้ยืม',
        description: 'ปิด dashboard frontend เดิมแล้ว เหลือ backend connection สำหรับข้อมูลจริง',
        primaryAction: { label: 'กลับศูนย์กลาง', href: '/main' },
    },
    classroom: {
        activeMenu: 'settings',
        module: 'settings',
        eyebrow: 'CLASSROOM SETTINGS',
        title: 'ตั้งค่า Classroom',
        description: 'ปิด settings frontend เดิมแล้ว ใช้ shell ใหม่เป็นขอบเขตเดียว',
        primaryAction: { label: 'กลับศูนย์กลาง', href: '/main' },
    },
    portfolio: {
        activeMenu: 'portfolio',
        module: 'profile',
        eyebrow: 'PORTFOLIO',
        title: 'Portfolio',
        description: 'ปิด portfolio frontend เดิมแล้ว เพื่อกัน code เก่าแสดงผลบน production',
        primaryAction: { label: 'กลับศูนย์กลาง', href: '/main' },
    },
    share: {
        activeMenu: 'portfolio',
        module: 'profile',
        eyebrow: 'SHARE',
        title: 'Share',
        description: 'ปิด guest share frontend เดิมแล้วภายใต้กฎไม่แสดงผล legacy frontend',
        primaryAction: { label: 'กลับศูนย์กลาง', href: '/main' },
    },
};

export const MODULE_ENDPOINTS = {
    grade: '/api/student/grade',
    schedule: '/api/student/schedule',
    registry: '/api/registration/gatekeeper',
    evaluation: '/api/student/evaluation',
    evaluationForm: '/api/student/evaluation',
    loan: '/api/student-loan/dashboard',
    classroom: '/api/classroom/settings',
    portfolio: '/api/portfolio/content',
    share: null,
};

export function readString(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getPayloadData(payload) {
    return payload?.data ?? payload;
}


export function extractErrorMessage(payload, fallback) {
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload?.error?.message === 'string' && payload.error.message.trim()) return payload.error.message.trim();
    if (typeof payload?.details === 'string' && payload.details.trim()) return payload.details.trim();
    return fallback;
}

export function getAcademicRecord(payload) {
    return payload?.academicRecord
        || payload?.data?.academicRecord
        || payload?.record
        || payload?.data?.record
        || null;
}


export function getGradeRows(payload) {
    const data = getPayloadData(payload);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.grades)) return data.grades;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.data)) return data.data;
    return [];
}

function getCourseSubject(row) {
    const code = readString(row?.coursecode)
        || readString(row?.courseCode)
        || readString(row?.subject_id)
        || readString(row?.code);
    const name = readString(row?.coursenameeng)
        || readString(row?.courseNameEn)
        || readString(row?.coursename)
        || readString(row?.courseName)
        || readString(row?.subject_name_en)
        || readString(row?.subject_name_th)
        || readString(row?.name);
    return [code, name].filter(Boolean).join(' ') || readString(row?.subject) || 'COURSE';
}

function buildGradeTermsFromAcademicRecord(record) {
    if (!Array.isArray(record?.semesters) || !record.semesters.length) return [];

    return record.semesters
        .map((semester) => {
            const year = readString(semester?.year) || readString(semester?.acadyear);
            const termNumber = readString(semester?.semester) || readString(semester?.term);
            const term = termNumber && year ? `${termNumber} | ${year}` : readString(semester?.id) || '';
            return {
                term,
                sortKey: `${year || '0000'}-${termNumber || '0'}`,
                rows: Array.isArray(semester?.subjects)
                    ? semester.subjects.map((subject) => ({
                        subject: getCourseSubject(subject),
                        unit: readString(subject?.credit) || readString(subject?.creditattempt) || readString(subject?.credithours) || readString(subject?.courseunit) || '-',
                        score: readString(subject?.grade) || readString(subject?.score) || '-',
                    }))
                    : [],
            };
        })
        .filter((term) => term.term || term.rows.length)
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
        .map(({ term, rows }) => ({ term, rows }));
}

export function buildStatusGradeTerms(status) {
    return [{
        term: '',
        rows: [{ subject: status, unit: '-', score: '-' }],
    }];
}

export function buildGradeTerms(payload, status = '') {
    const academicRecordTerms = buildGradeTermsFromAcademicRecord(getAcademicRecord(payload));
    if (academicRecordTerms.length) return academicRecordTerms;

    const rows = getGradeRows(payload)
        .filter((row) => {
            const subject = getCourseSubject(row);
            if (!subject) return false;
            return !subject.toUpperCase().includes('TOTAL');
        });

    if (!rows.length) return status ? buildStatusGradeTerms(status) : [];

    const grouped = new Map();
    rows.forEach((row) => {
        const semester = readString(row?.semester) || readString(row?.SEMESTER) || readString(row?.term);
        const acadyear = readString(row?.acadyear) || readString(row?.acadYear) || readString(row?.ACADYEAR) || readString(row?.year);
        const term = semester && acadyear ? `${semester} | ${acadyear}` : '';
        const key = term || 'current';
        const current = grouped.get(key) || {
            term,
            sortKey: `${acadyear || '0000'}-${semester || '0'}`,
            rows: [],
        };
        current.rows.push({
            subject: getCourseSubject(row),
            unit: readString(row?.creditattempt) || readString(row?.credithours) || readString(row?.credit) || readString(row?.courseunit) || '-',
            score: readString(row?.grade) || readString(row?.GRADE) || '-',
        });
        grouped.set(key, current);
    });

    return Array.from(grouped.values())
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
        .map(({ term, rows: termRows }) => ({ term, rows: termRows }));
}

function usePortalModuleData(moduleId, enabled = true, endpointOverride = undefined, onAuthExpired = undefined) {
    const endpoint = endpointOverride === undefined ? MODULE_ENDPOINTS[moduleId] || null : endpointOverride;
    const shouldFetch = Boolean(endpoint && enabled);
    const [state, setState] = useState({ loading: shouldFetch, error: '', payload: null });

    useEffect(() => {
        if (!shouldFetch) {
            setState({ loading: false, error: '', payload: null });
            return undefined;
        }

        const controller = new AbortController();
        setState({ loading: true, error: '', payload: null });

        fetch(endpoint, {
            cache: 'no-store',
            credentials: 'same-origin',
            signal: controller.signal,
        })
            .then(async (response) => {
                const payload = await response.json().catch(() => null);
                if (response.status === 401 || payload?.code === 'SESSION_EXPIRED' || payload?.error?.code === 'UNAUTHORIZED') {
                    setState({ loading: false, error: 'SESSION_EXPIRED', payload: null });
                    onAuthExpired?.();
                    return;
                }
                if (!response.ok || payload?.success === false) {
                    throw new Error(extractErrorMessage(payload, `โหลดข้อมูลไม่สำเร็จ (${response.status})`));
                }
                setState({ loading: false, error: '', payload });
            })
            .catch((cause) => {
                if (controller.signal.aborted) return;
                setState({
                    loading: false,
                    error: cause?.message || 'โหลดข้อมูลไม่สำเร็จ',
                    payload: null,
                });
            });

        return () => controller.abort();
    }, [endpoint, onAuthExpired, shouldFetch]);

    return state;
}

function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    return number.toLocaleString('th-TH');
}

const OFFICIAL_ENROLL_URL = 'https://reg3.kmutnb.ac.th/registrar/enroll';

function getRegistrationData(state) {
    return getPayloadData(state.payload) || {};
}

function getRegistrationStatusTone(eligibility) {
    if (eligibility?.canRegister) {
        return {
            label: 'พร้อมดำเนินการ',
            className: 'border-emerald-600/20 bg-emerald-50 text-emerald-800',
            headline: 'ไม่พบเงื่อนไขที่บล็อก',
            description: 'ระบบตรวจสอบข้อมูลล่าสุดจาก REG แล้ว สามารถเปิดหน้าลงทะเบียนทางการได้',
        };
    }

    if (Array.isArray(eligibility?.blockingReasons) && eligibility.blockingReasons.length > 0) {
        return {
            label: 'ต้องแก้ไขก่อน',
            className: 'border-amber-600/20 bg-amber-50 text-amber-900',
            headline: 'ยังไม่ควรเปิดหน้าลงทะเบียน',
            description: eligibility.blockingReasons[0],
        };
    }

    return {
        label: 'รอข้อมูล REG',
        className: 'border-zinc-950/10 bg-zinc-100 text-zinc-700',
        headline: 'กำลังรอสถานะจาก backend',
        description: 'ยังไม่มีข้อมูลสิทธิ์ลงทะเบียนที่พร้อมแสดง',
    };
}

function getPeriodLabel(eligibility) {
    const status = eligibility?.registrationPeriodStatus || (eligibility?.isRegistrationPeriod ? 'open' : 'unknown');
    if (status === 'open') return 'REG ระบุว่าอยู่ในช่วงเปิดลงทะเบียน';
    if (status === 'closed') return 'REG ระบุว่ายังปิดช่วงลงทะเบียน';
    return eligibility?.registrationPeriodMessage || 'REG ยังไม่ส่งสถานะช่วงลงทะเบียนที่ชัดเจน';
}

function getDebtLabel(eligibility) {
    if (eligibility?.hasDebt) {
        return `พบยอดค้างชำระ ${formatNumber(eligibility.outstandingBalance)} บาท`;
    }
    return 'ไม่พบยอดค้างชำระจาก REG';
}

function RegistrationSkeleton() {
    return (
        <div className="space-y-6" aria-label="กำลังโหลดข้อมูลลงทะเบียน">
            <div className="space-y-3">
                <div className="h-3 w-32 animate-pulse rounded-full bg-zinc-200" />
                <div className="h-9 w-72 max-w-full animate-pulse rounded-full bg-zinc-200" />
                <div className="h-4 w-[min(28rem,100%)] animate-pulse rounded-full bg-zinc-200" />
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="h-48 animate-pulse rounded-3xl bg-zinc-200" />
                <div className="h-48 animate-pulse rounded-3xl bg-zinc-200" />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
                <div className="h-24 animate-pulse rounded-2xl bg-zinc-200" />
                <div className="h-24 animate-pulse rounded-2xl bg-zinc-200" />
                <div className="h-24 animate-pulse rounded-2xl bg-zinc-200" />
            </div>
        </div>
    );
}

function EligibilityItem({ label, value, tone = 'neutral' }) {
    const toneClassName = {
        good: 'border-emerald-600/20 bg-emerald-50 text-emerald-900',
        warn: 'border-amber-600/20 bg-amber-50 text-amber-900',
        bad: 'border-red-600/20 bg-red-50 text-red-900',
        neutral: 'border-zinc-950/10 bg-white text-zinc-900',
    }[tone];

    return (
        <div className={`rounded-2xl border p-4 ${toneClassName}`}>
            <dt className="text-xs font-medium opacity-60">{label}</dt>
            <dd className="mt-2 text-sm font-semibold leading-6">{value}</dd>
        </div>
    );
}

function FeeList({ fees }) {
    if (!fees.length) {
        return (
            <p className="rounded-2xl border border-emerald-600/15 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
                ไม่พบรายการค้างชำระ
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {fees.map((fee) => (
                <div
                    className="rounded-2xl border border-red-600/15 bg-red-50 p-4 text-sm text-red-950"
                    key={`${fee.feeid}-${fee.acadyear}-${fee.semester}-${fee.balance}`}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="font-semibold">{fee.feeidname || 'รายการค้างชำระ'}</p>
                            <p className="mt-1 text-red-950/60">
                                {fee.semester && fee.acadyear ? `ภาคเรียน ${fee.semester}/${fee.acadyear}` : 'ไม่ระบุภาคเรียน'}
                            </p>
                        </div>
                        <p className="whitespace-nowrap font-semibold">{formatNumber(fee.balance)} บาท</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

function PanelHeader({ config, state }) {
    return (
        <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">{config.eyebrow}</p>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-zinc-950">{config.title}</h2>
            <p className="max-w-[56ch] text-sm leading-6 text-zinc-600">{state.loading ? 'กำลังเชื่อมต่อข้อมูลจาก backend' : config.description}</p>
        </div>
    );
}

function DataRow({ label, value }) {
    return (
        <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-t border-zinc-950/10 py-3 text-sm">
            <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
            <dd className="truncate text-zinc-950">{value || '-'}</dd>
        </div>
    );
}

const SCHEDULE_WEEKDAY_ORDER = [2, 3, 4, 5, 6];
const SCHEDULE_PERIOD_STARTS = ['09:00', '13:00', '16:00'];
const SCHEDULE_CARD_WIDTH_PX = 200;
const SCHEDULE_CARD_HEIGHT_PX = 60;
const SCHEDULE_COLUMN_GAP_PX = 123;
const SCHEDULE_ROW_GAP_PX = 37;

function getScheduledCourses(payload) {
    if (Array.isArray(payload?.scheduled)) return payload.scheduled;
    const data = getPayloadData(payload);
    if (Array.isArray(data?.scheduled)) return data.scheduled;
    if (Array.isArray(data)) return data.filter((item) => item?.weekday != null);
    return [];
}

function toMinutes(value) {
    const text = readString(value);
    if (!text || !/^\d{2}:\d{2}$/.test(text)) return null;
    const [hours, minutes] = text.split(':').map(Number);
    return hours * 60 + minutes;
}

function getScheduleColumnIndex(course) {
    const fromMinutes = toMinutes(course?.timefrom);
    if (fromMinutes == null) return -1;

    const periodStarts = SCHEDULE_PERIOD_STARTS.map(toMinutes);
    if (fromMinutes < periodStarts[1]) return 0;
    if (fromMinutes < periodStarts[2]) return 1;
    return 2;
}

function getScheduleSubjectDisplay(subject) {
    const text = readString(subject);
    const minimumTrimLength = 28;
    const minimumVisibleLength = 12;

    if (!text || text.length < minimumTrimLength) return text || subject;

    const breakTokens = [' and ', ' or ', ' with ', ' for ', ' to ', ' of ', ' & ', ' / ', ' และ ', ' กับ '];
    const normalized = text.toLowerCase();
    const targetCenter = text.length / 2;
    let bestCandidate = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const token of breakTokens) {
        const lowerToken = token.toLowerCase();
        let searchFrom = 0;

        while (searchFrom < normalized.length) {
            const index = normalized.indexOf(lowerToken, searchFrom);
            if (index === -1) break;

            const candidate = text.slice(0, index).trimEnd();
            if (candidate.length >= minimumVisibleLength) {
                const score = Math.abs(candidate.length - targetCenter);
                if (score < bestScore) {
                    bestScore = score;
                    bestCandidate = candidate;
                }
            }

            searchFrom = index + token.length;
        }
    }

    return bestCandidate || text;
}

let scheduleTextSegmenter = null;

function getScheduleTextSegments(text) {
    const value = readString(text) || '';
    if (!value) return [];

    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
        scheduleTextSegmenter ||= new Intl.Segmenter(['th', 'en'], { granularity: 'grapheme' });
        return Array.from(scheduleTextSegmenter.segment(value), ({ segment }) => segment);
    }

    return Array.from(value);
}

function renderScheduleCardText(text, variant, delay) {
    const value = readString(text) || '';
    const segments = getScheduleTextSegments(value);
    const variantClassName = variant === 'room'
        ? shellStyles.loginTransitionScheduleCardRoom
        : shellStyles.loginTransitionScheduleCardSubject;

    return (
        <span
            className={`${shellStyles.loginTransitionScheduleCardText} ${variantClassName}`}
            style={{ '--schedule-text-delay': delay, '--schedule-char-count': segments.length }}
        >
            {segments.map((segment, index) => (
                <span
                    className={`${shellStyles.loginTransitionScheduleCardChar}${segment === ' ' ? ` ${shellStyles.loginTransitionScheduleCardSpace}` : ''}`}
                    key={`${variant}-${segment}-${index}`}
                    style={{ '--i': index }}
                >
                    {segment === ' ' ? '\u00a0' : segment}
                </span>
            ))}
        </span>
    );
}

function renderScheduleCardTeeth() {
    return ['top', 'bottom'].flatMap((side) =>
        Array.from({ length: 11 }, (_, index) => (
            <span
                className={`${shellStyles.loginTransitionScheduleCardTooth} ${side === 'top' ? shellStyles.isTop : shellStyles.isBottom}`}
                key={`${side}-${index}`}
                style={{ '--i': index, '--d': Math.abs(index - 5) }}
            />
        )),
    );
}



function ScheduleCard({ subject, room, style }) {
    const subjectText = getScheduleSubjectDisplay(subject);

    return (
        <div
            className={shellStyles.loginTransitionScheduleCard}
            style={style}
        >
            <span className={shellStyles.loginTransitionScheduleCardSurface} aria-hidden="true">
                {renderScheduleCardTeeth()}
            </span>
            <span className={shellStyles.loginTransitionScheduleCardLine} aria-hidden="true" />
            {renderScheduleCardText(subjectText, 'subject', 'calc(var(--schedule-card-delay) + 980ms)')}
            {renderScheduleCardText(room, 'room', 'calc(var(--schedule-card-delay) + 1120ms)')}
        </div>
    );
}

function SchedulePanel({ state }) {
    const courses = getScheduledCourses(state.payload).filter((course) => SCHEDULE_WEEKDAY_ORDER.includes(course?.weekday));
    const cardsBySlot = new Map();

    courses.forEach((course) => {
        const rowIndex = SCHEDULE_WEEKDAY_ORDER.indexOf(course.weekday);
        const columnIndex = getScheduleColumnIndex(course);
        if (rowIndex === -1 || columnIndex === -1) return;

        const subject = readString(course?.subject_name_en)
            || readString(course?.subject_name_th)
            || readString(course?.subject_id);
        const room = [readString(course?.section), readString(course?.roomcode)].filter(Boolean).join(' ');
        if (!subject || !room) return;

        const slotKey = `${rowIndex}:${columnIndex}`;
        if (cardsBySlot.has(slotKey)) return;

        cardsBySlot.set(slotKey, {
            key: `${slotKey}:${readString(course?.subject_id) || subject}`,
            room,
            subject,
            style: {
                left: `${columnIndex * (SCHEDULE_CARD_WIDTH_PX + SCHEDULE_COLUMN_GAP_PX)}px`,
                top: `${rowIndex * (SCHEDULE_CARD_HEIGHT_PX + SCHEDULE_ROW_GAP_PX)}px`,
                '--schedule-card-delay': `${120 + ((rowIndex * 3) + columnIndex) * 72}ms`,
            },
        });
    });

    return (
        <div className={shellStyles.loginTransitionSchedulePanel}>
            {Array.from(cardsBySlot.values()).map((card) => (
                <ScheduleCard key={card.key} room={card.room} style={card.style} subject={card.subject} />
            ))}
        </div>
    );
}

function GenericModulePanel({ config, state, rows = [] }) {
    return (
        <div className="flex min-h-full flex-col justify-between gap-10">
            <PanelHeader config={config} state={state} />
            {state.error ? (
                <p className="rounded-xl bg-red-950 px-4 py-3 text-sm text-red-50">{state.error}</p>
            ) : (
                <dl>
                    {rows.map((row) => (
                        <DataRow key={row.label} label={row.label} value={row.value} />
                    ))}
                </dl>
            )}
        </div>
    );
}


function RegistryPanel({ config, state }) {
    const data = getRegistrationData(state);
    const eligibility = data.eligibility || {};
    const statusTone = getRegistrationStatusTone(eligibility);
    const outstandingFees = Array.isArray(eligibility.outstandingFees) ? eligibility.outstandingFees : [];
    const blockingReasons = Array.isArray(eligibility.blockingReasons) ? eligibility.blockingReasons : [];
    const periodStatus = eligibility.registrationPeriodStatus || (eligibility.isRegistrationPeriod ? 'open' : 'unknown');
    const semesterLabel = data.acadInfo?.enrollsemester && data.acadInfo?.enrollacadyear
        ? `${data.acadInfo.enrollsemester}/${data.acadInfo.enrollacadyear}`
        : 'รอข้อมูลภาคเรียน';

    if (state.loading) {
        return <RegistrationSkeleton />;
    }

    if (state.error) {
        return (
            <div className="flex min-h-full flex-col justify-between gap-8">
                <PanelHeader config={config} state={state} />
                <div className="rounded-3xl border border-red-600/15 bg-red-50 p-6 text-red-950">
                    <p className="text-sm font-semibold">เชื่อมต่อ backend ไม่สำเร็จ</p>
                    <p className="mt-2 text-sm leading-6 text-red-950/70">{state.error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-full flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <PanelHeader config={config} state={state} />
                <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-sm font-semibold ${statusTone.className}`}>
                    {statusTone.label}
                </span>
            </div>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]" aria-label="สถานะลงทะเบียน">
                <div className={`rounded-3xl border p-6 ${statusTone.className}`}>
                    <p className="text-sm font-medium opacity-60">ผลตรวจสิทธิ์ล่าสุด</p>
                    <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{statusTone.headline}</h3>
                    <p className="mt-3 max-w-[62ch] text-sm leading-6 opacity-75">{statusTone.description}</p>
                    {blockingReasons.length > 0 && (
                        <ul className="mt-5 space-y-2 text-sm font-medium opacity-80">
                            {blockingReasons.map((reason) => (
                                <li className="rounded-2xl bg-white/50 px-3 py-2" key={reason}>{reason}</li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="rounded-3xl border border-zinc-950/10 bg-zinc-950 p-6 text-white">
                    <p className="text-sm text-white/55">ภาคเรียน</p>
                    <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{semesterLabel}</p>
                    <div className="mt-6 border-t border-white/15 pt-5">
                        <p className="text-sm text-white/55">Stage จาก REG</p>
                        <p className="mt-2 text-2xl font-semibold">{data.stage != null ? data.stage : '-'}</p>
                    </div>
                </div>
            </section>

            <dl className="grid gap-3 md:grid-cols-3">
                <EligibilityItem
                    label="ช่วงลงทะเบียน"
                    tone={periodStatus === 'closed' ? 'bad' : periodStatus === 'open' ? 'good' : 'warn'}
                    value={getPeriodLabel(eligibility)}
                />
                <EligibilityItem
                    label="หนี้ค้างชำระ"
                    tone={eligibility.hasDebt ? 'bad' : 'good'}
                    value={getDebtLabel(eligibility)}
                />
                <EligibilityItem
                    label="การยืนยันจาก backend"
                    tone={eligibility.canRegister ? 'good' : 'warn'}
                    value={eligibility.stageMessage || 'รอข้อมูลจาก REG'}
                />
            </dl>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]" aria-label="รายละเอียดและการดำเนินการ">
                <div className="rounded-3xl border border-zinc-950/10 bg-white p-5">
                    <div className="mb-4 flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold tracking-[-0.02em] text-zinc-950">รายการค้างชำระ</h3>
                        <span className="text-sm font-medium text-zinc-500">{formatNumber(eligibility.outstandingBalance)} บาท</span>
                    </div>
                    <FeeList fees={outstandingFees} />
                </div>

                <div className="flex flex-col justify-between rounded-3xl border border-zinc-950/10 bg-zinc-100 p-5">
                    <div>
                        <h3 className="text-lg font-semibold tracking-[-0.02em] text-zinc-950">เปิดระบบทางการ</h3>
                        <p className="mt-2 text-sm leading-6 text-zinc-600">
                            แอปนี้ตรวจสอบเงื่อนไขก่อนเข้าใช้งาน ส่วนการเพิ่มถอนวิชายังทำบนระบบ REG ของมหาวิทยาลัย
                        </p>
                    </div>
                    {eligibility.canRegister ? (
                        <a
                            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#ff5722] px-5 text-sm font-semibold text-white transition hover:bg-[#e64a19] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5722] active:translate-y-px"
                            href={OFFICIAL_ENROLL_URL}
                            rel="noreferrer"
                            target="_blank"
                        >
                            เปิด REG
                        </a>
                    ) : (
                        <span
                            aria-disabled="true"
                            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl bg-zinc-300 px-5 text-sm font-semibold text-zinc-600"
                        >
                            เปิด REG
                        </span>
                    )}
                </div>
            </section>
        </div>
    );
}

function EvaluationPanel({ config, state }) {
    const data = getPayloadData(state.payload);
    const questions = Array.isArray(data?.questions) ? data.questions : [];
    const evaluations = Array.isArray(data) ? data : [];
    const rows = questions.length || data?.evaluateId
        ? [
            { label: 'form', value: readString(data?.evaluateId) || '-' },
            { label: 'class', value: readString(data?.classId) || '-' },
            { label: 'officer', value: readString(data?.officerId) || '-' },
            { label: 'questions', value: state.loading ? 'loading' : String(questions.length) },
        ]
        : [
            { label: 'forms', value: state.loading ? 'loading' : String(evaluations.length) },
            ...evaluations.slice(0, 5).map((item, index) => ({
                label: `form ${index + 1}`,
                value: readString(item?.coursenameeng) || readString(item?.coursename) || readString(item?.officername) || readString(item?.evaluateName) || 'แบบประเมิน',
            })),
        ];

    return <GenericModulePanel config={config} state={state} rows={rows} />;
}

function LoanPanel({ config, state }) {
    const data = getPayloadData(state.payload) || {};
    const profile = data.profile || data.studentProfile || {};
    return (
        <GenericModulePanel
            config={config}
            state={state}
            rows={[
                { label: 'status', value: readString(profile.status) || readString(data.status) || readString(data.rollout?.status) || (state.loading ? 'loading' : 'connected') },
                { label: 'round', value: readString(profile.roundName) || readString(data.roundName) || readString(data.rollout?.academicYear) || readString(data.academicYear) || '-' },
                { label: 'notifications', value: Array.isArray(data.notifications) ? String(data.notifications.length) : '-' },
                { label: 'events', value: Array.isArray(data.events) ? String(data.events.length) : '-' },
            ]}
        />
    );
}

function SettingsPanel({ config, state }) {
    const data = getPayloadData(state.payload) || {};
    return (
        <GenericModulePanel
            config={config}
            state={state}
            rows={[
                { label: 'connected', value: data.connected === true ? 'connected' : data.connected === false ? 'not connected' : '-' },
                { label: 'mode', value: readString(data.mode) || readString(data.provider) || '-' },
                { label: 'updated', value: readString(data.updatedAt) || readString(data.resourceUpdatedAt) || '-' },
            ]}
        />
    );
}

function PortfolioPanel({ config, state }) {
    const payload = state.payload || {};
    const ownItems = Array.isArray(payload.data) ? payload.data : [];
    const collaborations = Array.isArray(payload.collaborations) ? payload.collaborations : [];
    return (
        <GenericModulePanel
            config={config}
            state={state}
            rows={[
                { label: 'items', value: state.loading ? 'loading' : String(ownItems.length) },
                { label: 'shared', value: String(collaborations.length) },
                { label: 'pending', value: String(payload.pending_count || 0) },
            ]}
        />
    );
}

function SharePanel({ config, state }) {
    return (
        <GenericModulePanel
            config={config}
            state={state}
            rows={[
                { label: 'access', value: 'guest link ready' },
                { label: 'data', value: 'ใช้เมนูด้านซ้ายเพื่อเลือกข้อมูลที่ได้รับอนุญาต' },
            ]}
        />
    );
}

export function canUseModule(item, isGuest, allowedModules) {
    if (!isGuest) return true;
    if (item.module === 'settings') return false;
    return allowedModules.includes(item.module);
}

export function isModuleAllowed(moduleKey, isGuest, allowedModules) {
    if (!isGuest) return true;
    return allowedModules.includes(moduleKey);
}

export function ModuleContent({ config, moduleId, state }) {
    if (moduleId === 'grade') return null;
    if (moduleId === 'schedule') return <SchedulePanel state={state} />;
    if (moduleId === 'registry') return <RegistryPanel config={config} state={state} />;
    if (moduleId === 'evaluation' || moduleId === 'evaluationForm') return <EvaluationPanel config={config} state={state} />;
    if (moduleId === 'loan') return <LoanPanel config={config} state={state} />;
    if (moduleId === 'classroom') return <SettingsPanel config={config} state={state} />;
    if (moduleId === 'portfolio') return <PortfolioPanel config={config} state={state} />;
    if (moduleId === 'share') return <SharePanel config={config} state={state} />;

    return (
        <GenericModulePanel
            config={config}
            state={state}
            rows={[
                { label: 'status', value: state.loading ? 'loading' : 'connected' },
            ]}
        />
    );
}

export default function PortalModulePageClient({ moduleId }) {
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading, logout: handleLogout } = useAuth();
    const { isGuest, allowedModules, guestName, loading: guestLoading } = useGuest();
    const [mounted, setMounted] = useState(false);
    const [evaluationFormEndpoint, setEvaluationFormEndpoint] = useState(null);
    const config = MODULES[moduleId] || MODULES.grade;

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (moduleId !== 'evaluationForm') {
            setEvaluationFormEndpoint(null);
            return;
        }

        if (typeof window === 'undefined') return;

        const url = new URL(window.location.href);
        const pathParts = url.pathname.split('/').filter(Boolean);
        const evaluateId = pathParts[pathParts.length - 1] || '';
        const query = new URLSearchParams({
            id: readString(decodeURIComponent(evaluateId)) || '',
            classId: url.searchParams.get('classId') || '',
            officerId: url.searchParams.get('officerId') || '',
        });
        setEvaluationFormEndpoint(`/api/student/evaluation/form?${query.toString()}`);
    }, [moduleId]);

    const canAccess = isGuest ? isModuleAllowed(config.module, isGuest, allowedModules) : isAuthenticated;

    useEffect(() => {
        if (!authLoading && !guestLoading && !canAccess) {
            handleLogout();
        }
    }, [canAccess, authLoading, guestLoading, handleLogout]);


    const navItems = useMemo(
        () => PORTAL_NAV_ITEMS
            .filter((item) => canUseModule(item, isGuest, allowedModules))
            .map((item) => ({ ...item })),
        [allowedModules, isGuest],
    );
    const endpointOverride = moduleId === 'evaluationForm' ? evaluationFormEndpoint : undefined;
    const moduleState = usePortalModuleData(moduleId, !isGuest && canAccess && !authLoading && !guestLoading, endpointOverride, handleLogout);
    const gradeTerms = useMemo(() => {
        if (moduleId !== 'grade') return undefined;
        if (moduleState.error) return buildStatusGradeTerms(moduleState.error);
        return buildGradeTerms(moduleState.payload, moduleState.payload?.empty ? 'ไม่พบข้อมูลผลการเรียนจาก REG' : '');
    }, [moduleId, moduleState.error, moduleState.payload]);
    const handleNavigate = useCallback((item) => {
        if (!item?.href) return;
        if (isGuest && typeof window !== 'undefined') {
            const token = new URLSearchParams(window.location.search).get('t');
            if (token) {
                router.push(`${item.href}?t=${encodeURIComponent(token)}`);
                return;
            }
        }
        router.push(item.href);
    }, [isGuest, router]);


    const studentCode = getUserCode(user);
    const gradeRows = moduleId === 'grade' && !moduleState.error ? getGradeRows(moduleState.payload) : null;
    const gradeRecord = moduleId === 'grade' && !moduleState.error ? getAcademicRecord(moduleState.payload) : null;
    const gpax = getDisplayGpaxForStudent(studentCode, gradeRows, gradeRecord);
    const userName = getDisplayName(user, isGuest, guestName);
    const userMeta = buildUserMeta(user, null, gpax, isGuest);


    if (authLoading || guestLoading || (mounted && !canAccess)) {
        return null;
    }

    return (
        <ProductionHeroShell
            activeMenu={config.activeMenu}
            navItems={navItems.length ? navItems : LOGIN_TRANSITION_NAV_ITEMS}
            onLogout={handleLogout}
            gradeTerms={gradeTerms}
            userMeta={userMeta}
            onNavigate={handleNavigate}
            userName={userName}
        >
            <ModuleContent config={config} moduleId={moduleId} state={moduleState} />
        </ProductionHeroShell>
    );
}
