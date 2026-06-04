'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { logError } from '@/lib/logger';
import { HomeIcon, RefreshCwIcon } from './components/Icons';

/**
 * Next.js Error Boundary
 * Catches errors in the app and displays a friendly error page
 * 
 * This file is a Next.js 14 convention for handling errors
 */
export default function Error({ error, reset }) {
    useEffect(() => {
        // Log error to console (can be extended to error tracking service)
        console.error('Application Error:', error);
        logError(error, 'GlobalErrorPage');
    }, [error]);

    return (
        <main className="min-h-screen flex items-center justify-center p-4" id="main-content">
            {/* Background */}
            <div className="bg-image" aria-hidden="true" />
            <div className="bg-overlay" aria-hidden="true" />

            {/* Error Card */}
            <motion.div
                className="glass-card max-w-md w-full p-8 text-center relative z-10 border-red-500/50 shadow-red-500/20"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                role="alert"
                aria-live="assertive"
            >
                {/* Error Icon */}
                <motion.div
                    className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center"
                    initial={{ rotate: 0 }}
                    animate={{ rotate: [0, -10, 10, -10, 0] }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <svg 
                        width="40" 
                        height="40" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2"
                        className="text-red-400"
                        aria-hidden="true"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                </motion.div>

                {/* Error Message */}
                <h1 className="text-2xl font-bold mb-3 text-white">
                    เกิดข้อผิดพลาด
                </h1>
                <p className="text-gray-300 mb-2">
                    Something went wrong!
                </p>
                <p className="text-sm text-gray-400 mb-6">
                    เราขออภัยในความไม่สะดวก กรุณาลองอีกครั้ง
                </p>

                {/* Error Details (for development) */}
                {process.env.NODE_ENV === 'development' && (
                    <details className="mb-6 text-left">
                        <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-300 mb-2">
                            รายละเอียดข้อผิดพลาด (Developer Mode)
                        </summary>
                        <div className="bg-black/30 rounded-lg p-3 mt-2 text-xs text-red-300 font-mono overflow-auto max-h-40">
                            {error?.message || 'Unknown error'}
                        </div>
                    </details>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <motion.button
                        onClick={reset}
                        className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 min-h-[44px]"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        aria-label="ลองอีกครั้ง"
                    >
                        <RefreshCwIcon size={14} className="inline mr-1" /> ลองอีกครั้ง
                    </motion.button>
                    
                    <motion.a
                        href="/"
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-xl border border-white/20 transition-all duration-200 flex items-center justify-center min-h-[44px]"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        aria-label="กลับหน้าหลัก"
                    >
                        <HomeIcon size={16} className="inline mr-1" /> หน้าหลัก
                    </motion.a>
                </div>

                {/* Footer Help Text */}
                <p className="text-xs text-gray-500 mt-6">
                    หากปัญหายังคงอยู่ กรุณาติดต่อผู้ดูแลระบบ
                </p>
            </motion.div>
        </main>
    );
}
