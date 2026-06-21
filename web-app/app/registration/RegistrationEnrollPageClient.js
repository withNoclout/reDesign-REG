'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, BookOpen, CheckCircle, CircleDollarSign, Loader2 } from 'lucide-react';
import Navbar from '@/app/components/Navbar';
import GuestBanner from '@/app/components/GuestBanner';
import GlowingBackground from '@/app/components/GlowingBackground';
import { useAuth } from '@/app/context/AuthContext';
import { useGuest } from '@/app/context/GuestContext';

const OFFICIAL_ENROLL_URL = 'https://reg3.kmutnb.ac.th/registrar/enroll';
const DEFAULT_ELIGIBILITY = {
    isRegistrationPeriod: false,
    hasDebt: false,
    canRegister: false,
    outstandingBalance: 0,
    outstandingFees: [],
    blockingReasons: [],
    stageMessage: 'REG ยังไม่รายงานสถานะการลงทะเบียน',
};

function formatCurrency(value) {
    const amount = Number(value || 0);
    return `${amount.toLocaleString('th-TH')} บาท`;
}

function formatFeeTerm(fee) {
    const year = fee?.acadyear ? String(fee.acadyear) : null;
    const semester = fee?.semester ? String(fee.semester) : null;
    return semester && year ? `ภาคการศึกษา ${semester}/${year}` : 'ไม่ระบุภาคการศึกษา';
}

