'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import EvaluationCard from '../components/EvaluationCard';

// Local SVG icons to avoid lucide-react build error
const Loader2 = ({ className }) => (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

const AlertCircle = ({ className }) => (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
);

const Info = ({ className }) => (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);

const Sparkles = ({ className }) => (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="M5 3v4" />
        <path d="M19 17v4" />
        <path d="M3 5h4" />
        <path d="M17 19h4" />
    </svg>
);
import '../globals.css';

export default function EvaluationPage() {
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const router = useRouter();
    const [evalList, setEvalList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, authLoading, router]);

    useEffect(() => {
        const fetchEvaluations = async () => {
            try {
                setLoading(true);
                const res = await fetch('/api/student/evaluation');
                const result = await res.json();
                if (result.success) {
                    setEvalList(result.data);
                } else {
                    setError(result.message);
                }
            } catch (err) {
                setError('Failed to load evaluation list');
            } finally {
                setLoading(false);
            }
        };

        if (isAuthenticated) {
            fetchEvaluations();
        }
    }, [isAuthenticated]);

    if (authLoading) return null;

    return (
        <main className="main-content min-h-screen bg-slate-950">
            <div className="bg-image opacity-20" aria-hidden="true"></div>
            <div className="bg-overlay" aria-hidden="true"></div>

            <Navbar activePage="evaluation" />

            <div className="landing-container pt-32 pb-20">
                <div className="max-w-5xl mx-auto px-4">

                    {/* Header Section */}
                    <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-4">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider"
                            >
                                <Sparkles className="w-3 h-3" />
                                Smart Evaluation System
                            </motion.div>
                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-4xl md:text-5xl font-black text-white leading-tight"
                            >
                                รายการประเมินอาจารย์<br />
                                <span className="text-orange-500">ที่ยังค้างอยู่</span>
                            </motion.h1>
                        </div>

                        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-3xl flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-white/40 text-xs uppercase font-bold">ต้องประเมินอีก</p>
                                <p className="text-2xl font-black text-white">{evalList.length} ท่าน</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center text-white font-black text-lg">
                                !
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-40 gap-4">
                            <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
                            <p className="text-white/40 animate-pulse">กำลังดึงข้อมูลอาจารย์...</p>
                        </div>
                    ) : error ? (
                        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl text-center space-y-4">
                            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                            <h2 className="text-xl font-bold text-white">เกิดข้อผิดพลาด</h2>
                            <p className="text-white/60 max-w-sm mx-auto">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
                            >
                                ลองใหม่อีกครั้ง
                            </button>
                        </div>
                    ) : evalList.length === 0 ? (
                        <div className="bg-white/5 border border-white/10 p-20 rounded-[40px] text-center space-y-6">
                            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                                <Info className="w-12 h-12 text-green-500" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-3xl font-black text-white">ประเมินครบแล้ว!</h2>
                                <p className="text-white/40">คุณได้ทำการประเมินอาจารย์ครบทุกท่านในเทอมนี้แล้ว</p>
                            </div>
                            <button
                                onClick={() => router.push('/landing')}
                                className="px-8 py-3 bg-white text-black rounded-2xl font-bold hover:bg-orange-500 hover:text-white transition-all duration-300"
                            >
                                กลับสู่หน้าหลัก
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            <AnimatePresence>
                                {evalList.map((item, index) => (
                                    <EvaluationCard
                                        key={`${item.class_id}-${item.officer_id}`}
                                        item={item}
                                        onEvaluate={(teacher) => {
                                            alert(`กำลังพัฒนาระบบประเมินอัตโนมัติสำหรับ: ${teacher.officer_name}`);
                                        }}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Hint Footer */}
                    <div className="mt-20 p-8 rounded-[32px] bg-gradient-to-br from-orange-500/5 to-red-500/5 border border-white/5 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center shrink-0">
                            <Info className="text-orange-500 w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-lg font-bold text-white">ทำไมต้องประเมินอาจารย์?</h4>
                            <p className="text-white/40 text-sm leading-relaxed">
                                การประเมินอาจารย์เป็นส่วนหนึ่งของกระบวนการพัฒนาการเรียนการสอน <br className="hidden md:block" />
                                และเป็นเงื่อนไขในการเข้าดูผลการเรียนของนักศึกษาในเทอมปัจจุบัน
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </main>
    );
}
