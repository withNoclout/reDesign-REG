'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useGuest } from '../context/GuestContext';
import Navbar from '../components/Navbar';
import GuestBanner from '../components/GuestBanner';
import GradeSubNav from '../components/GradeSubNav';
import EvaluationCard from '../components/EvaluationCard';
import AutoEvalToggle from '../components/evaluations/AutoEvalToggle';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';
import { ClockIcon, AlertTriangleIcon, UserCheckIcon, SparklesIcon, CheckIcon, LockIcon } from '../components/Icons';
import { useCredential } from '../context/CredentialContext';
import '../globals.css';

export default function EvaluationPage() {
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading, logout: handleLogout } = useAuth();
    const { isGuest, allowedModules, guestName, loading: guestLoading } = useGuest();
    const { requestCredential } = useCredential();
    const [evalList, setEvalList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [mounted, setMounted] = useState(false);
    const [massEvalProgress, setMassEvalProgress] = useState({ active: false, current: 0, total: 0, teacherName: '' });

    useEffect(() => {
        setMounted(true);
    }, []);

    // Check if this page is accessible
    const canAccess = isGuest ? allowedModules.includes('grade') : isAuthenticated;

    // Redirect if not authenticated and not a guest
    useEffect(() => {
        if (!authLoading && !guestLoading && !canAccess) {
            handleLogout();
        }
    }, [canAccess, authLoading, guestLoading, handleLogout]);

    const fetchEvaluations = async () => {
        if (isGuest) {
            setTimeout(() => {
                setEvalList([
                    {
                        course_code: "040433001",
                        course_name: "INTRO TO FOOD ENTREPRENEURSHIP",
                        section: "S.1",
                        class_id: 305594,
                        officer_id: 2795,
                        evaluate_id: 125,
                        officer_name: "ดร. สุทิน แก่นนาคำ",
                        eva_date: "10 มี.ค. 2569"
                    },
                    {
                        course_code: "010913121",
                        course_name: "MAINTENANCE ENGINEERING",
                        section: "S.2",
                        class_id: 305595,
                        officer_id: 1234,
                        evaluate_id: 126,
                        officer_name: "รองศาสตราจารย์สมเกียรติ จงประสิทธิ์พร",
                        eva_date: "15 มี.ค. 2569"
                    }
                ]);
                setLoading(false);
            }, 800);
            return;
        }

        if (!isAuthenticated) return;

        try {
            setLoading(true);
            const res = await fetch('/api/student/evaluation');
            const result = await res.json();

            if (result.success) {
                setEvalList(result.data || []);
                setError(null);
            } else {
                setError(result.message || 'ไม่สามารถดึงข้อมูลการประเมินได้');
            }
        } catch (err) {
            console.error('Fetch error:', err);
            setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvaluations();
    }, [isAuthenticated, isGuest]);

    const handleMassEvaluate = async () => {
        const pendingEvals = evalList.filter(item => !item.is_evaluated);
        if (pendingEvals.length === 0) return;

        setMassEvalProgress({ active: true, current: 0, total: pendingEvals.length, teacherName: 'กำลังเตรียมการ...' });

        let successCount = 0;
        let index = 0;

        for (const teacher of pendingEvals) {
            index++;
            const teacherName = teacher.officer_name || teacher.officername || 'อาจารย์';
            setMassEvalProgress(prev => ({ ...prev, current: index, teacherName }));

            try {
                // Empty formData will cause backend /submit proxy to default all answers to '5'
                const payload = {
                    evaluateId: teacher.evaluate_id || teacher.evaluateid,
                    classId: teacher.class_id || teacher.classid,
                    officerId: teacher.officer_id || teacher.officerid,
                    formData: {}
                };

                const res = await fetch('/api/student/evaluation/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (data.success) {
                    successCount++;
                }
            } catch (err) {
                console.error('Mass Evaluate Error for', teacherName, err);
            }

            // Sleep 800ms between requests to prevent Rate Limiting
            if (index < pendingEvals.length) {
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }

        // Finish
        setMassEvalProgress({ active: false, current: 0, total: 0, teacherName: '' });
        alert(`ประเมินเสร็จสิ้น! สำเร็จ ${successCount} จาก ${pendingEvals.length} รายการ`);

        // Refresh the list to move them to completed
        fetchEvaluations();
    };

    // Handle loading state
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

    // Handle access denied
    if (mounted && !canAccess) {
        return null;
    }

    return (
        <main className="main-content" id="main-content">
            <div className="bg-image" aria-hidden="true"></div>
            <div className="bg-overlay" aria-hidden="true"></div>

            <Navbar activePage="grade" />

            {/* Guest Banner */}
            {isGuest && <GuestBanner guestName={guestName} />}

            <div className="main-container pt-32 pb-20 px-4 md:px-8 max-w-7xl mx-auto flex flex-col gap-8">
                {/* Header Section */}
                <motion.div
                    variants={fadeInUp}
                    initial="initial"
                    animate="animate"
                    className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full"
                >
                    <div>
                        <p className="text-xs text-[#ff5722] uppercase tracking-wider font-light mb-1 font-montserrat flex items-center gap-1.5">
                            <SparklesIcon size={12} /> SMART EVALUATION SYSTEM
                        </p>
                        <h1 className="text-3xl font-bold text-white mb-1 font-prompt">ประเมินอาจารย์</h1>
                        <p className="text-white/50 text-sm font-light">Teacher Evaluation</p>
                    </div>

                    {/* Summary Card - Only show when we have data */}
                    {!loading && !error && evalList.length > 0 && (
                        <div className="flex gap-4 p-4 rounded-2xl bg-[rgba(255,255,255,0.1)] backdrop-blur-md border border-[rgba(255,255,255,0.15)] shadow-lg items-center">
                            <div className="flex-1">
                                <h3 className="text-white/80 font-medium font-prompt text-sm md:text-base mb-1">ต้องประเมินภาคเรียนนี้</h3>
                                <p className="text-2xl font-bold text-[#ff5722] font-montserrat text-center">{evalList.filter(e => !e.is_evaluated).length}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleMassEvaluate}
                                    disabled={massEvalProgress.active}
                                    className={`px-4 py-2 ${massEvalProgress.active ? 'bg-gray-500/20 text-gray-400 border-gray-500/40' : 'bg-[rgba(255,87,34,0.15)] text-[#ff5722] border-[rgba(255,87,34,0.4)] hover:bg-[#ff5722] hover:text-white'} border rounded-xl text-sm font-bold transition-colors flex items-center gap-2 group`}
                                >
                                    {massEvalProgress.active ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-400"></div>
                                    ) : (
                                        <SparklesIcon size={14} className="group-hover:animate-pulse" />
                                    )}
                                    <span>{massEvalProgress.active ? 'กำลังประเมิน...' : 'Evaluate All (5 Stars)'}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>

                <GradeSubNav />

                {!isGuest && !loading && !error && (
                    <motion.div variants={fadeInUp} className="w-full">
                        <AutoEvalToggle />
                    </motion.div>
                )}

                {/* Main Content Area */}
                {loading && (
                    <div className="text-center text-white/70 py-10" role="status" aria-live="polite">
                        <span aria-hidden="true"><ClockIcon size={16} /></span> กำลังโหลดข้อมูลอาจารย์ที่ต้องประเมิน...
                    </div>
                )}

                {!loading && error && (
                    <div className="bg-orange-500/20 text-orange-200 p-4 rounded-xl border border-orange-500/30 mb-4" role="alert" aria-live="assertive">
                        <AlertTriangleIcon size={16} className="inline mr-1" /> {error}
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-3 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                        >
                            ลองใหม่
                        </button>
                    </div>
                )}

                {/* Evaluation Split Logic */}
                {(() => {
                    const pendingEvals = evalList.filter(item => !item.is_evaluated);
                    const completedEvals = evalList.filter(item => item.is_evaluated);

                    return (
                        <>
                            {/* Empty State / Completed State */}
                            {!loading && !error && pendingEvals.length === 0 && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center py-20 bg-[rgba(255,255,255,0.05)] backdrop-blur-md border border-[rgba(255,255,255,0.1)] rounded-3xl mt-4"
                                >
                                    <div className="w-20 h-20 bg-[#4ade80]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <CheckIcon className="w-10 h-10 text-[#4ade80]" />
                                    </div>
                                    <div className="text-white text-2xl font-bold mb-2 font-prompt">
                                        ประเมินครบแล้ว!
                                    </div>
                                    <div className="text-white/60 text-sm max-w-sm mx-auto">
                                        คุณได้ทำการประเมินอาจารย์ครบทุกท่านในภาคการศึกษานี้เรียบร้อยแล้ว ยอดเยี่ยมมาก 🎉
                                    </div>
                                </motion.div>
                            )}

                            {/* Pending Evaluation List */}
                            {!loading && !error && pendingEvals.length > 0 && (
                                <motion.div
                                    variants={staggerContainer}
                                    initial="hidden"
                                    animate="show"
                                    className="grid grid-cols-1 gap-4 w-full"
                                >
                                    <AnimatePresence>
                                        {pendingEvals.map((item) => (
                                            <motion.div key={`${item.class_id}-${item.officer_id}`} variants={staggerItem}>
                                                <EvaluationCard
                                                    item={item}
                                                    onEvaluate={(teacher) => {
                                                        router.push(`/evaluation/form/${teacher.evaluate_id || teacher.evaluateid}?classId=${teacher.class_id || teacher.classid}&officerId=${teacher.officer_id || teacher.officerid}`);
                                                    }}
                                                    onAutoEvaluate={(teacher) => {
                                                        // Placeholder button on Individual Card. Does nothing but show an alert.
                                                        alert(`ฟังก์ชันนี้สงวนไว้สำหรับปุ่ม "Evaluate All (5 Stars)" ด้านบนครับ (เพื่อประเมินทีเดียวทุกคน)`);
                                                    }}
                                                />
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </motion.div>
                            )}

                            {/* Completed Evaluation List */}
                            {!loading && !error && completedEvals.length > 0 && (
                                <motion.div
                                    variants={staggerContainer}
                                    initial="hidden"
                                    animate="show"
                                    className="grid grid-cols-1 gap-4 w-full mt-10"
                                >
                                    <div className="flex items-center gap-4 mb-2">
                                        <div className="h-px bg-white/20 flex-1"></div>
                                        <span className="text-white/50 font-prompt text-sm font-bold">✓ ประเมินอาจารย์เรียบร้อยแล้ว ({completedEvals.length})</span>
                                        <div className="h-px bg-white/20 flex-1"></div>
                                    </div>

                                    <AnimatePresence>
                                        {completedEvals.map((item) => (
                                            <motion.div
                                                key={`${item.class_id}-${item.officer_id}`}
                                                variants={staggerItem}
                                                className="opacity-60 grayscale-[0.3] pointer-events-none"
                                            >
                                                <EvaluationCard
                                                    item={item}
                                                    isCompleted={true}
                                                    onEvaluate={() => { }}
                                                    onAutoEvaluate={() => { }}
                                                />
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </motion.div>
                            )}
                        </>
                    );
                })()}

                {/* Information Hint */}
                {!loading && !error && evalList.length > 0 && (
                    <motion.div
                        variants={fadeInUp}
                        className="mt-8 p-6 rounded-2xl bg-[rgba(33,150,243,0.08)] border border-[rgba(33,150,243,0.2)] flex flex-col md:flex-row items-center gap-6"
                    >
                        <div className="w-12 h-12 rounded-xl bg-[rgba(33,150,243,0.15)] flex items-center justify-center shrink-0 border border-[rgba(33,150,243,0.3)]">
                            <UserCheckIcon size={24} className="text-[#64b5f6]" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-[#64b5f6] mb-1 font-prompt">ทำไมต้องประเมินอาจารย์?</h4>
                            <p className="text-white/60 text-xs md:text-sm leading-relaxed">
                                การประเมินอาจารย์เป็นส่วนหนึ่งของกระบวนการพัฒนาการเรียนการสอน
                                และเป็นเงื่อนไขจำเป็นในการดู <b>ผลการเรียนของนักศึกษา</b> ในภาคการศึกษาปัจจุบัน
                            </p>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Mass Evaluation Progress Overlay (Non-blocking bottom snackbar) */}
            <AnimatePresence>
                {massEvalProgress.active && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
                    >
                        <div className="bg-[#1a1c23]/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-5 overflow-hidden relative">
                            {/* Background Progress Fill */}
                            <div
                                className="absolute top-0 left-0 h-full bg-[#ff5722]/10 transition-all duration-500 ease-out z-0"
                                style={{ width: `${(massEvalProgress.current / massEvalProgress.total) * 100}%` }}
                            ></div>

                            <div className="relative z-10 flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-white font-prompt font-medium">
                                        <SparklesIcon size={16} className="text-[#ff5722] animate-pulse" />
                                        <span>กำลังประเมินอัติโนมัติ</span>
                                    </div>
                                    <div className="text-white/60 text-sm font-montserrat">
                                        {massEvalProgress.current} / {massEvalProgress.total}
                                    </div>
                                </div>

                                <p className="text-white/80 text-sm font-prompt truncate">
                                    กำลังดำเนินการ: <span className="text-white font-medium">{massEvalProgress.teacherName}</span>
                                </p>

                                {/* Slim Progress Bar */}
                                <div className="w-full h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-[#ff5722] to-[#ffcc80] transition-all duration-500 ease-out"
                                        style={{ width: `${(massEvalProgress.current / massEvalProgress.total) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
