'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useGuest } from '../context/GuestContext';
import {
    fadeInUp,
    staggerContainer,
    staggerItem,
    TIMING,
    scaleIn
} from '../lib/animations';
import Navbar from '../components/Navbar';
import GuestBanner from '../components/GuestBanner';
import UserProfileCard from '../components/UserProfileCard';
import AcademicInfoCard from '../components/AcademicInfoCard';
import ErrorAlert from '../components/ErrorAlert';
import NewsEditorModal from '../components/NewsEditorModal';
import '../globals.css';

const ADMIN_USER_ID = 's6701091611290';

export default function Landing() {
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading, logout: handleLogout } = useAuth();
    const { isGuest, allowedModules, guestName, loading: guestLoading } = useGuest();

    // State
    const [loadingInfo, setLoadingInfo] = useState(true);
    const [error, setError] = useState(null);
    const [studentInfo, setStudentInfo] = useState(null);
    const [newsItems, setNewsItems] = useState([]);
    const [loadingNews, setLoadingNews] = useState(true);
    const [showNewsModal, setShowNewsModal] = useState(false);

    // Check permissions
    const canAccess = isGuest ? allowedModules.includes('profile') : isAuthenticated;
    const isAdmin = isAuthenticated && user?.usercode === ADMIN_USER_ID;

    // Redirect if not authenticated/authorized
    useEffect(() => {
        if (!authLoading && !guestLoading && !isAuthenticated && !isGuest) {
            router.push('/');
        }
    }, [isAuthenticated, isGuest, authLoading, guestLoading, router]);

    // Fetch Student Info and News
    const fetchStudentInfo = useCallback(async () => {
        if (!user || !isAuthenticated) return;
        try {
            setLoadingInfo(true);
            const response = await fetch('/api/student/info');
            const result = await response.json();

            if (result.success) {
                setStudentInfo(result.data);
            } else if (result.status === 401) {
                handleLogout();
            } else {
                setError(result.message || 'ไม่สามารถดึงข้อมูลได้');
            }
        } catch (err) {
            console.error('[Landing] Failed to fetch student info:', err);
            setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setLoadingInfo(false);
        }
    }, [user, isAuthenticated, handleLogout]);

    const fetchNews = useCallback(async () => {
        try {
            setLoadingNews(true);
            const res = await fetch('/api/news');
            const data = await res.json();
            if (data.success) {
                setNewsItems(data.data);
            }
        } catch (err) {
            console.error('[Landing] Failed to fetch news:', err);
        } finally {
            setLoadingNews(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            fetchStudentInfo();
        } else {
            setLoadingInfo(false);
        }

        // Fetch news for everyone (guest or auth)
        fetchNews();
    }, [isAuthenticated, fetchStudentInfo, fetchNews]);

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

    // Access Denied State
    if (!canAccess) {
        return (
            <main className="main-content">
                <div className="bg-image"></div>
                <div className="bg-overlay"></div>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-white text-center">
                        <div className="text-6xl mb-4">🔒</div>
                        <h1 className="text-2xl font-bold mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
                        <p className="text-white/60">คุณไม่ได้รับอนุญาตให้ดูหน้านี้</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="main-content">
            <div className="bg-image"></div>
            <div className="bg-overlay"></div>

            {/* Navbar */}
            <Navbar activePage="profile" />

            {/* Guest Banner */}
            {isGuest && <GuestBanner guestName={guestName} />}

            {/* Dashboard Content */}
            <div className="landing-container">
                <ErrorAlert
                    message={error}
                    type="error"
                    onDismiss={() => setError(null)}
                />

                <div className="dashboard-grid">
                    {/* Left Column: Profile Card */}
                    <div className="dashboard-left">
                        <UserProfileCard user={user} loading={loadingInfo} />
                        {studentInfo && (
                            <AcademicInfoCard data={studentInfo} loading={loadingInfo} />
                        )}
                    </div>

                    {/* Right Column: News */}
                    <div className="dashboard-right">
                        <div className="flex items-center justify-between mb-6">
                            <motion.h1
                                className="section-title text-2xl font-bold text-white mb-0"
                                {...fadeInUp}
                            >
                                ข่าวประชาสัมพันธ์
                            </motion.h1>

                            {isAdmin && (
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowNewsModal(true)}
                                    className="px-4 py-2 bg-[#4ade80] hover:bg-[#4ade80]/90 text-black text-sm font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-[#4ade80]/20"
                                >
                                    <span>➕</span> เพิ่มข่าว
                                </motion.button>
                            )}
                        </div>

                        <motion.div
                            className="news-grid grid gap-4"
                            variants={staggerContainer}
                            initial="hidden"
                            animate="show"
                        >
                            {loadingNews ? (
                                // Loading Skeletons
                                [1, 2, 3].map(i => (
                                    <div key={i} className="bg-white/5 rounded-xl p-4 animate-pulse h-32"></div>
                                ))
                            ) : newsItems.length === 0 ? (
                                <div className="text-center text-white/40 py-10">
                                    ไม่มีข่าวประชาสัมพันธ์
                                </div>
                            ) : (
                                newsItems.map((item) => (
                                    <motion.article
                                        key={item.id}
                                        variants={staggerItem}
                                        className="bg-[#1e293b]/60 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden hover:bg-[#1e293b]/80 transition-colors group"
                                    >
                                        <div className="flex flex-col sm:flex-row gap-4 p-4">
                                            {/* Image */}
                                            {item.image_url ? (
                                                <div className="relative w-full sm:w-32 h-32 rounded-lg overflow-hidden flex-shrink-0">
                                                    <img
                                                        src={item.image_url}
                                                        alt={item.title}
                                                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-full sm:w-32 h-32 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0 text-3xl">
                                                    📰
                                                </div>
                                            )}

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 group-hover:text-[#4ade80] transition-colors">
                                                    {item.title}
                                                </h3>
                                                <p className="text-white/60 text-sm line-clamp-3 mb-2">
                                                    {item.description}
                                                </p>
                                                <div className="text-white/30 text-xs">
                                                    {new Date(item.created_at).toLocaleDateString('th-TH', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.article>
                                ))
                            )}
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* News Editor Modal */}
            <NewsEditorModal
                isOpen={showNewsModal}
                onClose={() => setShowNewsModal(false)}
                onRefresh={fetchNews}
            />
        </main>
    );
}