export default function RegistrationEnrollPageClient() {
    const { isAuthenticated, loading: authLoading, logout: handleLogout } = useAuth();
    const { isGuest, allowedModules, guestName, loading: guestLoading } = useGuest();
    const [gateData, setGateData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [mounted, setMounted] = useState(false);

    const canAccess = isGuest ? allowedModules.includes('registration') : isAuthenticated;

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!authLoading && !guestLoading && !canAccess) {
            handleLogout();
        }
    }, [authLoading, canAccess, guestLoading, handleLogout]);

    const fetchGatekeeper = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch('/api/registration/gatekeeper', { cache: 'no-store' });
            const result = await response.json();

            if (result.success) {
                setGateData(result.data);
                return;
            }

            if (response.status === 401 || result.code === 'SESSION_EXPIRED') {
                handleLogout();
                return;
            }

            setError(result.message || 'ไม่สามารถโหลดข้อมูลการลงทะเบียนได้');
        } catch (cause) {
            console.error('[RegistrationEnrollPageClient] Failed to load gatekeeper:', cause);
            setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setLoading(false);
        }
    }, [handleLogout]);

    useEffect(() => {
        if (authLoading || guestLoading || !canAccess) {
            return;
        }

        fetchGatekeeper();
    }, [authLoading, canAccess, fetchGatekeeper, guestLoading]);

    const handleEnterEnroll = () => {
        if (!gateData?.eligibility?.canRegister) return;

        const popup = window.open(OFFICIAL_ENROLL_URL, '_blank', 'noopener,noreferrer');
        if (!popup) {
            window.location.assign(OFFICIAL_ENROLL_URL);
        }
    };

    const stage = gateData?.stage ?? 0;
    const eligibility = gateData?.eligibility ?? DEFAULT_ELIGIBILITY;
    const acadInfo = gateData?.acadInfo ?? null;
    const semesterLabel = acadInfo?.enrollsemester && acadInfo?.enrollacadyear
        ? `${acadInfo.enrollsemester}/${acadInfo.enrollacadyear}`
        : 'ไม่พบข้อมูลภาคการศึกษา';
    const outstandingFees = Array.isArray(eligibility.outstandingFees) ? eligibility.outstandingFees : [];
    const blockingReasons = Array.isArray(eligibility.blockingReasons) ? eligibility.blockingReasons : [];
    const primaryBlockReason = blockingReasons[0] || '';
    const statusSummary = useMemo(() => {
        if (eligibility.canRegister) {
            return {
                title: 'พร้อมเปิดระบบลงทะเบียน',
                tone: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
                description: 'ไม่พบเงื่อนไขที่บล็อกการเปิดหน้าลงทะเบียนจากข้อมูล REG ล่าสุด',
            };
        }

        return {
            title: 'ยังไม่สามารถเปิดหน้าลงทะเบียน',
            tone: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
            description: primaryBlockReason || 'REG ยังไม่อนุญาตให้เปิดหน้าลงทะเบียนในขณะนี้',
        };
    }, [eligibility.canRegister, primaryBlockReason]);

    return (
        <main className="main-content min-h-screen" id="main-content">
            <GlowingBackground />
            <div className="bg-image" aria-hidden="true"></div>
            <div className="bg-overlay" aria-hidden="true"></div>
            <Navbar activePage="registration" activeSubmenu="registration" />
            {isGuest && <GuestBanner guestName={guestName} />}

            <div className="relative z-10 pt-28 pb-20 px-4 md:px-8 max-w-6xl mx-auto">
                {(authLoading || guestLoading || loading) ? (
                    <div className="min-h-[60vh] flex items-center justify-center text-white">
                        <div className="text-center">
                            <Loader2 className="animate-spin w-10 h-10 text-[#ff5722] mx-auto" />
                            <p className="mt-4 text-white/70">กำลังโหลดข้อมูลการลงทะเบียน...</p>
                        </div>
                    </div>
                ) : mounted && !canAccess ? null : error ? (
                    <div className="max-w-2xl mx-auto bg-red-500/10 p-6 rounded-3xl border border-red-500/20 text-center text-white">
                        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                        <h1 className="text-2xl font-bold mb-2">โหลดหน้าลงทะเบียนไม่สำเร็จ</h1>
                        <p className="text-white/70">{error}</p>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-10 text-white">
                            <p className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 mb-4">
                                ทะเบียน · ลงทะเบียนเรียน
                            </p>
                            <h1 className="text-4xl md:text-5xl font-bold mb-3">หน้าลงทะเบียนเรียน</h1>
                            <p className="text-lg text-white/60">ภาคการศึกษา {semesterLabel}</p>
                        </div>

                        <div className="grid gap-6 mb-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                            <div className={`rounded-3xl border p-6 backdrop-blur-xl ${statusSummary.tone}`}>
                                <p className="text-sm uppercase tracking-[0.2em] text-white/50 mb-2">Registration status</p>
                                <h2 className="text-2xl font-semibold mb-2">{statusSummary.title}</h2>
                                <p className="text-sm md:text-base text-white/80">{statusSummary.description}</p>
                                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                                    <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/80">
                                        {eligibility.stageMessage}
                                    </span>
                                    {eligibility.hasDebt && (
                                        <span className="inline-flex items-center rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-red-100">
                                            ยอดค้างรวม {formatCurrency(eligibility.outstandingBalance)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-3xl border border-white/10 bg-black/20 p-6 flex flex-col items-center justify-center text-white text-center backdrop-blur-xl">
                                <div className="w-20 h-20 bg-[#ff5722] rounded-full flex items-center justify-center mb-6 shadow-lg shadow-[#ff5722]/30">
                                    <BookOpen className="w-10 h-10 text-white" />
                                </div>
                                <p className="text-sm text-white/50 mb-1">สถานะขั้นตอนลงทะเบียน</p>
                                <p className="text-3xl font-bold mb-3">Stage {stage}</p>
                                <p className="text-sm text-white/60 mb-6">ปุ่มนี้จะเปิดระบบลงทะเบียนหลักของมหาวิทยาลัย</p>
                                <button
                                    type="button"
                                    onClick={handleEnterEnroll}
                                    disabled={!eligibility.canRegister}
                                    className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-all ${eligibility.canRegister
                                        ? 'bg-gradient-to-r from-[#ff5722] to-[#ff8a50] hover:scale-[1.02] shadow-lg shadow-[#ff5722]/20 text-white'
                                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                                >
                                    เปิดหน้าลงทะเบียน
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                                {!eligibility.canRegister && (
                                    <div className="mt-4 w-full rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-left text-sm text-red-100">
                                        <p className="font-semibold mb-2">ปุ่มถูกปิดเพราะ</p>
                                        <ul className="space-y-2">
                                            {blockingReasons.map((reason) => (
                                                <li key={reason} className="flex gap-2">
                                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                                    <span>{reason}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                                <div className="space-y-4 text-white">
                                    <h2 className="text-2xl font-semibold">ตรวจสอบสิทธิ์ก่อนลงทะเบียน</h2>
                                    <CheckItem
                                        label="ช่วงเวลาลงทะเบียน"
                                        status={eligibility.isRegistrationPeriod}
                                        text={eligibility.isRegistrationPeriod ? 'เปิดให้ลงทะเบียน' : 'ยังไม่อยู่ในช่วงเวลาลงทะเบียน'}
                                    />
                                    <CheckItem
                                        label="สถานะหนี้ค้างชำระ"
                                        status={!eligibility.hasDebt}
                                        text={!eligibility.hasDebt
                                            ? 'ไม่พบยอดค้างชำระ'
                                            : `พบยอดค้างชำระรวม ${formatCurrency(eligibility.outstandingBalance)}`}
                                    />
                                    <CheckItem
                                        label="สถานะจาก REG"
                                        status={stage > 0}
                                        text={eligibility.stageMessage}
                                    />
                                </div>

                                <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-white">
                                    <div className="flex items-center gap-3 mb-4">
                                        <CircleDollarSign className="w-6 h-6 text-[#ff8a65]" />
                                        <h3 className="text-xl font-semibold">รายละเอียดรายการค้างชำระ</h3>
                                    </div>
                                    {outstandingFees.length === 0 ? (
                                        <p className="text-white/60">ไม่พบรายการค้างชำระจากข้อมูล REG ล่าสุด</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {outstandingFees.map((fee) => (
                                                <div key={`${fee.feeid}-${fee.acadyear}-${fee.semester}`} className="rounded-2xl border border-red-400/15 bg-red-500/5 p-4">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div>
                                                            <p className="font-semibold text-red-100">{fee.feeidname || 'ไม่ทราบชื่อรายการ'}</p>
                                                            <p className="text-sm text-white/50 mt-1">{formatFeeTerm(fee)}</p>
                                                            {fee.voucher && <p className="text-xs text-white/40 mt-1">Voucher: {fee.voucher}</p>}
                                                        </div>
                                                        <p className="text-lg font-bold text-red-200 whitespace-nowrap">{formatCurrency(fee.balance)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}

function CheckItem({ label, status, text }) {
    return (
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
            <div className={`p-2 rounded-full ${status ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {status ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            <div>
                <p className="text-sm text-white/50">{label}</p>
                <p className={`font-semibold ${status ? 'text-white' : 'text-red-200'}`}>{text}</p>
            </div>
        </div>
    );
}
