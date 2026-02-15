'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// --- Constants & Themes (Prevent Spaghetti) ---
const DAY_THEMES = {
    1: { key: 'sunday', label: 'Sunday', color: 'from-red-500/20 to-red-600/5', border: 'border-red-500/30', text: 'text-red-400' },
    2: { key: 'monday', label: 'Monday', color: 'from-yellow-400/20 to-yellow-500/5', border: 'border-yellow-400/30', text: 'text-yellow-400' },
    3: { key: 'tuesday', label: 'Tuesday', color: 'from-pink-500/20 to-pink-600/5', border: 'border-pink-500/30', text: 'text-pink-400' },
    4: { key: 'wednesday', label: 'Wednesday', color: 'from-green-500/20 to-green-600/5', border: 'border-green-500/30', text: 'text-green-400' },
    5: { key: 'thursday', label: 'Thursday', color: 'from-orange-500/20 to-orange-600/5', border: 'border-orange-500/30', text: 'text-orange-400' },
    6: { key: 'friday', label: 'Friday', color: 'from-blue-500/20 to-blue-600/5', border: 'border-blue-500/30', text: 'text-blue-400' },
    7: { key: 'saturday', label: 'Saturday', color: 'from-purple-500/20 to-purple-600/5', border: 'border-purple-500/30', text: 'text-purple-400' },
};

export default function ClassSchedule() {
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [semester, setSemester] = useState('');

    useEffect(() => {
        const fetchSchedule = async () => {
            try {
                const res = await fetch('/api/student/schedule');
                const json = await res.json();

                if (json.success) {
                    setSchedule(json.data || []); // Ensure array
                    setSemester(json.semester);
                } else {
                    setError(json.error || 'Failed to load schedule');
                }
            } catch (err) {
                setError('Network error');
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, []);

    // --- Processing Logic ---
    // Group classes by weekday using the Theme keys
    const groupedSchedule = Object.keys(DAY_THEMES).map(id => {
        const dayId = parseInt(id);
        const dayTheme = DAY_THEMES[dayId];
        const dayClasses = schedule
            .filter(item => item.weekday === dayId)
            .sort((a, b) => (a.timefrom || '').localeCompare(b.timefrom || '')); // Sort by start time

        return {
            ...dayTheme,
            classes: dayClasses
        };
    }).filter(day => day.classes.length > 0); // Only show days with actual confirmed classes

    if (loading) return (
        <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-white/10 border-t-[#ff5722] rounded-full animate-spin"></div>
        </div>
    );

    if (error) return (
        <div className="text-center py-20 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Unavailable</h3>
            <p className="text-white/60">{error}</p>
        </div>
    );

    return (
        <div className="w-full max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-3xl md:text-4xl font-bold text-white mb-2"
                    >
                        Class Schedule
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-white/60 font-medium"
                    >
                        Semester {semester}
                    </motion.p>
                </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {groupedSchedule.length === 0 ? (
                    <div className="col-span-full text-center py-20">
                        <div className="bg-white/5 rounded-2xl p-8 max-w-md mx-auto border border-white/10">
                            <h3 className="text-xl font-bold text-white mb-2">No Classes Found</h3>
                            <p className="text-white/40">
                                You don't have any classes scheduled for this period.
                                Keep up the good work!
                            </p>
                        </div>
                    </div>
                ) : (
                    groupedSchedule.map((day, dayIndex) => (
                        <motion.div
                            key={day.key}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: dayIndex * 0.1 }}
                            className="space-y-4"
                        >
                            {/* Day Header */}
                            <div className={`flex items-center gap-3 pb-2 border-b ${day.border}`}>
                                <span className={`text-lg font-bold ${day.text}`}>{day.label}</span>
                                <span className="text-xs font-mono text-white/40 uppercase tracking-wider">{day.classes.length} Classes</span>
                            </div>

                            {/* Class Cards */}
                            <div className="space-y-4">
                                {day.classes.map((cls, clsIndex) => (
                                    <motion.div
                                        key={`${day.key}-${clsIndex}`}
                                        whileHover={{ scale: 1.02, translateY: -5 }}
                                        className={`relative overflow-hidden rounded-2xl p-5 border border-white/5 bg-gradient-to-br ${day.color} backdrop-blur-xl group transition-all duration-300 hover:shadow-2xl hover:shadow-black/50`}
                                    >
                                        {/* Time Badge */}
                                        <div className="inline-block px-3 py-1 rounded-lg bg-black/20 text-white/90 font-mono text-sm mb-3 border border-white/10">
                                            {cls.timefrom || '??:??'} - {cls.timeto || '??:??'}
                                        </div>

                                        {/* Subject Info */}
                                        <div className="mb-4">
                                            <div className="text-xs text-white/60 mb-1 font-mono tracking-wide">{cls.subject_id}</div>
                                            <h3 className="text-lg font-bold text-white leading-tight line-clamp-2" title={cls.subject_name_en || cls.subject_name_th}>
                                                {cls.subject_name_en || cls.subject_name_th || 'My Course'}
                                            </h3>
                                        </div>

                                        {/* Footer: Room & Section */}
                                        <div className="flex items-end justify-between pt-3 border-t border-white/10">
                                            <div>
                                                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Section</div>
                                                <div className="text-sm font-medium text-white/80">{cls.section || '1'}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Room</div>
                                                <div className={`text-2xl font-bold ${day.text} font-mono tracking-tighter shadow-black drop-shadow-lg`}>
                                                    {cls.roomcode || 'TBA'}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
