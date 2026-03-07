'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangleIcon, CalendarIcon, ChevronRightIcon } from './Icons';
import Link from 'next/link';

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

export default function NextExamWidget() {
    const [scheduleData, setScheduleData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSchedule = async () => {
            try {
                const response = await fetch('/api/student/schedule');
                const result = await response.json();
                if (result.success) {
                    setScheduleData(result);
                }
            } catch (err) {
                console.error('Failed to fetch schedule for widget:', err);
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
            if (c.exam_midterm) {
                exams.push({
                    courseId: c.subject_id,
                    courseName: c.subject_name_th || c.subject_name_en,
                    type: 'Midterm',
                    dateRaw: c.exam_midterm,
                    dateFormatted: formatExamDate(c.exam_midterm),
                    color
                });
            }
            if (c.exam_final) {
                exams.push({
                    courseId: c.subject_id,
                    courseName: c.subject_name_th || c.subject_name_en,
                    type: 'Final',
                    dateRaw: c.exam_final,
                    dateFormatted: formatExamDate(c.exam_final),
                    color
                });
            }
        });

        // Basic sort by formatted date (e.g. 15/03) - assumes same year for now
        exams.sort((a, b) => {
            const getMonthDay = (dateStr) => {
                if (!dateStr) return 9999;
                const match = dateStr.match(/(\d{2})\/(\d{2})/);
                if (match) return parseInt(match[2] + match[1]); // MMDD
                return 9999;
            };
            return getMonthDay(a.dateFormatted) - getMonthDay(b.dateFormatted);
        });

        return { allExams: exams };
    }, [scheduleData]);

    if (loading) {
        return (
            <div className="bg-[rgba(255,255,255,0.04)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] rounded-3xl p-6 mb-6">
                <div className="h-6 w-32 bg-white/10 rounded animate-pulse mb-4"></div>
                <div className="space-y-3">
                    <div className="h-16 w-full bg-white/5 rounded-xl animate-pulse"></div>
                    <div className="h-16 w-full bg-white/5 rounded-xl animate-pulse"></div>
                </div>
            </div>
        );
    }

    if (!scheduleData || allExams.length === 0) {
        return null; // Hide widget if no exams
    }

    // Display next 3 exams max
    const displayExams = allExams.slice(0, 3);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[rgba(255,255,255,0.04)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] rounded-3xl p-6 mb-6 shadow-xl relative overflow-hidden"
        >
            {/* Decorative BG element */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#ff5722] opacity-[0.15] blur-3xl rounded-full pointer-events-none"></div>

            <div className="flex justify-between items-end mb-5 relative z-10">
                <div>
                    <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                        <AlertTriangleIcon size={16} className="text-[#ff5722]" /> Upcoming Exams
                    </h2>
                    <p className="text-xl font-bold text-white font-prompt mt-1">สอบที่กำลังจะมาถึง</p>
                </div>
                <Link href="/grade/schedule" className="text-xs text-[#ff5722] font-montserrat hover:text-[#ff8a65] flex items-center transition-colors pb-1">
                    See All <ChevronRightIcon size={14} className="ml-1" />
                </Link>
            </div>

            <div className="space-y-3 relative z-10">
                {displayExams.map((exam, i) => (
                    <div
                        key={i}
                        className="flex justify-between items-center p-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.06)] transition-colors group"
                        style={{ borderLeft: `3px solid ${exam.color.border}` }}
                    >
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
                            <div className="flex items-center gap-1.5 text-white/90 font-montserrat text-sm font-semibold">
                                <CalendarIcon size={14} className="text-white/50" />
                                {exam.dateFormatted.split(' ')[0]}
                            </div>
                            {exam.dateFormatted.split(' ')[1] && (
                                <span className="text-xs text-white/50 font-montserrat mt-0.5">{exam.dateFormatted.split(' ')[1]}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
