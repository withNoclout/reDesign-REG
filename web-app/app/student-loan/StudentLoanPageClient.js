'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import GuestBanner from '../components/GuestBanner';
import GlowingBackground from '../components/GlowingBackground';
import { useAuth } from '../context/AuthContext';
import { useGuest } from '../context/GuestContext';
import {
    AlertTriangleIcon,
    ArrowLeftIcon,
    BookOpenIcon,
    ChevronRightIcon,
    GraduationCapIcon,
    LockIcon,
} from '../components/Icons';
import StudentLoanHero from './_components/StudentLoanHero';
import StudentLoanActionPanel from './_components/StudentLoanActionPanel';
import StudentLoanJourneySection from './_components/StudentLoanJourneySection';
import StudentLoanOnboardingModal from './_components/StudentLoanOnboardingModal';
import StudentLoanTicker from './_components/StudentLoanTicker';
import StudentLoanSidebar from './_components/StudentLoanSidebar';
import { LOAN_SURFACE, LOAN_SURFACE_EMBED } from './_components/loanDashboardTheme';
import {
    buildFeedItems,
    buildLinkGroups,
    buildManagementHighlights,
    buildOverviewCards,
    buildPageSummary,
    buildTickerItems,
    profileLabel,
} from './_components/studentLoanViewModel';

function SurfaceCard({ title, description, eyebrow, icon: Icon, children }) {
    return (
        <section className={`${LOAN_SURFACE} p-6 md:p-7`}>
            <div className="flex items-center gap-3 mb-5">
                <div className="h-11 w-11 rounded-2xl bg-white/[0.08] border border-white/10 flex items-center justify-center text-[#ff8a65]">
                    <Icon size={20} />
                </div>
                <div>
                    <p className="text-sm text-white/50 font-montserrat uppercase tracking-[0.16em]">{eyebrow}</p>
                    <h2 className="text-xl text-white font-prompt font-bold">{title}</h2>
                </div>
            </div>
            {description && <p className="text-sm text-white/60 font-prompt leading-relaxed mb-4">{description}</p>}
            {children}
        </section>
    );
}

function LoadingState() {
    return (
        <div className="space-y-6" role="status" aria-live="polite">
            <SurfaceCard
                eyebrow="Loading"
                title="กำลังเตรียม dashboard กยศ."
                description="ระบบกำลังดึงข่าว กำหนดการ และสถานะการดำเนินการที่เกี่ยวข้องกับบัญชีของคุณ"
                icon={GraduationCapIcon}
            >
                <div className="grid xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
                    <div className={`${LOAN_SURFACE_EMBED} p-5 animate-pulse min-h-[190px]`} />
                    <div className="grid sm:grid-cols-2 xl:grid-cols-1 gap-4">
                        <div className={`${LOAN_SURFACE_EMBED} p-5 animate-pulse min-h-[110px]`} />
                        <div className={`${LOAN_SURFACE_EMBED} p-5 animate-pulse min-h-[110px]`} />
                        <div className={`${LOAN_SURFACE_EMBED} p-5 animate-pulse min-h-[110px] sm:col-span-2 xl:col-span-1`} />
                    </div>
                </div>
            </SurfaceCard>
            <div className="grid xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)] gap-6">
                <div className={`${LOAN_SURFACE} p-6 animate-pulse min-h-[480px]`} />
                <div className={`${LOAN_SURFACE} p-6 animate-pulse min-h-[480px]`} />
            </div>
        </div>
    );
}

function AccessDeniedState({ isGuest }) {
    return (
        <SurfaceCard
            eyebrow="Access"
            title="ไม่สามารถเปิดหน้า กยศ. ได้"
            description={isGuest
                ? 'ลิงก์แชร์ที่ใช้ในขณะนี้ไม่ได้อนุญาตให้เข้าถึงโมดูล กยศ. กรุณากลับไปยังส่วนที่ได้รับสิทธิ์หรือติดต่อเจ้าของลิงก์'
                : 'กรุณาเข้าสู่ระบบใหม่เพื่อเปิดใช้งาน dashboard กยศ. และการแจ้งเตือนที่เกี่ยวข้อง'}
            icon={LockIcon}
        >
            <div className="flex flex-wrap gap-3">
                <Link href="/main" className="inline-flex items-center gap-2 rounded-xl bg-[#ff5722] px-4 py-3 text-white font-semibold font-prompt hover:bg-[#e64a19] transition-colors shadow-[0_12px_28px_rgba(255,87,34,0.24)]">
                    <ArrowLeftIcon size={16} />
                    กลับไปหน้าหลัก
                </Link>
            </div>
        </SurfaceCard>
    );
}

