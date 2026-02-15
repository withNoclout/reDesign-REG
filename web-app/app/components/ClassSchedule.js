'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useGuest } from '../context/GuestContext';
import Navbar from './Navbar';
import GuestBanner from './GuestBanner';
import { fadeInUp } from '@/lib/animations';

// --- Timetable Constants ---
const HOUR_START = 8;
const HOUR_END = 19;
const TOTAL_HOURS = HOUR_END - HOUR_START; // 11 rows

// Weekdays Mon-Fri (API: 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri)
const WEEKDAYS = [
    { id: 2, label: 'MON', labelTh: 'จันทร์',     color: 'rgba(250,204,21,0.8)',  colorBg: 'rgba(250,204,21,0.12)',  colorBorder: 'rgba(250,204,21,0.25)' },
    { id: 3, label: 'TUE', labelTh: 'อังคาร',    color: 'rgba(244,114,182,0.8)', colorBg: 'rgba(244,114,182,0.12)', colorBorder: 'rgba(244,114,182,0.25)' },
    { id: 4, label: 'WED', labelTh: 'พุธ',       color: 'rgba(74,222,128,0.8)',  colorBg: 'rgba(74,222,128,0.12)',  colorBorder: 'rgba(74,222,128,0.25)' },
    { id: 5, label: 'THU', labelTh: 'พฤหัสบดี', color: 'rgba(251,146,60,0.8)',  colorBg: 'rgba(251,146,60,0.12)',  colorBorder: 'rgba(251,146,60,0.25)' },
    { id: 6, label: 'FRI', labelTh: 'ศุกร์',      color: 'rgba(96,165,250,0.8)',  colorBg: 'rgba(96,165,250,0.12)',  colorBorder: 'rgba(96,165,250,0.25)' },
];

// Time labels for left axis
const TIME_LABELS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
    const h = HOUR_START + i;
    return `${String(h).padStart(2, '0')}:00`;
});

// --- Reusable fetch handler (DRY) ---
async function fetchScheduleData() {
    const res = await fetch('/api/student/schedule');
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'ไม่สามารถดึงข้อมูลตารางเรียนได้');
    return json;
}

// Parse "HH:MM" to fractional hours from HOUR_START
function timeToOffset(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h - HOUR_START) + (m / 60);
}

