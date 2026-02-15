'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LockIcon, AlertTriangleIcon, ClockIcon, CalendarIcon, BookOpenIcon, ArrowUpIcon, ArrowDownIcon, UserIcon } from '../../components/Icons';
import { useAuth } from '../../context/AuthContext';
import { useGuest } from '../../context/GuestContext';
import Navbar from '../../components/Navbar';
import GuestBanner from '../../components/GuestBanner';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';
import '../../globals.css';

const COURSE_COLORS = [
    { bg: 'rgba(255, 87, 34, 0.18)', border: 'rgba(255, 87, 34, 0.4)', text: '#ff8a65' },
    { bg: 'rgba(33, 150, 243, 0.18)', border: 'rgba(33, 150, 243, 0.4)', text: '#64b5f6' },
    { bg: 'rgba(76, 175, 80, 0.18)', border: 'rgba(76, 175, 80, 0.4)', text: '#81c784' },
    { bg: 'rgba(156, 39, 176, 0.18)', border: 'rgba(156, 39, 176, 0.4)', text: '#ce93d8' },
    { bg: 'rgba(255, 152, 0, 0.18)', border: 'rgba(255, 152, 0, 0.4)', text: '#ffb74d' },
    { bg: 'rgba(0, 188, 212, 0.18)', border: 'rgba(0, 188, 212, 0.4)', text: '#4dd0e1' },
    { bg: 'rgba(233, 30, 99, 0.18)', border: 'rgba(233, 30, 99, 0.4)', text: '#f06292' },
    { bg: 'rgba(139, 195, 74, 0.18)', border: 'rgba(139, 195, 74, 0.4)', text: '#aed581' },
];

const DAY_NAMES = {
    1: { th: 'อาทิตย์', en: 'SUN', short: 'อา' },
    2: { th: 'จันทร์', en: 'MON', short: 'จ' },
    3: { th: 'อังคาร', en: 'TUE', short: 'อ' },
    4: { th: 'พุธ', en: 'WED', short: 'พ' },
    5: { th: 'พฤหัสบดี', en: 'THU', short: 'พฤ' },
    6: { th: 'ศุกร์', en: 'FRI', short: 'ศ' },
    7: { th: 'เสาร์', en: 'SAT', short: 'ส' },
};

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
}

function getColSpan(from, to, slotMinutes) {
    const duration = timeToMinutes(to) - timeToMinutes(from);
    return Math.max(1, Math.round(duration / slotMinutes));
}

const THAI_MONTHS = {
    'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03', 'เมษายน': '04',
    'พฤษภาคม': '05', 'มิถุนายน': '06', 'กรกฎาคม': '07', 'สิงหาคม': '08',
    'กันยายน': '09', 'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12',
    'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04',
    'พ.ค.': '05', 'มิ.ย.': '06', 'ก.ค.': '07', 'ส.ค.': '08',
    'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12',
};

