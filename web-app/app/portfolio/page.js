'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import ToggleSwitch from '../components/ToggleSwitch';
import FailedUploadsBanner from '../components/FailedUploadsBanner';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { LockIcon } from '../components/Icons';
import '../globals.css';

const MENU_ITEMS = [
    { id: 'profile', label: 'ข้อมูลส่วนตัว' },
    { id: 'registration', label: 'ทะเบียน' },
    { id: 'grade', label: 'ผลการเรียน' },
    { id: 'search', label: 'ค้นหาระบบ' },
    { id: 'manual', label: 'คู่มือการใช้งาน' },
    { id: 'others', label: 'อื่นๆ' }
];

export default function PortfolioSettings() {
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const router = useRouter();
    const [permissions, setPermissions] = useState({});
    const [exporting, setExporting] = useState(false);

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, authLoading, router]);

    const togglePermission = (id) => {
        setPermissions((prev) => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const exportHtml = async () => {
        const selectedModules = MENU_ITEMS
            .filter((item) => permissions[item.id])
            .map((item) => item.id);

        if (selectedModules.length === 0) {
            alert('กรุณาเลือกอย่างน้อย 1 รายการ');
            return;
        }

        setExporting(true);

        try {
            const response = await fetch('/api/export/portfolio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    permissions: selectedModules,
                    guestName: user?.name || 'Student'
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to generate HTML');
            }

            // Get HTML string as blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `portfolio_${user?.username || 'student'}_export.html`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export HTML error:', err);
            alert('เกิดข้อผิดพลาด กรุณาลองใหม่: ' + err.message);
        } finally {
            setExporting(false);
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

    // Loading State
    if (authLoading) {
        return (
            <main className="main-content min-h-screen bg-[#0f172a] flex items-center justify-center">
                <div className="text-center text-white">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
                    <p>กำลังตรวจสอบสิทธิ์...</p>
                </div>
            </main>
        );
    }

    // Access Denied State (briefly seen before redirect)
    if (!isAuthenticated) {
        return (
            <main className="main-content min-h-screen bg-[#0f172a] flex items-center justify-center">
                <div className="text-center text-white">
                    <div className="text-6xl mb-4 flex justify-center text-red-500"><LockIcon size={64} /></div>
                    <h1 className="text-2xl font-bold mb-2 font-prompt">ต้องเข้าสู่ระบบ</h1>
                    <p className="text-white/60">ระบบกำลังพากลับไปยังหน้าหลัก...</p>
                </div>
            </main>
        );
    }

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
                                และส่งออกข้อมูล (ออฟไลน์)
                            </span>
                        </h1>
                        <p className="text-white/60 text-lg max-w-2xl font-light">
                            เลือกข้อมูลที่คุณต้องการเปิดเผยในพอร์ตโฟลิโอ แล้วดาวน์โหลดเป็นไฟล์ HTML เพื่อส่งให้ผู้อื่นดูแบบออฟไลน์
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

                            {/* Note: Expiration removed for Static HTML Export approach */}

                        </motion.div>

                        {/* Sidebar / Floating Action */}
                        <motion.div variants={itemAnim} className="lg:col-span-4 space-y-6">
                            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 backdrop-blur-2xl rounded-3xl p-6 sticky top-32">
                                <h3 className="text-lg font-bold text-white mb-2 font-prompt">พร้อมดาวน์โหลด?</h3>
                                <p className="text-white/60 text-sm mb-6">
                                    ระบบจะดาวน์โหลดไฟล์ HTML คุณสามารถแนบส่งให้ผู้อื่นในแชทให้เปิดดูได้ทันที
                                </p>

                                <button
                                    onClick={exportHtml}
                                    disabled={exporting || !hasSelectedPermissions}
                                    className="w-full py-4 bg-primary hover:bg-opacity-90 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 transition-all hover:-translate-y-1 hover:shadow-primary/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-primary/20 font-prompt relative overflow-hidden group cursor-pointer"
                                >
                                    {/* Hover Glow Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />

                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        {exporting ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                                                กำลังสร้างไฟล์...
                                            </>
                                        ) : (
                                            <>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-y-1 transition-transform group-hover:animate-pulse">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="7 10 12 15 17 10" />
                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                </svg>
                                                ดาวน์โหลดไฟล์ HTML
                                            </>
                                        )}
                                    </span>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </main>
    );
}