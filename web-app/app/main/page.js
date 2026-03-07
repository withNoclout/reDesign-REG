'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LockIcon } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { useGuest } from '../context/GuestContext';
import {
    staggerContainer,
    fadeInUp,
    scaleIn,
    cardHover,
    itemVariant
} from '@/lib/animations';
import Navbar from '../components/Navbar';
import GuestBanner from '../components/GuestBanner';
import UserProfileCard from '../components/UserProfileCard';
import AcademicInfoCard from '../components/AcademicInfoCard';
import ErrorAlert from '../components/ErrorAlert';
import PortfolioGrid from '../components/PortfolioGrid';
import NextExamWidget from '../components/NextExamWidget';
import '../globals.css';

const ADMIN_USER_ID = process.env.NEXT_PUBLIC_ADMIN_USER_ID || 's6701091611290';

export default function Main() {
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading, logout: handleLogout } = useAuth();
    const { isGuest, allowedModules, guestName, loading: guestLoading } = useGuest();

    // State
    const [loadingInfo, setLoadingInfo] = useState(true);
    const [error, setError] = useState(null);
    const [studentInfo, setStudentInfo] = useState(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);


    // Check permissions
    const canAccess = isGuest ? allowedModules.includes('profile') : isAuthenticated;
    const isAdmin = isAuthenticated && user?.usercode === ADMIN_USER_ID;

    // Redirect if not authenticated/authorized
    useEffect(() => {
        if (!authLoading && !guestLoading && !canAccess) {
            handleLogout();
        }
    }, [canAccess, authLoading, guestLoading, handleLogout]);

    // Fetch Student Profile (Consolidated)
    const fetchStudentInfo = useCallback(async () => {
        if (!user || !isAuthenticated) return;
        try {
            setLoadingInfo(true);
            // Use 'profile' API instead of broken 'info' API
            const response = await fetch('/api/student/profile');
            const result = await response.json();

            if (result.success) {
                setStudentInfo(result.data);
            } else if (response.status === 401 || result.code === 'SESSION_EXPIRED') {
                handleLogout();
            } else {
                // If profile fails (e.g. 503 partial), we might still have some data?
                // The API now returns 200 even if partial, unless 500/401.
                setError(result.message || 'ไม่สามารถดึงข้อมูลได้');
            }
        } catch (err) {
            console.error('[Main] Failed to fetch student info:', err);
            setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setLoadingInfo(false);
        }
    }, [user, isAuthenticated, handleLogout]);



    useEffect(() => {
        if (isAuthenticated) {
            fetchStudentInfo();
        } else {
            setLoadingInfo(false);
        }

        // Fetch news for everyone (guest or auth)
    }, [isAuthenticated, fetchStudentInfo]);

    // Loading State
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

    // Access Denied State (Redirecting...)
    if (mounted && !canAccess) {
        return null;
    }

    return (
        <main className="main-content" id="main-content">
            <div className="bg-image" aria-hidden="true"></div>
            <div className="bg-overlay" aria-hidden="true"></div>

            {/* Navbar */}
            <Navbar activePage="profile" />

            {/* Guest Banner */}
            {isGuest && <GuestBanner guestName={guestName} />}

            {/* Dashboard Content */}
            <div className="main-container">
                <ErrorAlert
                    message={error}
                    type="error"
                    onDismiss={() => setError(null)}
                />

                <div className="dashboard-grid">
                    {/* Left Column: Profile Card */}
                    <div className="dashboard-left">
                        <UserProfileCard user={user} loading={loadingInfo} profileData={studentInfo} />
                        {studentInfo && (
                            <AcademicInfoCard
                                data={studentInfo}
                                loading={loadingInfo}
                            />
                        )}
                    </div>

                    {/* Right Column: Portfolio & Exams */}
                    <div className="dashboard-right">
                        <NextExamWidget />
                        <PortfolioGrid />
                    </div>
                </div>
            </div>

            {/* News Editor Modal */}

        </main>
    );
}