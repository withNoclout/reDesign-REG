'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangleIcon, CheckCircleIcon, GraduationCapIcon, XIcon } from '@/app/components/Icons';

const BORROWER_OPTIONS = [
    {
        value: 'new',
        title: 'ผู้กู้รายใหม่',
        description: 'นักศึกษาใหม่ หรือเพิ่งเริ่มทำเรื่องกู้กับ มจพ. เป็นครั้งแรก',
    },
    {
        value: 'continuing',
        title: 'ผู้กู้รายเก่าต่อเนื่อง',
        description: 'เคยกู้กับ มจพ. มาก่อน และปีนี้ต้องการกู้ต่อในระดับเดิม',
    },
];

const LEVEL_OPTIONS = [
    {
        value: 'vocational',
        title: 'ปวช. / อนุปริญญา',
    },
    {
        value: 'bachelor',
        title: 'ปริญญาตรี',
    },
];

export default function StudentLoanOnboardingModal({
    isOpen,
    required = false,
    recommendedProfile,
    isSaving = false,
    onSubmit,
    onClose,
}) {
    const [borrowerType, setBorrowerType] = useState(recommendedProfile?.borrowerType || 'new');
    const [educationLevel, setEducationLevel] = useState(recommendedProfile?.educationLevel || 'bachelor');

    useEffect(() => {
        if (!isOpen) return;
        setBorrowerType(recommendedProfile?.borrowerType || 'new');
        setEducationLevel(recommendedProfile?.educationLevel || 'bachelor');
    }, [isOpen, recommendedProfile]);

    const handleSubmit = async () => {
        await onSubmit?.({ borrowerType, educationLevel });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                        onClick={() => {
                            if (!required) {
                                onClose?.();
                            }
                        }}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/10 bg-[rgba(15,23,42,0.95)] shadow-2xl overflow-hidden"
                    >
                        <div className="px-6 py-5 border-b border-white/10 bg-white/[0.03] flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-[#ff8a65] font-montserrat mb-2">Student Loan Setup</p>
                                <h2 className="text-2xl text-white font-prompt font-bold">ตั้งค่าประเภทผู้กู้</h2>
                                <p className="text-sm text-white/60 mt-2 font-prompt">
                                    ใช้ข้อมูลนี้เพื่อให้หน้า กยศ. และการแจ้งเตือนในกระดิ่งคัดเฉพาะกำหนดการที่ตรงกับคุณ
                                </p>
                            </div>
                            {!required && (
                                <button
                                    onClick={() => onClose?.()}
                                    className="shrink-0 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors p-2"
                                    aria-label="ปิด"
                                >
                                    <XIcon size={16} />
                                </button>
                            )}
                        </div>

                        <div className="p-6 space-y-6">
                            {recommendedProfile?.reason && (
                                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100 font-prompt flex gap-3">
                                    <CheckCircleIcon size={18} className="shrink-0 mt-0.5 text-emerald-300" />
                                    <div>
                                        <p className="font-semibold">ระบบแนะนำค่าเริ่มต้นให้แล้ว</p>
                                        <p className="text-emerald-100/80 mt-1">{recommendedProfile.reason}</p>
                                    </div>
                                </div>
                            )}

                            <section>
                                <div className="flex items-center gap-2 text-white mb-3">
                                    <span className="h-7 w-7 rounded-full bg-[#ff5722]/15 text-[#ff8a65] flex items-center justify-center text-sm font-bold">1</span>
                                    <h3 className="font-prompt font-semibold">เลือกประเภทผู้กู้</h3>
                                </div>
                                <div className="grid md:grid-cols-2 gap-3">
                                    {BORROWER_OPTIONS.map((option) => {
                                        const isSelected = borrowerType === option.value;
                                        const isRecommended = recommendedProfile?.borrowerType === option.value;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setBorrowerType(option.value)}
                                                className={`text-left rounded-2xl border p-4 transition-all ${isSelected
                                                    ? 'border-[#ff5722] bg-[#ff5722]/12 shadow-lg shadow-[#ff5722]/10'
                                                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-white font-prompt font-semibold">{option.title}</p>
                                                    {isRecommended && (
                                                        <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-400/20 uppercase tracking-wide font-bold">แนะนำ</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-white/60 mt-2 leading-relaxed font-prompt">{option.description}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            <section>
                                <div className="flex items-center gap-2 text-white mb-3">
                                    <span className="h-7 w-7 rounded-full bg-[#ff5722]/15 text-[#ff8a65] flex items-center justify-center text-sm font-bold">2</span>
                                    <h3 className="font-prompt font-semibold">เลือกระดับการศึกษา</h3>
                                </div>
                                <div className="grid md:grid-cols-2 gap-3">
                                    {LEVEL_OPTIONS.map((option) => {
                                        const isSelected = educationLevel === option.value;
                                        const isRecommended = recommendedProfile?.educationLevel === option.value;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setEducationLevel(option.value)}
                                                className={`text-left rounded-2xl border p-4 transition-all ${isSelected
                                                    ? 'border-[#ff5722] bg-[#ff5722]/12 shadow-lg shadow-[#ff5722]/10'
                                                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-[#ff8a65]">
                                                            <GraduationCapIcon size={18} />
                                                        </div>
                                                        <p className="text-white font-prompt font-semibold">{option.title}</p>
                                                    </div>
                                                    {isRecommended && (
                                                        <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-400/20 uppercase tracking-wide font-bold">แนะนำ</span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            {required && (
                                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100 font-prompt flex gap-3">
                                    <AlertTriangleIcon size={18} className="shrink-0 mt-0.5 text-amber-300" />
                                    <p>ตั้งค่าครั้งแรกก่อน เพื่อให้หน้า กยศ. แสดงขั้นตอนและกำหนดการได้ตรงกับสถานะของคุณ</p>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-5 border-t border-white/10 bg-white/[0.03] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                            <p className="text-xs text-white/50 font-prompt">ภายหลังสามารถกลับมาแก้ไขประเภทผู้กู้ได้จากหน้า กยศ.</p>
                            <div className="flex items-center gap-3">
                                {!required && (
                                    <button
                                        type="button"
                                        onClick={() => onClose?.()}
                                        className="px-4 py-2 rounded-xl border border-white/15 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                                    >
                                        ยกเลิก
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={isSaving}
                                    className="px-5 py-2.5 rounded-xl bg-[#ff5722] hover:bg-[#e64a19] text-white font-semibold font-prompt transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? 'กำลังบันทึก...' : 'ยืนยันและใช้งานต่อ'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
