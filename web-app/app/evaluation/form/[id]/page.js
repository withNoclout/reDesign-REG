'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/context/AuthContext';
import { useGuest } from '@/app/context/GuestContext';
import Navbar from '@/app/components/Navbar';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';
import { ArrowLeftIcon, CheckCircleIcon, AlertTriangleIcon, ClockIcon, SparklesIcon, SendIcon } from '@/app/components/Icons';
import '@/app/globals.css';

export default function EvaluationFormPage({ params }) {
    const { id: evaluateId } = use(params);
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const { isGuest, allowedModules, guestName, loading: guestLoading } = useGuest();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const [formMeta, setFormMeta] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});

    const canAccess = isGuest ? allowedModules.includes('grade') : isAuthenticated;

    useEffect(() => {
        if (!authLoading && !guestLoading && !isAuthenticated && !isGuest) {
            router.push('/');
        }
    }, [isAuthenticated, isGuest, authLoading, guestLoading, router]);

    useEffect(() => {
        const fetchForm = async () => {
            if (!evaluateId) return;

            if (isGuest) {
                // Mock data for guests
                setTimeout(() => {
                    setQuestions([
                        { id: 'q1', text: 'มีความรับผิดชอบต่องานสอน เข้าสอนและเลิกสอนตรงเวลา', options: [{ value: "5", label: "5" }, { value: "4", label: "4" }, { value: "3", label: "3" }, { value: "2", label: "2" }, { value: "1", label: "1" }] },
                        { id: 'q2', text: 'มีการแจ้งเค้าโครงรายวิชา (Syllabus) และเกณฑ์การวัดผลที่ชัดเจน', options: [{ value: "5", label: "5" }, { value: "4", label: "4" }, { value: "3", label: "3" }, { value: "2", label: "2" }, { value: "1", label: "1" }] }
                    ]);
                    setLoading(false);
                }, 800);
                return;
            }

            try {
                const res = await fetch(`/api/student/evaluation/form?id=${evaluateId}`);
                const result = await res.json();

                if (result.success) {
                    setQuestions(result.data.questions || []);
                    setFormMeta({
                        __VIEWSTATE: result.data.__VIEWSTATE,
                        __EVENTVALIDATION: result.data.__EVENTVALIDATION,
                        __VIEWSTATEGENERATOR: result.data.__VIEWSTATEGENERATOR
                    });
                    setError(null);
                } else {
                    if (result.needsSetup) {
                        setError('เนื่องจากมีการอัปเดตระบบความปลอดภัย กรุณาออกจากระบบ (Logout) และเข้าสู่ระบบใหม่อีกครั้ง');
                    } else {
                        setError(result.message || 'ไม่สามารถดึงข้อมูลฟอร์มประเมินได้');
                    }
                }
            } catch (err) {
                console.error('Fetch error:', err);
                setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่');
            } finally {
                setLoading(false);
            }
        };

        if (isAuthenticated || isGuest) {
            fetchForm();
        }
    }, [evaluateId, isAuthenticated, isGuest]);

    const handleOptionSelect = (questionId, value) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: value
        }));
    };

    const handleQuickAction = (value) => {
        const newAnswers = {};
        questions.forEach(q => {
            if (q.options && q.options.length > 0) {
                const targetOption = q.options.find(opt => opt.value === value || opt.label === value) || q.options[0];
                newAnswers[q.id] = targetOption.value;
            }
        });
        setAnswers(newAnswers);
    };

    const handleSubmit = async () => {
        const missing = questions.filter(q => !answers[q.id]);
        if (missing.length > 0 && !isGuest) {
            alert(`กรุณาตอบคำถามให้ครบทุกข้อ (ขาดอีก ${missing.length} ข้อ)`);
            return;
        }

        if (isGuest) {
            setSubmitting(true);
            setTimeout(() => {
                setSubmitting(false);
                setSuccess(true);
            }, 1000);
            return;
        }

        setSubmitting(true);
        try {
            const formData = {
                ...answers
            };

            const payload = {
                evaluateId,
                formData,
                __VIEWSTATE: formMeta.__VIEWSTATE,
                __EVENTVALIDATION: formMeta.__EVENTVALIDATION,
                __VIEWSTATEGENERATOR: formMeta.__VIEWSTATEGENERATOR
            };

            const res = await fetch('/api/student/evaluation/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (result.success) {
                setSuccess(true);
            } else {
                alert(result.message || 'เกิดข้อผิดพลาดในการส่งผลประเมิน');
            }
        } catch (err) {
            alert('การเชื่อมต่อล้มเหลว กรุณาลองใหม่');
        } finally {
            setSubmitting(false);
        }
    };

    if (authLoading || guestLoading || loading) {
        return (
            <main className="main-content">
                <div className="bg-image"></div>
                <div className="bg-overlay"></div>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-white text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                        <p className="mt-4 font-prompt">กำลังดึงหน้าแบบประเมิน...</p>
                    </div>
                </div>
            </main>
        );
    }

    if (success) {
        return (
            <main className="main-content text-center py-20 px-4 min-h-screen flex items-center justify-center">
                <div className="bg-image"></div>
                <div className="bg-overlay"></div>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white/10 backdrop-blur-xl p-10 rounded-3xl border border-white/20 max-w-md w-full relative z-10">
                    <CheckCircleIcon size={80} className="text-[#4ade80] mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-white font-prompt mb-2">ส่งผลประเมินสำเร็จ!</h2>
                    <p className="text-white/70 mb-8">ขอบคุณสำหรับความคิดเห็นเพื่อปรับปรุงการเรียนการสอน</p>
                    <button
                        onClick={() => router.push('/evaluation')}
                        className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors"
                    >
                        กลับไปหน้ารายการ
                    </button>
                </motion.div>
            </main>
        );
    }

    return (
        <main className="main-content">
            <div className="bg-image"></div>
            <div className="bg-overlay"></div>

            <Navbar activePage="grade" />

            <div className="main-container pt-32 pb-32 px-4 md:px-8 max-w-4xl mx-auto flex flex-col gap-6">

                {/* Header with Back Button */}
                <motion.div variants={fadeInUp} initial="initial" animate="animate" className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/evaluation')}
                        className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                    >
                        <ArrowLeftIcon size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white font-prompt">แบบประเมินอาจารย์ผู้สอน</h1>
                        <p className="text-white/50 text-sm">Course Evaluation Form</p>
                    </div>
                </motion.div>

                {error ? (
                    <motion.div variants={fadeInUp} initial="initial" animate="animate" className="bg-red-500/20 text-red-200 p-6 rounded-2xl border border-red-500/30 flex flex-col items-center justify-center text-center">
                        <AlertTriangleIcon size={48} className="text-red-400 mb-4" />
                        <p className="text-lg mb-4">{error}</p>
                        <button onClick={() => router.push('/evaluation')} className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors">
                            กลับไปหน้ารายการ
                        </button>
                    </motion.div>
                ) : (
                    <>
                        {/* Quick Actions Bar */}
                        <motion.div variants={fadeInUp} initial="initial" animate="animate" className="bg-[rgba(255,87,34,0.1)] border border-[rgba(255,87,34,0.3)] rounded-2xl p-5 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-2">
                                <SparklesIcon size={20} className="text-[#ff5722]" />
                                <span className="font-bold text-[#ff5722] font-prompt">ด่วน! ให้คะแนนเท่ากันทุกข้อ</span>
                            </div>
                            <div className="flex gap-2">
                                {[5, 4, 3, 2, 1].map(score => (
                                    <button
                                        key={score}
                                        onClick={() => handleQuickAction(String(score))}
                                        className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition-colors border border-white/10"
                                        title={`ให้คะแนน ${score} ทุกข้อ`}
                                    >
                                        {score}
                                    </button>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-4">
                            {questions.map((q, idx) => (
                                <motion.div key={q.id} variants={staggerItem} className={`p-6 rounded-2xl border transition-colors ${answers[q.id] ? 'bg-white/10 border-white/20' : 'bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)]'}`}>
                                    <p className="text-white font-medium mb-4 leading-relaxed font-prompt text-lg">{idx + 1}. {q.text}</p>
                                    <div className="flex flex-wrap gap-2 md:gap-4">
                                        {q.options && q.options.map(opt => {
                                            const isSelected = answers[q.id] === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => handleOptionSelect(q.id, opt.value)}
                                                    className={`px-4 py-2 rounded-xl border text-sm font-bold transition-all
                                                        ${isSelected
                                                            ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]'
                                                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/15'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>

                        {/* Sticky Footer */}
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-md border-t border-white/10 z-30">
                            <div className="max-w-4xl mx-auto flex justify-between items-center">
                                <div className="text-white/60 text-sm hidden md:block">
                                    ตอบแล้ว {Object.keys(answers).length} จาก {questions.length} ข้อ
                                </div>
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="flex items-center gap-2 px-8 py-3 bg-[#ff5722] hover:bg-[#f4511e] text-white rounded-xl font-prompt font-bold transition-all disabled:opacity-50 disabled:grayscale ml-auto shadow-[0_4px_20px_rgba(255,87,34,0.4)]"
                                >
                                    {submitting ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            กำลังประมวลผล...
                                        </>
                                    ) : (
                                        <>
                                            <SendIcon size={18} /> ส่งผลการประเมิน
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
