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
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const { isGuest, allowedModules, guestName, loading: guestLoading } = useGuest();
    const { requestCredential } = useCredential();
    const [evalList, setEvalList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Check if this page is accessible
    const canAccess = isGuest ? allowedModules.includes('grade') : isAuthenticated;

    // Redirect if not authenticated and not a guest
    useEffect(() => {
        if (!authLoading && !guestLoading && !isAuthenticated && !isGuest) {
            router.push('/');
        }
    }, [isAuthenticated, isGuest, authLoading, guestLoading, router]);

    useEffect(() => {
        const fetchEvaluations = async () => {
            if (isGuest) {
                // Mock data for guests to showcase the feature
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

        fetchEvaluations();
    }, [isAuthenticated, isGuest]);

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
                            <div className="pr-4 border-r border-white/10">
                                <p className="text-xs text-white/70 uppercase tracking-wider mb-1">Pending</p>
                                <p className="text-2xl font-bold text-[#ff5722] font-montserrat text-center">{evalList.length}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button className="px-4 py-2 bg-[rgba(255,87,34,0.15)] border border-[rgba(255,87,34,0.4)] text-[#ff5722] rounded-xl text-sm font-bold hover:bg-[#ff5722] hover:text-white transition-colors flex items-center gap-2 group">
                                    <SparklesIcon size={14} className="group-hover:animate-pulse" />
                                    <span>ประเมินทั้งหมด (Auto)</span>
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

                {/* Empty State / Completed State */}
                {!loading && !error && evalList.length === 0 && (
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

                {/* Evaluation List */}
                {!loading && !error && evalList.length > 0 && (
                    <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 gap-4 w-full"
                    >
                        <AnimatePresence>
                            {evalList.map((item) => (
                                <motion.div key={`${item.class_id}-${item.officer_id}`} variants={staggerItem}>
                                    <EvaluationCard
                                        item={item}
                                        onEvaluate={async (teacher) => {
                                            const pwd = await requestCredential(
                                                'ยืนยันตัวตนก่อนประเมิน',
                                                'กรุณากรอกรหัสผ่านเพื่อเข้าสู่ระบบประเมินผลอาจารย์ (ระบบต้องการดึงข้อมูลฟอร์มจากสำนักทะเบียน)'
                                            );

                                            if (pwd) {
                                                // Keep password in sessionStorage if the form page needs it for API submission
                                                sessionStorage.setItem('eval_temp_pwd', pwd);
                                                router.push(`/evaluation/form/${teacher.evaluate_id || teacher.evaluateid}`);
                                            }
                                        }}
                                        onAutoEvaluate={(teacher) => {
                                            alert(`[DEMO] กำลังพัฒนาระบบ Auto Submit สำหรับ: ${teacher.officer_name}`);
                                        }}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}

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
        </main>
    );
}