export default function ClassSchedule() {
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const { isGuest, allowedModules, guestName, loading: guestLoading } = useGuest();
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [semester, setSemester] = useState('');
    const [hoveredClass, setHoveredClass] = useState(null);

    const canAccess = isGuest ? allowedModules.includes('schedule') : isAuthenticated;

    useEffect(() => {
        if (!authLoading && !guestLoading && !isAuthenticated && !isGuest) {
            router.push('/');
        }
    }, [isAuthenticated, isGuest, authLoading, guestLoading, router]);

    useEffect(() => {
        if (!isAuthenticated && !isGuest) return;
        const load = async () => {
            try {
                setLoading(true);
                const json = await fetchScheduleData();
                setSchedule(json.data || []);
                setSemester(json.semester);
                setError(null);
            } catch (err) {
                setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [isAuthenticated, isGuest]);

    const handleRetry = async () => {
        try {
            setLoading(true);
            setError(null);
            const json = await fetchScheduleData();
            setSchedule(json.data || []);
            setSemester(json.semester);
        } catch (err) {
            setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setLoading(false);
        }
    };

    // Summary stats
    const totalClasses = schedule.length;
    const totalHours = schedule.reduce((sum, cls) => {
        if (!cls.timefrom || !cls.timeto) return sum;
        const [hF, mF] = cls.timefrom.split(':').map(Number);
        const [hT, mT] = cls.timeto.split(':').map(Number);
        return sum + (hT + mT / 60) - (hF + mF / 60);
    }, 0);
    const daysWithClasses = new Set(schedule.map(c => c.weekday)).size;

    // --- Auth loading ---
    if (authLoading || guestLoading) {
        return (
            <main className="main-content">
                <div className="bg-image" aria-hidden="true"></div>
                <div className="bg-overlay" aria-hidden="true"></div>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-white text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                        <p className="mt-4">กำลังโหลด...</p>
                    </div>
                </div>
            </main>
        );
    }

    // --- Access denied ---
    if (!canAccess) {
        return (
            <main className="main-content">
                <div className="bg-image" aria-hidden="true"></div>
                <div className="bg-overlay" aria-hidden="true"></div>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-white text-center">
                        <div className="text-6xl mb-4">🔒</div>
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

            <div className="landing-container pt-32 pb-20 px-4 md:px-8 max-w-7xl mx-auto flex flex-col gap-6">
                {/* ── Header ── */}
                <motion.div
                    variants={fadeInUp}
                    initial="initial"
                    animate="animate"
                    className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full"
                >
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1 font-prompt">ตารางเรียน</h1>
                        <p className="text-white/60 font-light uppercase tracking-wider text-sm">
                            Class Schedule — Semester {semester}
                        </p>
                    </div>

                    {!loading && !error && totalClasses > 0 && (
                        <div className="flex gap-4 p-3 px-5 rounded-2xl bg-[rgba(255,255,255,0.1)] backdrop-blur-md border border-[rgba(255,255,255,0.15)] shadow-lg">
                            <div className="pr-4 border-r border-white/10 text-center">
                                <p className="text-[10px] text-white/60 uppercase tracking-wider mb-0.5">วิชา</p>
                                <p className="text-xl font-bold text-[#ff5722]">{totalClasses}</p>
                            </div>
                            <div className="pr-4 border-r border-white/10 text-center">
                                <p className="text-[10px] text-white/60 uppercase tracking-wider mb-0.5">วัน</p>
                                <p className="text-xl font-bold text-white">{daysWithClasses}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] text-white/60 uppercase tracking-wider mb-0.5">ชม.</p>
                                <p className="text-xl font-bold text-white">{totalHours > 0 ? totalHours.toFixed(0) : '—'}</p>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* ── Loading ── */}
                {loading && (
                    <div className="text-center text-white/70 py-16" role="status" aria-live="polite">
                        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-white/10 border-t-[#ff5722] mb-4"></div>
                        <p>กำลังโหลดตารางเรียน...</p>
                    </div>
                )}

                {/* ── Error ── */}
                {!loading && error && (
                    <div className="bg-orange-500/20 text-orange-200 p-4 rounded-xl border border-orange-500/30" role="alert">
                        ⚠️ {error}
                        <button onClick={handleRetry} className="mt-3 block px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors min-h-[44px]">
                            ลองใหม่
                        </button>
                    </div>
                )}

                {/* ── Empty ── */}
                {!loading && !error && totalClasses === 0 && (
                    <div className="text-center py-16">
                        <div className="bg-[rgba(255,255,255,0.05)] rounded-3xl p-8 max-w-md mx-auto border border-[rgba(255,255,255,0.1)]">
                            <div className="text-5xl mb-4">📭</div>
                            <h3 className="text-xl font-bold text-white mb-2">ไม่พบตารางเรียน</h3>
                            <p className="text-white/50 text-sm mb-6">ยังไม่พบข้อมูลตารางเรียนในเทอมนี้</p>
                            <button onClick={handleRetry} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm min-h-[44px]">
                                🔄 ลองใหม่
                            </button>
                        </div>
                    </div>
                )}

                {/* ══════════════ TIMETABLE GRID ══════════════ */}
                {!loading && !error && totalClasses > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="bg-[rgba(255,255,255,0.06)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-3xl overflow-hidden shadow-2xl"
                    >
                        <div className="overflow-x-auto">
                            <div className="min-w-[700px]">
                                {/* ── Day Header Row ── */}
                                <div className="grid grid-cols-[60px_repeat(5,1fr)] border-b border-white/5">
                                    <div className="p-3 bg-[rgba(255,255,255,0.03)]" />
                                    {WEEKDAYS.map((day) => (
                                        <div key={day.id} className="p-3 text-center border-l border-white/5 bg-[rgba(255,255,255,0.03)]">
                                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: day.color }}>
                                                {day.label}
                                            </p>
                                            <p className="text-[10px] text-white/40 mt-0.5">{day.labelTh}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Grid Body: Time axis + Day columns ── */}
                                <div className="grid grid-cols-[60px_repeat(5,1fr)]">
                                    {/* Time labels column */}
                                    <div className="flex flex-col">
                                        {TIME_LABELS.slice(0, TOTAL_HOURS).map((label) => (
                                            <div key={label} className="h-[60px] relative border-b border-white/[0.03]">
                                                <span className="absolute -top-[8px] right-2 text-[10px] font-mono text-white/30 select-none">
                                                    {label}
                                                </span>
                                            </div>
                                        ))}
                                        {/* Last label (19:00) */}
                                        <div className="h-0 relative">
                                            <span className="absolute -top-[8px] right-2 text-[10px] font-mono text-white/30 select-none">
                                                {TIME_LABELS[TOTAL_HOURS]}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Day columns — each is relative for absolute class positioning */}
                                    {WEEKDAYS.map((day, di) => {
                                        const dayClasses = schedule.filter(c => c.weekday === day.id);
                                        return (
                                            <div key={day.id} className="relative border-l border-white/[0.03]">
                                                {/* Hour grid lines */}
                                                {TIME_LABELS.slice(0, TOTAL_HOURS).map((label) => (
                                                    <div key={`${day.id}-${label}`} className="h-[60px] border-b border-white/[0.03]" />
                                                ))}

                                                {/* Class blocks */}
                                                {dayClasses.map((cls, ci) => {
                                                    const topOffset = timeToOffset(cls.timefrom);
                                                    const duration = timeToOffset(cls.timeto) - topOffset;
                                                    if (duration <= 0) return null;

                                                    const topPx = topOffset * 60;
                                                    const heightPx = duration * 60;
                                                    const globalIdx = schedule.indexOf(cls);
                                                    const isHovered = hoveredClass === globalIdx;

                                                    return (
                                                        <motion.div
                                                            key={`block-${day.id}-${ci}`}
                                                            initial={{ opacity: 0, scale: 0.92 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            transition={{ duration: 0.3, delay: 0.15 + ci * 0.05 }}
                                                            className="absolute left-[3px] right-[3px] rounded-xl overflow-hidden cursor-pointer transition-all duration-200"
                                                            style={{
                                                                top: `${topPx + 2}px`,
                                                                height: `${heightPx - 4}px`,
                                                                background: `linear-gradient(135deg, ${day.colorBg}, rgba(255,255,255,0.03))`,
                                                                border: `1px solid ${day.colorBorder}`,
                                                                borderLeftWidth: '3px',
                                                                borderLeftColor: day.color,
                                                                zIndex: isHovered ? 20 : 10,
                                                                boxShadow: isHovered ? '0 8px 32px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.15)',
                                                            }}
                                                            onMouseEnter={() => setHoveredClass(globalIdx)}
                                                            onMouseLeave={() => setHoveredClass(null)}
                                                            role="button"
                                                            tabIndex={0}
                                                            aria-label={`${cls.subject_id}, ${cls.timefrom}-${cls.timeto}, ห้อง ${cls.roomcode || 'TBA'}`}
                                                        >
                                                            <div className="p-2 h-full flex flex-col justify-between overflow-hidden">
                                                                <div>
                                                                    <p className="text-[11px] font-bold text-white truncate leading-tight">
                                                                        {cls.subject_name_en || cls.subject_name_th || cls.subject_id}
                                                                    </p>
                                                                    <p className="text-[9px] font-mono text-white/50 mt-0.5 truncate">
                                                                        {cls.subject_id}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-mono font-semibold truncate" style={{ color: day.color }}>
                                                                        🏫 {cls.roomcode || 'TBA'}
                                                                    </p>
                                                                    {heightPx >= 100 && (
                                                                        <p className="text-[9px] font-mono text-white/40 mt-0.5">
                                                                            {cls.timefrom}–{cls.timeto}
                                                                        </p>
                                                                    )}
                                                                    {heightPx >= 120 && cls.section && (
                                                                        <p className="text-[9px] text-white/30 mt-0.5">Sec {cls.section}</p>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Hover tooltip overlay */}
                                                            {isHovered && (
                                                                <div className="absolute inset-0 bg-black/75 backdrop-blur-sm rounded-xl p-3 flex flex-col justify-center gap-1.5 z-30">
                                                                    <p className="text-xs font-bold text-white leading-tight">
                                                                        {cls.subject_name_en || cls.subject_name_th || `Course ${cls.subject_id}`}
                                                                    </p>
                                                                    <p className="text-[10px] font-mono text-white/60">{cls.subject_id}</p>
                                                                    <span className="text-[10px] font-mono inline-block px-1.5 py-0.5 rounded bg-white/10 text-white/80 w-fit">
                                                                        ⏰ {cls.timefrom}–{cls.timeto}
                                                                    </span>
                                                                    <p className="text-[10px] text-white/60">
                                                                        🏫 ห้อง {cls.roomcode || 'TBA'}{cls.section ? ` • Sec ${cls.section}` : ''}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </main>
    );
}

