'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FailedUploadsBanner({ onRetryAll, onDismiss }) {
    const [isVisible, setIsVisible] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const [failedCount, setFailedCount] = useState(0);

    // Check for failed uploads on mount
    useEffect(() => {
        checkFailedUploads();
    }, []);

    const checkFailedUploads = async () => {
        try {
            const res = await fetch('/api/portfolio/content');
            if (res.ok) {
                const data = await res.json();
                const failedItems = data.data?.filter(
                    item => !item.uploaded_to_supabase && item.temp_path
                );

                setFailedCount(failedItems.length);
                setIsVisible(failedItems.length > 0);
            }
        } catch (error) {
            console.error('[FailedUploadsBanner] Error checking uploads:', error);
        }
    };

    const handleRetryAll = async () => {
        setIsRetrying(true);

        try {
            const res = await fetch('/api/portfolio/batch-upload', {
                method: 'POST',
            });

            const data = await res.json();

            if (data.success && data.summary) {
                const { uploaded, failed } = data.summary;

                // Show success message
                if (uploaded > 0) {
                    alert(`✅ อัพโหลดสำเร็จ ${uploaded} รายการ`);
                }

                if (failed > 0) {
                    alert(`⚠️ อัพโหลดไม่สำเร็จ ${failed} รายการ`);
                }

                // Refresh the check
                await checkFailedUploads();

                // Trigger refresh if callback provided
                if (onRetryAll) {
                    onRetryAll();
                }
            } else {
                alert('❌ ไม่สามารถอัพโหลดใหม่ได้: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('[FailedUploadsBanner] Retry error:', error);
            alert('❌ เกิดข้อผิดพลาด: ' + error.message);
        } finally {
            setIsRetrying(false);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        if (onDismiss) {
            onDismiss();
        }
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-orange-600/95 to-red-600/95 backdrop-blur-sm border-b border-orange-500/30 shadow-2xl"
                >
                    <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex-shrink-0">
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="text-white animate-pulse"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-white font-semibold text-sm md:text-base">
                                    พบ {failedCount} รายการที่อัพโหลดไม่สำเร็จ
                                </p>
                                <p className="text-white/80 text-xs md:text-sm mt-0.5">
                                    รูปภาพยังไม่ถูกอัพโหลดไปยังคลังข้อมูล
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={handleRetryAll}
                                disabled={isRetrying}
                                className="px-4 py-2 bg-white text-orange-600 rounded-lg font-bold text-sm hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                            >
                                {isRetrying ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span>กำลังอัพโหลด...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M23 4v6h-6" />
                                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                        </svg>
                                        <span>ลองใหม่ทั้งหมด</span>
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleDismiss}
                                className="p-2 text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                                title="ปิด"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}