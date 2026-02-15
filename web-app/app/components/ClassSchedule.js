'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useGuest } from '../context/GuestContext';
import Navbar from './Navbar';
import GuestBanner from './GuestBanner';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';

// --- Day Themes (1=Sunday per REG API weekday mapping) ---
const DAY_THEMES = {
    1: { key: 'sunday',    label: 'Sunday',    labelTh: 'อาทิตย์',   accent: 'text-red-400',    accentBg: 'rgba(248,113,113,0.15)', accentBorder: 'rgba(248,113,113,0.3)', icon: '🔴' },
    2: { key: 'monday',    label: 'Monday',    labelTh: 'จันทร์',     accent: 'text-yellow-400', accentBg: 'rgba(250,204,21,0.15)',  accentBorder: 'rgba(250,204,21,0.3)',  icon: '🟡' },
    3: { key: 'tuesday',   label: 'Tuesday',   labelTh: 'อังคาร',    accent: 'text-pink-400',   accentBg: 'rgba(244,114,182,0.15)', accentBorder: 'rgba(244,114,182,0.3)', icon: '🩷' },
    4: { key: 'wednesday', label: 'Wednesday', labelTh: 'พุธ',       accent: 'text-green-400',  accentBg: 'rgba(74,222,128,0.15)',  accentBorder: 'rgba(74,222,128,0.3)',  icon: '🟢' },
    5: { key: 'thursday',  label: 'Thursday',  labelTh: 'พฤหัสบดี', accent: 'text-orange-400', accentBg: 'rgba(251,146,60,0.15)',  accentBorder: 'rgba(251,146,60,0.3)',  icon: '🟠' },
    6: { key: 'friday',    label: 'Friday',    labelTh: 'ศุกร์',      accent: 'text-blue-400',   accentBg: 'rgba(96,165,250,0.15)',  accentBorder: 'rgba(96,165,250,0.3)',  icon: '🔵' },
    7: { key: 'saturday',  label: 'Saturday',  labelTh: 'เสาร์',     accent: 'text-purple-400', accentBg: 'rgba(192,132,252,0.15)', accentBorder: 'rgba(192,132,252,0.3)', icon: '🟣' },
};

// --- Reusable fetch handler (DRY) ---
async function fetchScheduleData() {
    const res = await fetch('/api/student/schedule');
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'ไม่สามารถดึงข้อมูลตารางเรียนได้');
    return json;
}

