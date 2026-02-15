'use client';

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import ToggleSwitch from '../components/ToggleSwitch';
import ShareLinkBox from '../components/ShareLinkBox';
import FailedUploadsBanner from '../components/FailedUploadsBanner';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import '../globals.css';

const MENU_ITEMS = [
    { id: 'profile', label: 'ข้อมูลส่วนตัว' },
    { id: 'registration', label: 'ทะเบียน' },
    { id: 'grade', label: 'ผลการเรียน' },
    { id: 'search', label: 'ค้นหาระบบ' },
    { id: 'manual', label: 'คู่มือการใช้งาน' },
    { id: 'others', label: 'อื่นๆ' }
];

const EXPIRATION_OPTIONS = [
    { value: '1h', label: '1 ชั่วโมง' },
    { value: '24h', label: '24 ชั่วโมง' },
    { value: '7d', label: '7 วัน' },
    { value: '30d', label: '30 วัน' },
    { value: 'never', label: 'ไม่มีวันหมด' }
];

export default function PortfolioSettings() {
    const { user } = useAuth();
    const [permissions, setPermissions] = useState({});
    const [expiration, setExpiration] = useState('24h');
    const [shareLink, setShareLink] = useState(null);
    const [generating, setGenerating] = useState(false);

    const togglePermission = (id) => {
        setPermissions((prev) => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const generateShareLink = async () => {
        // ... (Keep existing logic)
        const selectedModules = MENU_ITEMS
            .filter((item) => permissions[item.id])
            .map((item) => item.id);

        if (selectedModules.length === 0) {
            alert('กรุณาเลือกอย่างน้อย 1 รายการ');
            return;
        }

        setGenerating(true);

        try {
            const response = await fetch('/api/share/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    permissions: selectedModules,
                    expiration,
                    guestName: user?.name || 'Student'
                })
            });

            const data = await response.json();

            if (data.success) {
                setShareLink(data.shareLink);
            } else {
                alert(data.error || 'Failed to generate link');
            }
        } catch (err) {
            console.error('Generate share link error:', err);
            alert('เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setGenerating(false);
        }
    };

    const hasSelectedPermissions = Object.values(permissions).some((v) => v);

    // Stagger animation setup
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemAnim = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    return (
        <main className="main-content min-h-screen bg-[#0f172a]" id="main-content">
            {/* Failed Uploads Banner */}
            <FailedUploadsBanner onRetryAll={() => window.location.reload()} />

            {/* Background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                {/* Top Right Orb */}
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-primary opacity-20 blur-[100px]" />
                {/* Bottom Left Orb */}
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600 opacity-10 blur-[120px]" />
            </div>

            <Navbar activePage="others" />

            <div className="relative pt-32 pb-20 px-4 md:px-8 max-w-5xl mx-auto z-10">
                <motion.div
                    initial="hidden"
                    animate="show"
                    variants={container}
                    className="space-y-8"
                >
                    {/* Header Section */}
                    <motion.div variants={itemAnim} className="text-center md:text-left mb-10">
                        <span className="inline-block py-1 px-3 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider mb-3">
                            PORTFOLIO SETTINGS
                        </span>
                        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 font-prompt leading-tight">
                            กำหนดการมองเห็น <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50">
                                และการแชร์ข้อมูล
                            </span>
                        </h1>
                        <p className="text-white/60 text-lg max-w-2xl font-light">
                            เลือกข้อมูลที่คุณต้องการเปิดเผยในพอร์ตโฟลิโอสาธารณะ และกำหนดอายุของลิงก์แชร์
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Main Settings Panel */}
                        <motion.div variants={itemAnim} className="lg:col-span-8 space-y-8">

                            {/* Permissions Grid */}
                            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 md:p-8">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3 font-prompt">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    การเข้าถึงข้อมูล
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {MENU_ITEMS.map((item) => (
                                        <ToggleSwitch
                                            key={item.id}
                                            label={item.label}
                                            description="อนุญาตให้ผู้เข้าชมดูส่วนนี้"
                                            enabled={permissions[item.id] || false}
                                            onChange={() => togglePermission(item.id)}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Expiration Settings */}
                            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 md:p-8">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3 font-prompt">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    อายุของลิงก์
                                </h3>

                                <div className="flex flex-wrap gap-2 bg-black/20 p-2 rounded-2xl">
                                    {EXPIRATION_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => setExpiration(option.value)}
                                            className={`relative px-4 py-3 rounded-xl text-sm font-medium transition-colors flex-1 min-w-[100px] ${expiration === option.value ? 'text-white' : 'text-white/50 hover:text-white/80'
                                                }`}
                                        >
                                            {expiration === option.value && (
                                                <motion.div
                                                    layoutId="activeExpiration"
                                                    className="absolute inset-0 bg-primary rounded-xl shadow-[0_0_15px_rgba(255,87,34,0.3)]"
                                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                                />
                                            )}
                                            <span className="relative z-10">{option.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                        </motion.div>

                        {/* Sidebar / Floating Action */}
                        <motion.div variants={itemAnim} className="lg:col-span-4 space-y-6">
                            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 backdrop-blur-2xl rounded-3xl p-6 sticky top-32">
                                <h3 className="text-lg font-bold text-white mb-2 font-prompt">พร้อมแชร์แล้วใช่ไหม?</h3>
                                <p className="text-white/60 text-sm mb-6">
                                    เมื่อสร้างลิงก์แล้ว คุณสามารถส่งให้ผู้อื่นดูพอร์ตโฟลิโอของคุณได้ทันที
                                </p>

                                <button
                                    onClick={generateShareLink}
                                    disabled={generating || !hasSelectedPermissions}
                                    className="w-full py-4 bg-primary hover:bg-opacity-90 text-white rounded-xl font-bold text-lg shadow-lg shadow-orange-900/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-prompt relative overflow-hidden group cursor-pointer"
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        {generating ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                                                กำลังสร้าง...
                                            </>
                                        ) : (
                                            <>
                                                สร้างลิงก์แชร์
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:translate-x-1 transition-transform">
                                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                                                </svg>
                                            </>
                                        )}
                                    </span>
                                </button>

                                {shareLink && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-6"
                                    >
                                        <ShareLinkBox link={shareLink} />
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </main>
    );
}