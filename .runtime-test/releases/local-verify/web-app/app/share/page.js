'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGuest } from '../context/GuestContext';
import Navbar from '../components/Navbar';
import GuestBanner from '../components/GuestBanner';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { LightbulbIcon } from '../components/Icons';
import '../globals.css';

export default function SharePage() {
    const { isGuest, loading, guestName } = useGuest();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !isGuest) {
            // Not a valid guest, redirect to login
            router.push('/');
        }
    }, [isGuest, loading, router]);

    if (loading) {
        return (
            <main className="main-content">
                <div className="bg-image"></div>
                <div className="bg-overlay"></div>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-white text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                        <p className="mt-4">กำลังตรวจสอบลิงก์...</p>
                    </div>
                </div>
            </main>
        );
    }

    if (!isGuest) {
        return null;
    }

    return (
        <main className="main-content">
            <div className="bg-image"></div>
            <div className="bg-overlay"></div>

            <GuestBanner guestName={guestName} />
            <Navbar activePage="profile" />

            <div className="main-container pt-32 pb-20 px-4 md:px-8 max-w-7xl mx-auto">
                <motion.div
                    {...fadeInUp}
                    className="text-center py-20"
                >
                    <div className="inline-block p-6 bg-[#4ade80]/20 rounded-full mb-6">
                        <svg className="w-16 h-16 text-[#4ade80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-4 font-prompt">
                        พอร์ตโฟลิโอของ {guestName}
                    </h1>
                    <p className="text-white/60 text-lg mb-8 max-w-2xl mx-auto">
                        ยินดีต้อนรับสู่พอร์ตโฟลิโอของนักศึกษา<br />
                        ใช้เมนูด้านบนเพื่อดูข้อมูลที่ได้รับอนุญาต
                    </p>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-[rgba(15,23,42,0.6)] backdrop-blur-lg border border-white/10 rounded-2xl p-6 max-w-lg mx-auto"
                    >
                        <p className="text-white/80 text-sm">
                            <LightbulbIcon size={14} className="inline mr-1" /> <span className="font-medium">เคล็ด:</span> รายการที่ถูกล็อกแสดงว่าไม่ได้รับอนุญาตให้ดู
                        </p>
                    </motion.div>
                </motion.div>
            </div>
        </main>
    );
}