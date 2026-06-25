'use client';

import { motion } from 'framer-motion';
import { GraduationCapIcon, RefreshCwIcon } from '@/app/components/Icons';
import { LOAN_SURFACE, LOAN_SURFACE_EMBED, toneClass } from './loanDashboardTheme';

function StatusChip({ children, tone = 'slate' }) {
    return (
        <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-prompt md:text-sm ${toneClass(tone)}`}>
            {children}
        </span>
    );
}

export default function StudentLoanHero({
    profileText,
    isConfirmed,
    statusLabel,
    statusTone,
    nextDeadline,
    onOpenProfileModal,
}) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${LOAN_SURFACE} p-6 md:p-7`}
        >
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                        <p className="mb-2.5 text-xs font-montserrat uppercase tracking-[0.22em] text-[#ff8a65]">Student Loan Monitoring</p>
                        <h1 className="text-2xl font-bold leading-tight text-white font-prompt md:text-[2.2rem]">กยศ.</h1>
                        <p className="mt-3 max-w-2xl text-[0.98rem] font-prompt leading-relaxed text-white/65 md:text-[1rem]">
                            ศูนย์ติดตามข่าว กำหนดการ ขั้นตอน และลิงก์ที่ต้องใช้สำหรับการดำเนินการ กยศ. ของคุณในรูปแบบ feed และ monitoring dashboard
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onOpenProfileModal}
                        className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.15)] transition-colors hover:bg-white/[0.1] hover:text-white font-prompt"
                    >
                        <RefreshCwIcon size={16} />
                        เปลี่ยนประเภทผู้กู้
                    </button>
                </div>

                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.95fr)]">
                    <div className={`${LOAN_SURFACE_EMBED} p-5 md:p-6`}>
                        <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-[#ff9b7a]">
                                <GraduationCapIcon size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-montserrat uppercase tracking-[0.18em] text-white/45">สถานะผู้กู้</p>
                                <p className="mt-2 text-lg font-semibold leading-tight text-white font-prompt md:text-[1.65rem]">{profileText}</p>
                                <p className="mt-3 max-w-2xl text-sm font-prompt leading-relaxed text-white/60">
                                    {isConfirmed
                                        ? 'Dashboard นี้กำลังใช้สถานะผู้กู้ของคุณเพื่อคัดเฉพาะข่าว ขั้นตอน และลิงก์ที่เกี่ยวข้อง ให้เห็นในมุมของผู้ใช้ที่ต้องดำเนินการจริง'
                                        : 'ยังไม่ได้ยืนยันประเภทผู้กู้ จึงแสดงภาพรวมเบื้องต้นก่อน เมื่อยืนยันแล้ว feed ทั้งหมดจะถูกจัดให้ตรงกับสถานะของคุณ'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className={`${LOAN_SURFACE_EMBED} flex flex-col gap-5 p-5 md:p-6`}>
                        <div>
                            <p className="text-xs font-montserrat uppercase tracking-[0.18em] text-white/45">ภาพรวมล่าสุด</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <StatusChip tone={isConfirmed ? 'emerald' : 'amber'}>
                                    {isConfirmed ? 'ยืนยันประเภทผู้กู้แล้ว' : 'รอการยืนยันประเภทผู้กู้'}
                                </StatusChip>
                                <StatusChip tone={statusTone}>{statusLabel}</StatusChip>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                            <p className="text-sm font-montserrat uppercase tracking-[0.12em] text-white/50">สิ่งที่ต้องจับตา</p>
                            <p className="mt-2 text-base font-semibold leading-relaxed text-white font-prompt md:text-[1.02rem]">{nextDeadline}</p>
                        </div>
                    </div>
                </div>
            </div>
        </motion.section>
    );
}