function ErrorState({ message, onRetry }) {
    return (
        <SurfaceCard
            eyebrow="Error"
            title="ไม่สามารถโหลดข้อมูล กยศ. ได้ในขณะนี้"
            description="หน้า dashboard ยังคงพร้อมใช้งาน แต่ยังไม่สามารถดึงข่าวหรือกำหนดการล่าสุดขึ้นมาได้ กรุณาลองใหม่อีกครั้ง"
            icon={AlertTriangleIcon}
        >
            <div className={`${LOAN_SURFACE_EMBED} p-4 text-orange-100 border-orange-500/30 bg-orange-500/10`}>
                <p>{message}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#ff5722] px-4 py-3 text-white font-semibold font-prompt hover:bg-[#e64a19] transition-colors shadow-[0_12px_28px_rgba(255,87,34,0.24)]"
                >
                    ลองโหลดอีกครั้ง
                    <ChevronRightIcon size={16} />
                </button>
            </div>
        </SurfaceCard>
    );
}

function EmptyFeedHint() {
    return (
        <SurfaceCard
            eyebrow="Student Loan"
            title="ยังไม่มีรายการใน feed ที่ต้องติดตามทันที"
            description="ยังไม่พบกำหนดการเปิดดำเนินการในช่วงเวลานี้ แต่คุณยังสามารถติดตามประกาศต้นทาง ระบบที่ต้องใช้ และคู่มือประกอบได้จากแผงจัดการด้านขวา"
            icon={BookOpenIcon}
        >
            <div className={`${LOAN_SURFACE_EMBED} p-5 text-white/65 font-prompt`}>
                เมื่อมีประกาศใหม่หรือใกล้ถึงวันปิดรับ ระบบจะนำข้อมูลขึ้นมาใน feed ด้านซ้ายและแสดงผ่าน ticker ด้านบนโดยอัตโนมัติ
            </div>
        </SurfaceCard>
    );
}

