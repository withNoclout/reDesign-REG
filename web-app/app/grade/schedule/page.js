'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LockIcon, AlertTriangleIcon, ClockIcon, CalendarIcon, BookOpenIcon } from '../../components/Icons';
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

export default function SchedulePage() {
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const { isGuest, allowedModules, guestName, loading: guestLoading } = useGuest();
    const [scheduleData, setScheduleData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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

        // Determine active days (sorted Mon→Sun)
        const daySet = new Set(courses.map(c => c.weekday));
        const days = [...daySet].sort((a, b) => a - b);

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
                                                                <p className="text-[10px] text-white/40 mt-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {entry.course.teach_name}
                                                                </p>
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
                                                <tr key={day} className="hover:bg-white/[0.02] transition-colors">
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
                                                                        <span className="truncate">{entry.course.teach_name}</span>
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

                {/* ===== Unscheduled Courses ===== */}
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