export default function ClassSchedule() {
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const { isGuest, allowedModules, guestName, loading: guestLoading } = useGuest();
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [semester, setSemester] = useState('');

    const canAccess = isGuest ? allowedModules.includes('schedule') : isAuthenticated;

    // Redirect if not authenticated and not a guest
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

    // --- Group classes by weekday ---
    const groupedSchedule = Object.keys(DAY_THEMES).map(id => {
        const dayId = parseInt(id);
        const theme = DAY_THEMES[dayId];
        const classes = schedule
            .filter(item => item.weekday === dayId)
            .sort((a, b) => (a.timefrom || '').localeCompare(b.timefrom || ''));
        return { dayId, ...theme, classes };
    }).filter(day => day.classes.length > 0);

    // --- Summary stats ---
    const totalClasses = schedule.length;
    const totalDays = groupedSchedule.length;
    const totalHours = schedule.reduce((sum, cls) => {
        if (!cls.timefrom || !cls.timeto) return sum;
        const [hFrom, mFrom] = cls.timefrom.split(':').map(Number);
        const [hTo, mTo] = cls.timeto.split(':').map(Number);
        return sum + (hTo + mTo / 60) - (hFrom + mFrom / 60);
    }, 0);

    // --- Auth loading state ---
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

            <div className="landing-container pt-32 pb-20 px-4 md:px-8 max-w-7xl mx-auto flex flex-col gap-8">
                {/* Header Section — Executive Typography */}
                <motion.div
                    variants={fadeInUp}
                    initial="initial"
                    animate="animate"
                    className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full"
                >
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2 font-prompt">ตารางเรียน</h1>
                        <p className="text-white/70 font-light uppercase tracking-wider text-sm">
                            Class Schedule — Semester {semester}
                        </p>
                    </div>

                    {/* Summary Stats Card */}
                    {!loading && !error && totalClasses > 0 && (
                        <div className="flex gap-4 p-4 rounded-2xl bg-[rgba(255,255,255,0.1)] backdrop-blur-md border border-[rgba(255,255,255,0.15)] shadow-lg">
                            <div className="pr-4 border-r border-white/10">
                                <p className="text-xs text-white/70 uppercase tracking-wider mb-1">วิชา</p>
                                <p className="text-2xl font-bold text-[#ff5722] font-montserrat">{totalClasses}</p>
                            </div>
                            <div className="pr-4 border-r border-white/10">
                                <p className="text-xs text-white/70 uppercase tracking-wider mb-1">วัน</p>
                                <p className="text-2xl font-bold text-white font-montserrat">{totalDays}</p>
                            </div>
                            <div>
                                <p className="text-xs text-white/70 uppercase tracking-wider mb-1">ชั่วโมง</p>
                                <p className="text-2xl font-bold text-white font-montserrat">{totalHours > 0 ? totalHours.toFixed(0) : '—'}</p>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Loading State */}
                {loading && (
                    <div className="text-center text-white/70 py-10" role="status" aria-live="polite">
                        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-white/10 border-t-[#ff5722] mb-4"></div>
                        <p><span aria-hidden="true">⏳</span> กำลังโหลดตารางเรียน...</p>
                    </div>
                )}

                {/* Error State */}
                {!loading && error && (
                    <div className="bg-orange-500/20 text-orange-200 p-4 rounded-xl border border-orange-500/30 mb-4" role="alert" aria-live="assertive">
                        ⚠️ {error}
                        <button
                            onClick={handleRetry}
                            className="mt-3 block px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors min-h-[44px]"
                        >
                            ลองใหม่
                        </button>
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && totalClasses === 0 && (
                    <div className="text-center py-20">
                        <div className="bg-[rgba(255,255,255,0.05)] rounded-3xl p-8 max-w-md mx-auto border border-[rgba(255,255,255,0.1)]">
                            <div className="text-5xl mb-4">📭</div>
                            <h3 className="text-xl font-bold text-white mb-2">ไม่พบตารางเรียน</h3>
                            <p className="text-white/50 text-sm mb-6">
                                ยังไม่พบข้อมูลตารางเรียนในเทอมนี้ อาจเป็นเพราะยังไม่ได้ลงทะเบียนหรือ session หมดอายุ
                            </p>
                            <button
                                onClick={handleRetry}
                                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm min-h-[44px]"
                            >
                                🔄 ลองใหม่อีกครั้ง
                            </button>
                        </div>
                    </div>
                )}

                {/* Day Sections — Staggered, Glassmorphism cards (like Grade semesters) */}
                {!loading && !error && totalClasses > 0 && (
                    <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 gap-6 w-full"
                    >
                        {groupedSchedule.map((day) => (
                            <motion.div
                                key={day.key}
                                variants={staggerItem}
                                className="bg-[rgba(255,255,255,0.08)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-3xl overflow-hidden shadow-2xl hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-all duration-300"
                            >
                                {/* Day Header (matching Grade semester header) */}
                                <div className="bg-[rgba(255,255,255,0.03)] p-6 flex flex-wrap justify-between items-center border-b border-[rgba(255,255,255,0.05)]">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold border"
                                            style={{ background: day.accentBg, borderColor: day.accentBorder }}
                                        >
                                            {day.icon}
                                        </div>
                                        <div>
                                            <h2 className={`text-xl font-bold ${day.accent}`}>{day.label}</h2>
                                            <p className="text-white/50 text-sm">วัน{day.labelTh}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 md:mt-0 text-right">
                                        <p className="text-xs text-white/70 uppercase tracking-wider">Classes</p>
                                        <p className="text-xl font-bold text-white font-montserrat">{day.classes.length}</p>
                                    </div>
                                </div>

                                {/* Class Rows — Split-Header Pattern */}
                                <div className="p-6">
                                    <div className="space-y-0 divide-y divide-white/5">
                                        {day.classes.map((cls, i) => (
                                            <div
                                                key={`${day.key}-${i}`}
                                                className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 py-4 first:pt-0 last:pb-0 group"
                                            >
                                                {/* Left: Subject Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-mono text-white/50 uppercase tracking-wider">{cls.subject_id}</span>
                                                        {cls.section && (
                                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10">
                                                                SEC {cls.section}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-base font-semibold text-white leading-snug truncate" title={cls.subject_name_en || cls.subject_name_th || cls.subject_id}>
                                                        {cls.subject_name_en || cls.subject_name_th || `Course ${cls.subject_id}`}
                                                    </h3>
                                                </div>

                                                {/* Right: Time + Room (Split-Header) */}
                                                <div className="flex items-center gap-4 flex-shrink-0">
                                                    <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-black/20 border border-white/10 font-mono text-sm text-white/90">
                                                        {cls.timefrom || '??:??'} — {cls.timeto || '??:??'}
                                                    </div>
                                                    <div className="text-right min-w-[60px]">
                                                        <p className="text-[10px] text-white/40 uppercase tracking-wider">Room</p>
                                                        <p className={`text-lg font-bold ${day.accent} font-mono`}>
                                                            {cls.roomcode || 'TBA'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>
        </main>
    );
}
