'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
    fadeInUp,
    staggerContainer,
    staggerItem,
    TIMING
} from '../lib/animations';
import Navbar from '../components/Navbar';
import UserProfileCard from '../components/UserProfileCard';
import AcademicInfoCard from '../components/AcademicInfoCard';
import ErrorAlert from '../components/ErrorAlert';
import '../globals.css';

export default function Landing() {
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading, logout: handleLogout } = useAuth();
    const [loadingInfo, setLoadingInfo] = useState(true);
    const [error, setError] = useState(null);
    const [studentInfo, setStudentInfo] = useState(null);

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, authLoading, router]);

    // Fetch student info when user is authenticated
    useEffect(() => {
        const fetchStudentInfo = async () => {
            if (!user || !isAuthenticated) {
                setLoadingInfo(false);
                return;
            }

            try {
                setLoadingInfo(true);
                setError(null);

                const response = await fetch('/api/student/info');
                const result = await response.json();

                if (result.success) {
                    setStudentInfo(result.data);
                } else if (result.status === 401) {
                    // Session expired, redirect to login
                    handleLogout();
                } else {
                    setError(result.message || 'ไม่สามารถดึงข้อมูลได้');
                }
            } catch (err) {
                console.error('[Landing] Failed to fetch student info:', err);
                setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่');
            } finally {
                setLoadingInfo(false);
            }
        };

        fetchStudentInfo();
    }, [user, isAuthenticated, handleLogout]);



    return (
        <main className="main-content">
            <div className="bg-image"></div>
            <div className="bg-overlay"></div>

            {/* Navbar */}
            <Navbar activePage="profile" />

            {/* Dashboard Content */}
            <div className="landing-container">
                {/* Error Display */}
                <ErrorAlert
                    message={error}
                    type="error"
                    onDismiss={() => setError(null)}
                />

                {/* Dashboard Grid Layout */}
                <div className="dashboard-grid">
                    {/* Left Column: Profile Card */}
                    <div className="dashboard-left">
                        <UserProfileCard user={user} loading={loadingInfo} />

                        {/* Optional: Academic Info Card */}
                        {studentInfo && (
                            <AcademicInfoCard data={studentInfo} loading={loadingInfo} />
                        )}
                    </div>

                    {/* Right Column: News */}
                    <div className="dashboard-right">
                        <motion.h1
                            className="section-title"
                            {...fadeInUp}
                            transition={{ delay: TIMING.normal }}
                        >
                            News & Announcements
                        </motion.h1>

                        <motion.div
                            className="news-grid"
                            variants={staggerContainer}
                            initial="hidden"
                            animate="show"
                        >
                            {/* Mock Items - using Array.map */}
                            {[1, 2, 3, 4, 5, 6].map((item) => (
                                <motion.div
                                    key={item}
                                    className="news-card min-h-[44px]"
                                    role="article"
                                    variants={staggerItem}
                                    whileHover={{
                                        y: -8,
                                        transition: { duration: TIMING.slow }
                                    }}
                                >
                                    <div className="news-image-placeholder">IMG</div>
                                    <div className="news-content">
                                        <div className="news-title"></div>
                                        <div className="news-desc"></div>
                                        <div className="news-desc"></div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </div>
        </main>
    );
}