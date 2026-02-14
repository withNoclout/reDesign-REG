'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
    navbarSlideDown,
    logoAppear,
    menuItemSlide,
    buttonPress,
    pulseGlow,
    fadeInUp,
    staggerContainer,
    staggerItem,
    mobileMenuSlide,
    TIMING
} from '../lib/animations';
import UserProfileCard from '../components/UserProfileCard';
import AcademicInfoCard from '../components/AcademicInfoCard';
import ErrorAlert from '../components/ErrorAlert';
import '../globals.css';

// Menu configuration for maintainability
const MENU_ITEMS = [
    { id: 'home', icon: 'home', label: 'Home', active: true, href: '#' },
    { id: 'profile', icon: 'profile', label: 'Profile', active: false, href: '#' },
    { id: 'schedule', icon: 'schedule', label: 'Schedule', active: false, href: '#' },
    { id: 'curriculum', icon: 'curriculum', label: 'Curriculum', active: false, href: '#' },
    { id: 'search', icon: 'search', label: 'Room Search', active: false, href: '#' },
    { id: 'news', icon: 'news', label: 'News', active: false, href: '#' },
    { id: 'faq', icon: 'faq', label: 'FAQ', active: false, href: '#' }
];

// Icon SVG components
const Icons = {
    home: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    ),
    profile: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
    ),
    schedule: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    ),
    curriculum: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
        </svg>
    ),
    search: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    ),
    news: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
    ),
    faq: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    )
};

export default function Landing() {
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading, logout: handleLogout } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [studentInfo, setStudentInfo] = useState(null);
    const [loadingInfo, setLoadingInfo] = useState(true);
    const [error, setError] = useState(null);

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

    const toggleMenu = () => setMenuOpen(!menuOpen);

    return (
        <main className="main-content">
            <div className="bg-image"></div>
            <div className="bg-overlay"></div>

            {/* Animated Navbar */}
            <motion.nav
                className={`navbar ${menuOpen ? 'active' : ''}`}
                id="navbar"
                {...navbarSlideDown}
            >
                <div className="nav-container">
                    <a href="#" className="nav-brand">
                        <motion.svg
                            className="nav-logo"
                            viewBox="0 0 40 40"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            {...logoAppear}
                        >
                            <circle cx="20" cy="20" r="18" stroke="white" strokeWidth="2" fill="rgba(255,255,255,0.15)" />
                            <text x="20" y="26" textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily="Montserrat">R</text>
                        </motion.svg>
                        <motion.span
                            className="brand-text"
                            {...fadeInUp}
                            transition={{ delay: TIMING.normal }}
                        >
                            REG <motion.span className="brand-accent" {...pulseGlow}>KMUTNB</motion.span>
                        </motion.span>
                    </a>

                    <AnimatePresence>
                        {menuOpen && (
                            <motion.ul
                                className={`nav-menu ${menuOpen ? 'active' : ''}`}
                                variants={staggerContainer}
                                initial="hidden"
                                animate="show"
                                {...mobileMenuSlide}
                            >
                                {MENU_ITEMS.map((item, index) => {
                                    const IconComponent = Icons[item.icon];
                                    return (
                                        <motion.li key={item.id} variants={staggerItem}>
                                            <motion.a
                                                href={item.href}
                                                className={`nav-link min-h-[44px] flex items-center ${item.active ? 'active' : ''}`}
                                                {...menuItemSlide}
                                                transition={{ delay: index * TIMING.stagger }}
                                            >
                                                <IconComponent />
                                                {item.label}
                                            </motion.a>
                                        </motion.li>
                                    );
                                })}
                            </motion.ul>
                        )}
                    </AnimatePresence>

                    <div className="nav-right">
                        <motion.span
                            className="nav-user-name min-h-[44px] flex items-center"
                            {...fadeInUp}
                            transition={{ delay: TIMING.normal + TIMING.normal }}
                        >
                            {user?.name || user?.username || 'User'}
                        </motion.span>
                        <motion.button
                            className="nav-login-btn min-h-[44px]"
                            onClick={handleLogout}
                            {...buttonPress}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: TIMING.normal * 2 }}
                        >
                            Logout
                        </motion.button>
                        <button
                            className="hamburger min-h-[44px] min-w-[44px]"
                            onClick={toggleMenu}
                            aria-label="Toggle menu"
                        >
                            <span></span>
                            <span></span>
                            <span></span>
                        </button>
                    </div>
                </div>
            </motion.nav>

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