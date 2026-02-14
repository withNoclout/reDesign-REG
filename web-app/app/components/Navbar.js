'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useGuest } from '../context/GuestContext';
import { useRouter } from 'next/navigation';
import {
    navbarSlideDown,
    logoAppear,
    menuItemSlide,
    buttonPress,
    pulseGlow,
    fadeInUp,
    staggerContainer,
    staggerItem,
    TIMING
} from '../lib/animations';

// Menu configuration
const MENU_ITEMS = [
    { id: 'profile', icon: 'profile', label: 'ข้อมูลส่วนตัว', active: false, href: '/landing' },
    { id: 'registration', icon: 'registration', label: 'ทะเบียน', active: false, href: '#' },
    {
        id: 'grade',
        icon: 'grade',
        label: 'ผลการเรียน',
        active: false,
        href: '#',
        submenu: [
            { id: 'grade-total', label: 'ผลการเรียนรวม', href: '/grade' }
        ]
    },
    { id: 'search', icon: 'search', label: 'ค้นหาระบบ', active: false, href: '#' },
    { id: 'manual', icon: 'manual', label: 'คู่มือการใช้งาน', active: false, href: '#' },
    {
        id: 'others',
        icon: 'others',
        label: 'อื่นๆ',
        active: false,
        href: '#',
        submenu: [
            { id: 'portfolio-settings', label: 'กำหนดการมองเห็น', href: '/portfolio' }
        ]
    }
];

// Icons
const Icons = {
    profile: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    ),
    registration: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
    ),
    grade: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
    ),
    search: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    ),
    manual: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    ),
    others: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
        </svg>
    )
};

export default function Navbar({ activePage = 'profile' }) {
    const { user, logout: handleLogout } = useAuth();
    const { isGuest, allowedModules, guestName } = useGuest();
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const router = useRouter();

    const toggleMenu = () => setMenuOpen(!menuOpen);

    // Check if a menu item is accessible
    const isMenuAccessible = (itemId) => {
        if (!isGuest) return true; // Owner can access everything
        return allowedModules.includes(itemId);
    };

    // Detect scroll for frosted glass navbar effect
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 10);
        };

        // Check initial scroll position
        handleScroll();

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Update active state in MENU_ITEMS based on prop
    const items = MENU_ITEMS.map(item => ({
        ...item,
        active: item.id === activePage
    }));

    return (
        <motion.nav
            className={`navbar ${menuOpen ? 'active' : ''} ${scrolled ? 'scrolled' : ''}`}
            id="navbar"
            {...navbarSlideDown}
        >
            <div className="nav-container">
                <a href="/landing" className="nav-brand">
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

                <motion.ul
                    className={`nav-menu ${menuOpen ? 'active' : ''}`}
                    variants={staggerContainer}
                    initial="show"
                    animate="show"
                >
                    {items.map((item, index) => {
                        const IconComponent = Icons[item.icon];
                        const hasSubmenu = item.submenu && item.submenu.length > 0;

                        const accessible = isMenuAccessible(item.id);

                        return (
                            <motion.li
                                key={item.id}
                                variants={staggerItem}
                                className={`relative group ${hasSubmenu ? 'has-submenu' : ''} ${!accessible ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {accessible ? (
                                    <>
                                        <motion.a
                                            href={item.href}
                                            className={`nav-link min-h-[44px] flex items-center ${item.active ? 'active' : ''}`}
                                            {...menuItemSlide}
                                            transition={{ delay: index * TIMING.stagger }}
                                        >
                                            <IconComponent />
                                            {item.label}
                                            {hasSubmenu && (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1 opacity-70 group-hover:rotate-180 transition-transform">
                                                    <path d="M6 9l6 6 6-6" />
                                                </svg>
                                            )}
                                        </motion.a>

                                        {/* Dropdown Menu */}
                                        <AnimatePresence>
                                            {hasSubmenu && (
                                                <div className="absolute top-full left-0 pt-2 hidden group-hover:block min-w-[200px] z-50">
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, y: -10 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="bg-[rgba(15,23,42,0.95)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-xl py-2 shadow-xl overflow-hidden"
                                                    >
                                                        {item.submenu.map((subItem) => {
                                                            // Portfolio settings should not be accessible to guests
                                                            const isPortfolioSettings = subItem.id === 'portfolio-settings';
                                                            const canAccessSubmenu = !isGuest || !isPortfolioSettings;

                                                            return canAccessSubmenu ? (
                                                                <a
                                                                    key={subItem.id}
                                                                    href={subItem.href}
                                                                    className="block px-4 py-3 text-sm text-[rgba(255,255,255,0.8)] hover:text-[#ff5722] hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center justify-between group/sub"
                                                                >
                                                                    {subItem.label}
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-0 group-hover/sub:opacity-100 -translate-x-2 group-hover/sub:translate-x-0 transition-all text-[#ff5722]">
                                                                        <polyline points="9 18 15 12 9 6" />
                                                                    </svg>
                                                                </a>
                                                            ) : (
                                                                <div
                                                                    key={subItem.id}
                                                                    className="block px-4 py-3 text-sm text-[rgba(255,255,255,0.4)] cursor-not-allowed flex items-center justify-between"
                                                                    title="ไม่ได้รับอนุญาตให้เข้าถึง"
                                                                >
                                                                    <span>{subItem.label}</span>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                                                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                                    </svg>
                                                                </div>
                                                            );
                                                        })}
                                                    </motion.div>
                                                </div>
                                            )}
                                        </AnimatePresence>
                                    </>
                                ) : (
                                    <motion.a
                                        href="#"
                                        onClick={(e) => e.preventDefault()}
                                        className={`nav-link min-h-[44px] flex items-center ${item.active ? 'active' : ''}`}
                                        title="ไม่ได้รับอนุญาตให้ดู"
                                        {...menuItemSlide}
                                        transition={{ delay: index * TIMING.stagger }}
                                    >
                                        <IconComponent />
                                        {item.label}
                                        {hasSubmenu && (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1 opacity-70">
                                                <path d="M6 9l6 6 6-6" />
                                            </svg>
                                        )}
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" className="ml-2">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                    </motion.a>
                                )}
                            </motion.li>
                        );
                    })}
                </motion.ul>

                <div className="nav-right">
                    <motion.div
                        className="flex items-center gap-3 mr-4"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: TIMING.normal }}
                    >
                        {/* Profile Image in Navbar */}
                        <div className="h-10 w-10 rounded-full overflow-hidden border border-white/20 bg-white/10 relative">
                            {user?.img ? (
                                <img
                                    src={user.img}
                                    alt="Profile"
                                    className="h-full w-full object-cover"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center text-white/50 text-sm font-bold">
                                    {(user?.username || 'U').charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>

                        <span className="text-white text-sm font-medium hidden md:block font-prompt">
                            {user?.name || user?.username || 'User'}
                        </span>
                    </motion.div>
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
    );
}