function formatExamDate(dateStr) {
    if (!dateStr) return null;
    const s = dateStr.trim();

    // Extract time (HH:MM) if present — match patterns like "13:00-16:00" or "เวลา 13:00"
    const timeMatch = s.match(/(\d{1,2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : '';

    // Extract day number
    const dayMatch = s.match(/(\d{1,2})\s/);
    if (!dayMatch) return s;
    const day = dayMatch[1].padStart(2, '0');

    // Extract Thai month name → month number
    let month = '';
    for (const [name, num] of Object.entries(THAI_MONTHS)) {
        if (s.includes(name)) { month = num; break; }
    }
    if (!month) return s;

    return time ? `${day}/${month} ${time}` : `${day}/${month}`;
}

const TITLE_ABBREVIATIONS = [
    ['รองศาสตราจารย์', 'รศ.'],
    ['ผู้ช่วยศาสตราจารย์', 'ผศ.'],
    ['ศาสตราจารย์', 'ศ.'],
    ['อาจารย์', 'อ.'],
    ['ดร.', 'ดร.'],
];

function shortenTitle(name) {
    if (!name) return name;
    let s = name;
    for (const [full, abbr] of TITLE_ABBREVIATIONS) {
        s = s.replaceAll(full, abbr);
    }
    return s;
}

function splitInstructors(name) {
    if (!name) return [];
    const shortened = shortenTitle(name);
    // Split before each title prefix (รศ., ผศ., ศ., อ., ดร.)
    const parts = shortened.split(/(?=(?:รศ\.|ผศ\.|ศ\.|อ\.|ดร\.))/g)
        .map(s => s.trim())
        .filter(Boolean);
    return parts.length ? parts : [shortened];
}

export default function SchedulePage() {
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const { isGuest, allowedModules, guestName, loading: guestLoading } = useGuest();
    const [scheduleData, setScheduleData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortField, setSortField] = useState('subject_id');
    const [sortDirection, setSortDirection] = useState('asc');

    const canAccess = isGuest ? allowedModules.includes('grade') : isAuthenticated;

    useEffect(() => {
        if (!authLoading && !guestLoading && !isAuthenticated && !isGuest) {
            router.push('/');
        }
    }, [isAuthenticated, isGuest, authLoading, guestLoading, router]);

    useEffect(() => {
        const fetchSchedule = async () => {
            if (!isAuthenticated && !isGuest) return;

            try {
                setLoading(true);
                const response = await fetch('/api/student/schedule');
                const result = await response.json();

                if (result.success) {
                    setScheduleData(result);
                    setError(null);
                } else {
                    setError(result.error || 'ไม่สามารถดึงข้อมูลตารางเรียนได้');
                }
            } catch (err) {
                console.error('Schedule fetch error:', err);
                setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่');
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [isAuthenticated, isGuest]);

    // Build timetable grid data
    const { colorMap, activeDays, timeSlots, gridData, slotMinutes } = useMemo(() => {
        if (!scheduleData?.scheduled?.length) {
            return { colorMap: {}, activeDays: [], timeSlots: [], gridData: {}, slotMinutes: 60 };
        }

        const courses = scheduleData.scheduled;

        // Assign colors per subject
        const subjects = [...new Set(courses.map(c => c.subject_id))];
        const cMap = {};
        subjects.forEach((sid, i) => {
            cMap[sid] = COURSE_COLORS[i % COURSE_COLORS.length];
        });

        // Always show Mon-Fri (2-6), plus Sat/Sun if they have courses
        const WEEKDAYS = [2, 3, 4, 5, 6];
        const extraDays = courses.map(c => c.weekday).filter(d => !WEEKDAYS.includes(d));
        const days = [...new Set([...WEEKDAYS, ...extraDays])].sort((a, b) => a - b);

        // Determine time range
        let minTime = 24 * 60, maxTime = 0;
        courses.forEach(c => {
            const from = timeToMinutes(c.timefrom);
            const to = timeToMinutes(c.timeto);
            if (from < minTime) minTime = from;
            if (to > maxTime) maxTime = to;
        });

        // Round to nearest hour
        const startHour = Math.floor(minTime / 60);
        const endHour = Math.ceil(maxTime / 60);
        const slot = 60;

        const slots = [];
        for (let h = startHour; h < endHour; h++) {
            slots.push(`${String(h).padStart(2, '0')}:00`);
        }

        // Build grid: { [weekday]: [ { course, colStart, colSpan } ] }
        const gData = {};
        days.forEach(day => {
            const dayCourses = courses.filter(c => c.weekday === day);
            gData[day] = dayCourses.map(c => {
                const fromMin = timeToMinutes(c.timefrom);
                const colStart = Math.floor((fromMin - startHour * 60) / slot);
                const span = getColSpan(c.timefrom, c.timeto, slot);
                return { course: c, colStart, colSpan: span };
            });
        });

        return { colorMap: cMap, activeDays: days, timeSlots: slots, gridData: gData, slotMinutes: slot };
    }, [scheduleData]);

    // Stats
    const totalCredits = useMemo(() => {
        if (!scheduleData?.data) return 0;
        return scheduleData.data.reduce((sum, c) => sum + (c.credit || 0), 0);
    }, [scheduleData]);

    const uniqueDays = activeDays.length;
    const totalSubjects = scheduleData?.stats?.total || 0;

    // Sort handler
    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Sorted course list for table view
    const sortedCourses = useMemo(() => {
        if (!scheduleData?.scheduled?.length) return [];
        const courses = [...scheduleData.scheduled];
        courses.sort((a, b) => {
            let valA, valB;
            switch (sortField) {
                case 'subject_id':
                    valA = a.subject_id || ''; valB = b.subject_id || '';
                    break;
                case 'subject_name':
                    valA = a.subject_name_th || a.subject_name_en || '';
                    valB = b.subject_name_th || b.subject_name_en || '';
                    break;
                case 'teach_name':
                    valA = a.teach_name || ''; valB = b.teach_name || '';
                    break;
                case 'section':
                    valA = a.section || ''; valB = b.section || '';
                    break;
                case 'weekday':
                    valA = a.weekday || 0; valB = b.weekday || 0;
                    if (valA !== valB) return sortDirection === 'asc' ? valA - valB : valB - valA;
                    valA = a.timefrom || ''; valB = b.timefrom || '';
                    break;
                case 'exam_midterm':
                    valA = a.exam_midterm || ''; valB = b.exam_midterm || '';
                    break;
                case 'exam_final':
                    valA = a.exam_final || ''; valB = b.exam_final || '';
                    break;
                default:
                    valA = a.subject_id || ''; valB = b.subject_id || '';
            }
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        return courses;
    }, [scheduleData, sortField, sortDirection]);

    // Sort indicator component
    const SortHeader = ({ field, children, className = '' }) => (
        <th
            className={`p-3 text-xs text-white/50 uppercase tracking-wider font-light text-left border-b border-[rgba(255,255,255,0.06)] cursor-pointer select-none hover:text-white/80 transition-colors ${className}`}
            onClick={() => handleSort(field)}
        >
            <span className="inline-flex items-center gap-1">
                {children}
                {sortField === field && (
                    sortDirection === 'asc'
                        ? <ArrowUpIcon size={12} className="text-[#ff5722]" />
                        : <ArrowDownIcon size={12} className="text-[#ff5722]" />
                )}
            </span>
        </th>
    );

    // --- Render ---

    if (authLoading || guestLoading) {
        return (
            <main className="main-content">
                <div className="bg-image"></div>
                <div className="bg-overlay"></div>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-white text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                        <p className="mt-4">กำลังโหลด...</p>
                    </div>
                </div>
            </main>
        );
    }

    if (!canAccess) {
        return (
            <main className="main-content">
                <div className="bg-image"></div>
                <div className="bg-overlay"></div>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-white text-center">
                        <div className="text-6xl mb-4"><LockIcon size={64} /></div>
                        <h1 className="text-2xl font-bold mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
                        <p className="text-white/60">คุณไม่ได้รับอนุญาตให้ดูหน้านี้</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="main-content" id="main-content">
            <div className="bg-image" aria-hidden="true"></div>
            <div className="bg-overlay" aria-hidden="true"></div>

            <Navbar activePage="grade" />

            {isGuest && <GuestBanner guestName={guestName} />}

            <div className="landing-container pt-32 pb-20 px-4 md:px-8 max-w-7xl mx-auto flex flex-col gap-8">
                {/* Header */}
                <motion.div
                    variants={fadeInUp}
                    initial="initial"
                    animate="animate"
                    className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full"
                >
                    <div>
                        <p className="text-xs text-[#ff5722] uppercase tracking-wider font-light mb-1 font-montserrat">TIMETABLE</p>
                        <h1 className="text-3xl font-bold text-white mb-1 font-prompt">ตารางเรียน</h1>
                        {scheduleData?.semester && (
                            <p className="text-white/50 text-sm font-light">
                                ภาคการศึกษา {scheduleData.semester}
                            </p>
                        )}
                    </div>

                    {/* Summary Stats */}
                    {!loading && !error && scheduleData && (
                        <div className="flex gap-4 p-4 rounded-2xl bg-[rgba(255,255,255,0.1)] backdrop-blur-md border border-[rgba(255,255,255,0.15)] shadow-lg">
                            <div className="pr-4 border-r border-white/10 text-center">
                                <p className="text-xs text-white/70 uppercase tracking-wider mb-1">วิชา</p>
                                <p className="text-2xl font-bold text-white font-montserrat">{totalSubjects}</p>
                            </div>
                            <div className="pr-4 border-r border-white/10 text-center">
                                <p className="text-xs text-white/70 uppercase tracking-wider mb-1">หน่วยกิต</p>
                                <p className="text-2xl font-bold text-[#4ade80] font-montserrat">{totalCredits}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-white/70 uppercase tracking-wider mb-1">วันเรียน</p>
                                <p className="text-2xl font-bold text-white font-montserrat">{uniqueDays}</p>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Loading */}
                {loading && (
                    <div className="text-center text-white/70 py-10" role="status" aria-live="polite">
                        <div className="space-y-4">
                            {/* Skeleton timetable */}
                            <div className="bg-[rgba(255,255,255,0.05)] rounded-3xl p-6 space-y-3">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="flex gap-3 items-center">
                                        <div className="w-16 h-8 bg-white/10 rounded-lg animate-pulse"></div>
                                        <div className="flex-1 flex gap-2">
                                            {[...Array(3 + Math.floor(Math.random() * 3))].map((_, j) => (
                                                <div key={j} className="h-8 bg-white/10 rounded-lg animate-pulse" style={{ width: `${60 + Math.random() * 100}px` }}></div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p><ClockIcon size={16} className="inline mr-1" /> กำลังโหลดตารางเรียน...</p>
                        </div>
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <div className="bg-orange-500/20 text-orange-200 p-4 rounded-xl border border-orange-500/30" role="alert" aria-live="assertive">
                        <AlertTriangleIcon size={16} className="inline mr-1" /> {error}
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-3 block px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                        >
                            ลองใหม่
                        </button>
                    </div>
                )}

                {/* Empty */}
                {!loading && !error && (!scheduleData?.scheduled?.length && !scheduleData?.unscheduled?.length) && (
                    <div className="text-center py-20">
                        <CalendarIcon size={48} className="mx-auto text-white/30 mb-4" />
                        <div className="text-white/70 text-lg mb-2">ไม่พบข้อมูลตารางเรียน</div>
                        <div className="text-white/50 text-sm">อาจยังไม่ได้ลงทะเบียนเรียนในภาคการศึกษานี้</div>
                    </div>
                )}

                {/* ===== Desktop Timetable Grid ===== */}
                {!loading && !error && activeDays.length > 0 && (
                    <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                    >
                        {/* Desktop: full grid */}
                        <motion.div
                            variants={staggerItem}
                            className="hidden md:block bg-[rgba(255,255,255,0.06)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-3xl overflow-hidden shadow-2xl"
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse" style={{ minWidth: `${timeSlots.length * 120 + 100}px` }}>
                                    {/* Time header */}
                                    <thead>
                                        <tr>
                                            <th className="sticky left-0 z-10 bg-[rgba(20,20,30,0.95)] backdrop-blur-xl p-3 text-xs text-white/50 uppercase tracking-wider font-light text-center border-b border-r border-[rgba(255,255,255,0.06)]" style={{ minWidth: '100px' }}>
                                                วัน
                                            </th>
                                            {timeSlots.map((slot) => (
                                                <th
                                                    key={slot}
                                                    className="p-3 text-xs text-white/50 uppercase tracking-wider font-light text-center border-b border-r border-[rgba(255,255,255,0.06)] font-montserrat"
                                                    style={{ minWidth: '120px' }}
                                                >
                                                    {slot}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeDays.map((day) => {
                                            const dayInfo = DAY_NAMES[day];
                                            const entries = gridData[day] || [];
                                            // Build cells: fill with course blocks and empty cells
                                            const cells = [];
                                            const occupied = new Set();

                                            entries.forEach(entry => {
                                                for (let c = entry.colStart; c < entry.colStart + entry.colSpan; c++) {
                                                    occupied.add(c);
                                                }
                                            });

                                            let col = 0;
                                            while (col < timeSlots.length) {
                                                const entry = entries.find(e => e.colStart === col);
                                                if (entry) {
                                                    const color = colorMap[entry.course.subject_id];
                                                    cells.push(
                                                        <td
                                                            key={col}
                                                            colSpan={entry.colSpan}
                                                            className="p-1.5 border-r border-b border-[rgba(255,255,255,0.06)] align-top"
                                                        >
                                                            <div
                                                                className="rounded-xl p-3 h-full cursor-default transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group"
                                                                style={{
                                                                    backgroundColor: color.bg,
                                                                    borderLeft: `3px solid ${color.border}`,
                                                                }}
                                                            >
                                                                <p className="text-xs font-bold font-montserrat truncate" style={{ color: color.text }}>
                                                                    {entry.course.subject_id}
                                                                </p>
                                                                <p className="text-xs text-white/90 font-prompt mt-0.5 line-clamp-2 leading-tight">
                                                                    {entry.course.subject_name_th || entry.course.subject_name_en}
                                                                </p>
                                                                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/50">
                                                                    <span>Sec {entry.course.section}</span>
                                                                    <span>·</span>
                                                                    <span>{entry.course.roomcode}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    );
                                                    col += entry.colSpan;
                                                } else {
                                                    cells.push(
                                                        <td key={col} className="p-1.5 border-r border-b border-[rgba(255,255,255,0.06)]"></td>
                                                    );
                                                    col++;
                                                }
                                            }

                                            return (
                                                <tr key={day} className="hover:bg-white/[0.02] transition-colors" style={{ height: '85px' }}>
                                                    <td className="sticky left-0 z-10 bg-[rgba(20,20,30,0.95)] backdrop-blur-xl p-3 border-r border-b border-[rgba(255,255,255,0.06)]">
                                                        <div className="text-center">
                                                            <p className="text-xs text-white/50 font-montserrat uppercase tracking-wider">{dayInfo.en}</p>
                                                            <p className="text-sm font-semibold text-white font-prompt">{dayInfo.th}</p>
                                                        </div>
                                                    </td>
                                                    {cells}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>

                        {/* ===== Mobile: Card-based daily view ===== */}
                        <div className="md:hidden space-y-4">
                            {activeDays.map((day) => {
                                const dayInfo = DAY_NAMES[day];
                                const entries = gridData[day] || [];

                                return (
                                    <motion.div
                                        key={day}
                                        variants={staggerItem}
                                        className="bg-[rgba(255,255,255,0.06)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-2xl overflow-hidden"
                                    >
                                        {/* Day header */}
                                        <div className="flex items-center gap-3 p-4 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]">
                                            <div className="h-10 w-10 rounded-full bg-[rgba(255,87,34,0.15)] flex items-center justify-center text-[#ff5722] font-bold text-sm border border-[rgba(255,87,34,0.3)] font-prompt">
                                                {dayInfo.short}
                                            </div>
                                            <div>
                                                <p className="text-white font-semibold font-prompt">{dayInfo.th}</p>
                                                <p className="text-white/50 text-xs font-montserrat uppercase tracking-wider">{dayInfo.en}</p>
                                            </div>
                                            <span className="ml-auto text-xs text-white/40">{entries.length} วิชา</span>
                                        </div>

                                        {/* Courses */}
                                        <div className="p-3 space-y-2">
                                            {entries
                                                .sort((a, b) => timeToMinutes(a.course.timefrom) - timeToMinutes(b.course.timefrom))
                                                .map((entry, idx) => {
                                                    const color = colorMap[entry.course.subject_id];
                                                    return (
                                                        <div
                                                            key={idx}
                                                            className="rounded-xl p-3 transition-all duration-200"
                                                            style={{
                                                                backgroundColor: color.bg,
                                                                borderLeft: `3px solid ${color.border}`,
                                                            }}
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-bold font-montserrat" style={{ color: color.text }}>
                                                                        {entry.course.subject_id}
                                                                    </p>
                                                                    <p className="text-sm text-white/90 font-prompt mt-0.5 truncate">
                                                                        {entry.course.subject_name_th || entry.course.subject_name_en}
                                                                    </p>
                                                                </div>
                                                                <span className="text-xs text-white/60 font-montserrat whitespace-nowrap ml-2">
                                                                    {entry.course.timefrom}–{entry.course.timeto}
                                                                </span>
                                                            </div>
                                                            <div className="mt-2 flex items-center gap-3 text-xs text-white/50">
                                                                <span>Sec {entry.course.section}</span>
                                                                <span>·</span>
                                                                <span>{entry.course.roomcode}</span>
                                                                {entry.course.teach_name && (
                                                                    <>
                                                                        <span>·</span>
                                                                        <span className="truncate">{splitInstructors(entry.course.teach_name).join(', ')}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* ===== Course Detail Table (always visible below grid) ===== */}
                {!loading && !error && sortedCourses.length > 0 && (
                    <motion.div
                        variants={fadeInUp}
                        initial="initial"
                        animate="animate"
                    >
                        {/* Desktop Table */}
                        <div className="hidden md:block bg-[rgba(255,255,255,0.06)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-3xl overflow-hidden shadow-2xl">
                            <div className="p-5 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-3">
                                <BookOpenIcon size={18} className="text-white/50" />
                                <div>
                                    <h2 className="text-sm font-semibold text-white uppercase tracking-wider">รายละเอียดรายวิชา</h2>
                                    <p className="text-xs text-white/40 mt-0.5">Course details & instructor info</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse" style={{ minWidth: `${timeSlots.length * 120 + 100}px` }}>
                                    <thead>
                                        <tr className="bg-[rgba(20,20,30,0.95)]">
                                            <SortHeader field="subject_id" className="font-montserrat">รหัสวิชา</SortHeader>
                                            <SortHeader field="subject_name">ชื่อวิชา</SortHeader>
                                            <SortHeader field="teach_name">อาจารย์ผู้สอน</SortHeader>
                                            <SortHeader field="section" className="font-montserrat text-center">Sec</SortHeader>
                                            <SortHeader field="weekday">วัน/เวลา</SortHeader>
                                            <SortHeader field="exam_midterm">สอบกลางภาค</SortHeader>
                                            <SortHeader field="exam_final">สอบปลายภาค</SortHeader>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedCourses.map((course, idx) => {
                                            const color = colorMap[course.subject_id];
                                            const dayInfo = DAY_NAMES[course.weekday];
                                            return (
                                                <tr key={idx} className="hover:bg-white/[0.03] transition-colors border-b border-[rgba(255,255,255,0.05)]">
                                                    <td className="p-3 font-montserrat text-sm font-bold whitespace-nowrap" style={{ color: color?.text }}>
                                                        {course.subject_id}
                                                    </td>
                                                    <td className="p-3 text-sm text-white/90 font-prompt max-w-[220px]">
                                                        {course.subject_name_th || course.subject_name_en}
                                                    </td>
                                                    <td className="p-3 text-sm text-white/70 font-prompt max-w-[200px]">
                                                        {course.teach_name ? (
                                                            <div className="space-y-0.5">
                                                                {splitInstructors(course.teach_name).map((inst, i) => (
                                                                    <p key={i} className="whitespace-nowrap">{inst}</p>
                                                                ))}
                                                            </div>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="p-3 text-sm text-white/60 font-montserrat text-center">
                                                        {course.section}
                                                    </td>
                                                    <td className="p-3 text-sm text-white/70 whitespace-nowrap">
                                                        <span className="font-prompt">{dayInfo?.short || '—'}</span>
                                                        <span className="text-white/40 mx-1">·</span>
                                                        <span className="font-montserrat text-xs">{course.timefrom}–{course.timeto}</span>
                                                    </td>
                                                    <td className="p-3 text-sm text-white/60 font-montserrat whitespace-nowrap">
                                                        {formatExamDate(course.exam_midterm) || '—'}
                                                    </td>
                                                    <td className="p-3 text-sm text-white/60 font-montserrat whitespace-nowrap">
                                                        {formatExamDate(course.exam_final) || '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                            <div className="flex items-center gap-3 mb-1">
                                <BookOpenIcon size={18} className="text-white/50" />
                                <div>
                                    <h2 className="text-sm font-semibold text-white uppercase tracking-wider">รายละเอียดรายวิชา</h2>
                                    <p className="text-xs text-white/40 mt-0.5">Course details & instructor info</p>
                                </div>
                            </div>
                            {sortedCourses.map((course, idx) => {
                                const color = colorMap[course.subject_id];
                                const dayInfo = DAY_NAMES[course.weekday];
                                return (
                                    <div
                                        key={idx}
                                        className="bg-[rgba(255,255,255,0.06)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-2xl p-4"
                                        style={{ borderLeft: `3px solid ${color?.border}` }}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold font-montserrat" style={{ color: color?.text }}>
                                                    {course.subject_id}
                                                </p>
                                                <p className="text-sm text-white/90 font-prompt mt-0.5">
                                                    {course.subject_name_th || course.subject_name_en}
                                                </p>
                                            </div>
                                            <span className="text-xs text-white/50 font-montserrat ml-2 shrink-0">
                                                Sec {course.section}
                                            </span>
                                        </div>
                                        {course.teach_name && (
                                            <div className="text-xs text-white/60 font-prompt mb-2 space-y-0.5">
                                                {splitInstructors(course.teach_name).map((inst, i) => (
                                                    <p key={i} className="flex items-center gap-1">
                                                        <UserIcon size={12} className="shrink-0" /> {inst}
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
                                            <span>
                                                <span className="font-prompt">{dayInfo?.short || '—'}</span>
                                                <span className="mx-1">·</span>
                                                <span className="font-montserrat">{course.timefrom}–{course.timeto}</span>
                                            </span>
                                            {course.exam_midterm && (
                                                <span>กลางภาค: <span className="font-montserrat">{formatExamDate(course.exam_midterm)}</span></span>
                                            )}
                                            {course.exam_final && (
                                                <span>ปลายภาค: <span className="font-montserrat">{formatExamDate(course.exam_final)}</span></span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
                {!loading && !error && scheduleData?.unscheduled?.length > 0 && (
                    <motion.div
                        variants={fadeInUp}
                        initial="initial"
                        animate="animate"
                        className="bg-[rgba(255,255,255,0.06)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-3xl overflow-hidden shadow-2xl"
                    >
                        <div className="p-5 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-3">
                            <BookOpenIcon size={18} className="text-white/50" />
                            <div>
                                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">วิชาที่ยังไม่มีตารางเรียน</h2>
                                <p className="text-xs text-white/40 mt-0.5">Courses without schedule</p>
                            </div>
                        </div>
                        <div className="divide-y divide-[rgba(255,255,255,0.05)]">
                            {scheduleData.unscheduled.map((course, idx) => (
                                <div key={idx} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.03] transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-xs text-white/50 font-montserrat w-24 shrink-0">{course.subject_id}</span>
                                        <span className="text-sm text-white/80 font-prompt truncate">
                                            {course.subject_name_th || course.subject_name_en}
                                        </span>
                                    </div>
                                    <span className="text-xs text-white/40 font-montserrat ml-3 shrink-0">
                                        {course.credit ? `${course.credit} cr.` : '—'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>
        </main>
    );
}
