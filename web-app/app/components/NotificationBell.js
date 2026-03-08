'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellIcon, AlertTriangleIcon, CalendarIcon, ChevronRightIcon } from './Icons';
import Link from 'next/link';

// Use same THAI_MONTHS and formatExamDate from NextExamWidget
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
    const timeMatch = s.match(/(\d{1,2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : '';
    const dayMatch = s.match(/(\d{1,2})\s/);
    if (!dayMatch) return s;
    const day = dayMatch[1].padStart(2, '0');
    let month = '';
    for (const [name, num] of Object.entries(THAI_MONTHS)) {
        if (s.includes(name)) { month = num; break; }
    }
    if (!month) return s;
    return time ? `${day}/${month} ${time}` : `${day}/${month}`;
}

const COURSE_COLORS = [
    { bg: 'rgba(255, 87, 34, 0.18)', border: 'rgba(255, 87, 34, 0.4)', text: '#ff8a65' },
    { bg: 'rgba(33, 150, 243, 0.18)', border: 'rgba(33, 150, 243, 0.4)', text: '#64b5f6' },
    { bg: 'rgba(76, 175, 80, 0.18)', border: 'rgba(76, 175, 80, 0.4)', text: '#81c784' },
    { bg: 'rgba(156, 39, 176, 0.18)', border: 'rgba(156, 39, 176, 0.4)', text: '#ce93d8' }
];

export default function NotificationBell() {
    const [scheduleData, setScheduleData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchSchedule = async () => {
            try {
                const response = await fetch('/api/student/schedule');
                const result = await response.json();
                if (result.success) {
                    setScheduleData(result);
                }
            } catch (err) {
                console.error('Failed to fetch schedule for notifications:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchSchedule();
    }, []);

    const { allExams } = useMemo(() => {
        if (!scheduleData?.data?.length) return { allExams: [] };
        const courses = scheduleData.data;
        const exams = [];
        courses.forEach((c, i) => {
            const color = COURSE_COLORS[i % COURSE_COLORS.length];
            if (c.exam_midterm) exams.push({
                courseId: c.subject_id, courseName: c.subject_name_th || c.subject_name_en, type: 'Midterm',
                dateFormatted: formatExamDate(c.exam_midterm), color
            });
            if (c.exam_final) exams.push({
                courseId: c.subject_id, courseName: c.subject_name_th || c.subject_name_en, type: 'Final',
                dateFormatted: formatExamDate(c.exam_final), color
            });
        });
        exams.sort((a, b) => {
            const getMonthDay = (dateStr) => {
                if (!dateStr) return 9999;
                const match = dateStr.match(/(\d{2})\/(\d{2})/);
                if (match) return parseInt(match[2] + match[1]);
                return 9999;
            };
            return getMonthDay(a.dateFormatted) - getMonthDay(b.dateFormatted);
        });
        return { allExams: exams };
    }, [scheduleData]);

    const hasNotifications = allExams.length > 0;
    const displayExams = allExams.slice(0, 3); // Max 3

    return (
        <div className="relative" ref={dropdownRef}>
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                whileHover={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ duration: 0.4 }}
                aria-label="การแจ้งเตือน"
            >
                <BellIcon size={20} />
                {hasNotifications && !loading && (
                    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff5722] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ff5722] border-2 border-[rgba(15,23,42,1)]"></span>
                    </span>
                )}
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-3 w-80 bg-[rgba(15,23,42,0.95)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-2xl shadow-xl overflow-hidden z-50 flex flex-col"
                    >
                        <div className="flex justify-between items-center px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                            <h3 className="text-sm font-bold text-white font-prompt flex items-center gap-2">
                                <AlertTriangleIcon size={14} className="text-[#ff5722]" />
                                ตารางสอบถัดไป
                            </h3>
                            <Link href="/grade/schedule?tab=exam" onClick={() => setIsOpen(false)} className="text-xs text-[#ff5722] hover:text-[#ff8a65] font-montserrat transition-colors flex items-center">
                                ดูทั้งหมด <ChevronRightIcon size={12} className="ml-0.5" />
                            </Link>
                        </div>

                        <div className="p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {loading ? (
                                <div className="p-4 flex justify-center">
                                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#ff5722]"></div>
                                </div>
                            ) : displayExams.length > 0 ? (
                                displayExams.map((exam, i) => (
                                    <Link href="/grade/schedule?tab=exam" onClick={() => setIsOpen(false)} key={i} className="flex justify-between items-center p-3 rounded-xl hover:bg-[rgba(255,255,255,0.06)] transition-colors group cursor-pointer" style={{ borderLeft: `3px solid ${exam.color.border}` }}>
                                        <div className="min-w-0 pr-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold font-montserrat px-1.5 py-0.5 rounded" style={{ backgroundColor: exam.color.bg, color: exam.color.text }}>
                                                    {exam.courseId}
                                                </span>
                                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${exam.type === 'Midterm' ? 'bg-[#ffb74d]/20 text-[#ffb74d]' : 'bg-[#f06292]/20 text-[#f06292]'}`}>
                                                    {exam.type}
                                                </span>
                                            </div>
                                            <p className="text-sm text-white/90 font-prompt truncate">{exam.courseName}</p>
                                        </div>
                                        <div className="flex flex-col items-end shrink-0">
                                            <div className="flex items-center gap-1.5 text-white/90 font-montserrat text-xs font-semibold">
                                                <CalendarIcon size={12} className="text-white/50" />
                                                {exam.dateFormatted.split(' ')[0]}
                                            </div>
                                            {exam.dateFormatted.split(' ')[1] && (
                                                <span className="text-[10px] text-white/50 font-montserrat mt-0.5">{exam.dateFormatted.split(' ')[1]}</span>
                                            )}
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className="py-6 px-4 text-center text-white/50 text-sm font-prompt">
                                    ไม่มีวิชาที่กำหนดสอบ
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