export default function StudentLoanPage() {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const { isGuest, allowedModules, guestName, loading: guestLoading } = useGuest();
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const canAccess = isGuest ? allowedModules.includes('student-loan') : isAuthenticated;

    const loadDashboard = useCallback(async () => {
        if (!canAccess) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await fetch('/api/student-loan/dashboard');
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result?.error?.message || result?.message || 'Failed to load student loan dashboard');
            }

            setDashboard(result.data);
            setError('');
            setIsModalOpen(Boolean(result.data.profile?.needsSelection));
        } catch (cause) {
            console.error('Failed to load student loan dashboard:', cause);
            setError(cause.message || 'ไม่สามารถโหลดข้อมูล กยศ. ได้ในขณะนี้');
        } finally {
            setLoading(false);
        }
    }, [canAccess]);

    useEffect(() => {
        if (authLoading || guestLoading) {
            return;
        }

        if (!canAccess) {
            setLoading(false);
            return;
        }

        loadDashboard();
    }, [authLoading, guestLoading, canAccess, loadDashboard]);

    const handleSaveProfile = useCallback(async ({ borrowerType, educationLevel }) => {
        try {
            setIsSavingProfile(true);
            const response = await fetch('/api/student-loan/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ borrowerType, educationLevel }),
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result?.error?.message || result?.message || 'Failed to save student loan profile');
            }
            setIsModalOpen(false);
            await loadDashboard();
        } catch (cause) {
            console.error('Failed to save student loan profile:', cause);
            alert('ไม่สามารถบันทึกประเภทผู้กู้ได้ กรุณาลองใหม่');
        } finally {
            setIsSavingProfile(false);
        }
    }, [loadDashboard]);

    const profile = dashboard?.profile?.confirmed || null;
    const recommendedProfile = dashboard?.profile?.recommended || null;
    const notifications = dashboard?.notifications || [];
    const events = dashboard?.events || [];
    const resources = dashboard?.resources || [];
    const steps = dashboard?.steps || [];
    const sources = dashboard?.sources || [];

    const summary = useMemo(() => buildPageSummary({
        confirmedProfile: profile,
        recommendedProfile,
        notifications,
        events,
        resources,
    }), [profile, recommendedProfile, notifications, events, resources]);

    const feedItems = useMemo(() => buildFeedItems({
        confirmedProfile: profile,
        recommendedProfile,
        notifications,
        events,
        resources,
        steps,
    }), [profile, recommendedProfile, notifications, events, resources, steps]);

    const tickerItems = useMemo(() => buildTickerItems({
        confirmedProfile: profile,
        recommendedProfile,
        notifications,
        events,
        resources,
        steps,
        sources,
    }), [profile, recommendedProfile, notifications, events, resources, steps, sources]);

    const overviewCards = useMemo(() => buildOverviewCards({
        confirmedProfile: profile,
        recommendedProfile,
        notifications,
        events,
        steps,
        resources,
        nextDeadline: summary.nextDeadline,
    }), [profile, recommendedProfile, notifications, events, steps, resources, summary.nextDeadline]);

    const managementHighlights = useMemo(() => buildManagementHighlights({
        confirmedProfile: profile,
        recommendedProfile,
        notifications,
        resources,
        sources,
    }), [profile, recommendedProfile, notifications, resources, sources]);

    const linkGroups = useMemo(() => buildLinkGroups(resources), [resources]);

    return (
        <main className="main-content" id="main-content">
            <GlowingBackground />
            <div className="bg-image" aria-hidden="true"></div>
            <div className="bg-overlay" aria-hidden="true"></div>

            <Navbar activePage="others" activeSubmenu="student-loan" />
            {isGuest && <GuestBanner guestName={guestName} />}

            <StudentLoanOnboardingModal
                isOpen={isModalOpen}
                required={Boolean(dashboard?.profile?.needsSelection)}
                recommendedProfile={recommendedProfile}
                isSaving={isSavingProfile}
                onSubmit={handleSaveProfile}
                onClose={() => setIsModalOpen(false)}
            />

            <div className="main-container">
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.68fr)_minmax(300px,0.92fr)]">
                    <div className="flex min-w-0 flex-col gap-6">
                        <StudentLoanHero
                            profileText={profileLabel(profile || recommendedProfile)}
                            isConfirmed={Boolean(profile)}
                            statusLabel={summary.statusLabel}
                            statusTone={summary.statusTone}
                            nextDeadline={summary.nextDeadline}
                            onOpenProfileModal={() => setIsModalOpen(true)}
                        />

                        {recommendedProfile?.reason && !profile && !loading && canAccess && !error && (
                            <div className={`${LOAN_SURFACE_EMBED} border-emerald-400/20 bg-emerald-500/12 p-4 text-emerald-100`}>
                                <span className="font-semibold">คำแนะนำจากระบบ:</span> {recommendedProfile.reason}
                            </div>
                        )}

                        {authLoading || guestLoading || loading ? (
                            <LoadingState />
                        ) : !canAccess ? (
                            <AccessDeniedState isGuest={isGuest} />
                        ) : error ? (
                            <ErrorState message={error} onRetry={loadDashboard} />
                        ) : (
                            <>
                                <StudentLoanTicker items={tickerItems} />
                                <StudentLoanActionPanel
                                    nextAction={summary.nextAction}
                                    overviewCards={overviewCards}
                                />
                                {feedItems.length > 0 ? <StudentLoanJourneySection items={feedItems} /> : <EmptyFeedHint />}
                            </>
                        )}
                    </div>

                    {!authLoading && !guestLoading && !loading && canAccess && !error && (
                        <StudentLoanSidebar
                            highlights={managementHighlights}
                            linkGroups={linkGroups}
                            sources={sources}
                            onOpenProfileModal={() => setIsModalOpen(true)}
                        />
                    )}
                </div>
            </div>
        </main>
    );
}
