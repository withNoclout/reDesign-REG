'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, CreditCard, BookOpen, ArrowRight, Loader2 } from 'lucide-react';

export default function AddDropConfirmPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [gateData, setGateData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchGatekeeper();
    }, []);

    const fetchGatekeeper = async () => {
        try {
            const res = await fetch('/api/registration/gatekeeper');
            const json = await res.json();
            if (json.success) {
                setGateData(json.data);
            } else {
                setError(json.message || 'Failed to load status');
            }
        } catch (err) {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (!gateData?.eligibility?.canRegister) return;
        router.push('/registration/add-drop');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center text-white">
                <Loader2 className="animate-spin w-10 h-10 text-[#ff5722]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center text-white">
                <div className="bg-red-500/10 p-6 rounded-xl border border-red-500/20 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold mb-2">System Error</h2>
                    <p className="text-gray-400">{error}</p>
                </div>
            </div>
        );
    }

    const { stage, eligibility, acadInfo } = gateData;

    return (
        <div className="min-h-screen bg-[#1a1a2e] text-white font-prompt relative overflow-hidden">
            {/* Background Accents */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-[#ff5722]/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px]" />
            </div>

            <main className="relative z-10 max-w-4xl mx-auto px-6 py-20 flex flex-col items-center justify-center min-h-screen">

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-4">
                        Course Registration
                    </h1>
                    <p className="text-xl text-gray-400">
                        Semester {acadInfo?.enrollsemester}/{acadInfo?.enrollacadyear}
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl"
                >
                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Left: Status Checklist */}
                        <div className="flex-1 space-y-6">
                            <h3 className="text-2xl font-semibold mb-6">Eligibility Check</h3>

                            <CheckItem
                                label="Registration Period"
                                status={eligibility.isRegistrationPeriod}
                                text={eligibility.isRegistrationPeriod ? "Open Now" : "Closed"}
                            />
                            <CheckItem
                                label="Tuition Fees"
                                status={!eligibility.hasDebt}
                                text={!eligibility.hasDebt ? "No Outstanding Debt" : "Payment Required"}
                            />
                            <CheckItem
                                label="Academic Status"
                                status={true}
                                text="Normal"
                            />

                        </div>

                        {/* Right: Action Area */}
                        <div className="flex-1 flex flex-col justify-center items-center p-6 bg-black/20 rounded-2xl border border-white/5">
                            <div className="w-20 h-20 bg-[#ff5722] rounded-full flex items-center justify-center mb-6 shadow-lg shadow-[#ff5722]/30">
                                <BookOpen className="w-10 h-10 text-white" />
                            </div>

                            <div className="text-center mb-8">
                                <p className="text-gray-400 text-sm mb-1">Current Enroll Stage</p>
                                <p className="text-2xl font-bold text-white">Stage {stage}</p>
                            </div>

                            <button
                                onClick={handleConfirm}
                                disabled={!eligibility.canRegister}
                                className={`
                                    w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all
                                    ${eligibility.canRegister
                                        ? 'bg-gradient-to-r from-[#ff5722] to-[#ff8a50] hover:scale-105 shadow-lg shadow-[#ff5722]/20 text-white'
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
                                `}
                            >
                                Confirm & Enter
                                <ArrowRight className="w-5 h-5" />
                            </button>

                            {!eligibility.canRegister && (
                                <p className="mt-4 text-red-400 text-sm flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Please clear outstanding issues first.
                                </p>
                            )}
                        </div>
                    </div>
                </motion.div>

                <p className="mt-8 text-gray-500 text-sm">
                    By clicking confirm, you acknowledge that you are the student identified above.
                </p>

            </main>
        </div>
    );
}

function CheckItem({ label, status, text }) {
    return (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
            <div className={`
                p-2 rounded-full 
                ${status ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}
            `}>
                {status ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            <div>
                <p className="text-sm text-gray-400">{label}</p>
                <p className={`font-semibold ${status ? 'text-white' : 'text-red-400'}`}>{text}</p>
            </div>
        </div>
    );
}
