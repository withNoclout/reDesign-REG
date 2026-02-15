'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { shake } from '@/lib/animations';

/**
 * ErrorAlert Component
 * Consistent error display across all pages
 * 
 * @param {string} message - Error message to display
 * @param {string} type - Error type ('error', 'warning', 'info', 'success')
 * @param {function} onDismiss - Callback when dismissed
 */
export default function ErrorAlert({ message, type = 'error', onDismiss }) {
    if (!message) return null;

    const typeStyles = {
        error: {
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
            ),
            borderColor: 'border-red-500/50',
            iconColor: 'text-red-400',
            glowColor: 'shadow-red-500/20'
        },
        warning: {
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            ),
            borderColor: 'border-yellow-500/50',
            iconColor: 'text-yellow-400',
            glowColor: 'shadow-yellow-500/20'
        },
        info: {
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
            ),
            borderColor: 'border-blue-500/50',
            iconColor: 'text-blue-400',
            glowColor: 'shadow-blue-500/20'
        },
        success: {
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
            ),
            borderColor: 'border-green-500/50',
            iconColor: 'text-green-400',
            glowColor: 'shadow-green-500/20'
        }
    };

    const currentStyle = typeStyles[type] || typeStyles.error;

    return (
        <AnimatePresence>
            {message && (
                <motion.div
                    className={`error-message glass-card ${currentStyle.borderColor} ${currentStyle.glowColor}`}
                    role="alert"
                    aria-live="assertive"
                    aria-atomic="true"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="error-content">
                        <span className={`error-icon ${currentStyle.iconColor}`}>
                            {currentStyle.icon}
                        </span>
                        <span className="error-text">{message}</span>
                        {onDismiss && (
                            <motion.button
                                className="error-close"
                                onClick={onDismiss}
                                aria-label="ปิดข้อความแจ้งเตือน"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </motion.button>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}