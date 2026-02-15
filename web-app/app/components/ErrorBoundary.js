'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { logError } from '@/lib/logger';
import { RefreshCwIcon } from './Icons';

/**
 * React Error Boundary Component
 * Can be used to wrap specific components that might throw errors
 * 
 * Usage:
 * <ErrorBoundary fallback={<CustomFallback />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so next render shows fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log error to console (can be extended to error tracking service)
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        logError(error, 'ErrorBoundary');
        
        this.setState({
            error,
            errorInfo
        });
    }

    resetError = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render() {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI with glassmorphism
            return (
                <motion.div
                    className="glass-card p-6 my-4 border-red-500/50 shadow-red-500/20"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="flex items-start gap-4">
                        {/* Error Icon */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                            <svg 
                                width="20" 
                                height="20" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2"
                                className="text-red-400"
                                aria-hidden="true"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>

                        {/* Error Content */}
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-1">
                                เกิดข้อผิดพลาดในส่วนนี้
                            </h3>
                            <p className="text-sm text-gray-300 mb-3">
                                Component encountered an error. Please try again.
                            </p>

                            {/* Error Details (development only) */}
                            {process.env.NODE_ENV === 'development' && this.state.error && (
                                <details className="mb-3">
                                    <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300 mb-2">
                                        Error Details (Dev Mode)
                                    </summary>
                                    <div className="bg-black/30 rounded-lg p-3 mt-2 text-xs text-red-300 font-mono overflow-auto max-h-32">
                                        <strong>Error:</strong> {this.state.error.toString()}
                                        {this.state.errorInfo && (
                                            <>
                                                <br /><br />
                                                <strong>Stack Trace:</strong>
                                                <pre className="whitespace-pre-wrap">
                                                    {this.state.errorInfo.componentStack}
                                                </pre>
                                            </>
                                        )}
                                    </div>
                                </details>
                            )}

                            {/* Retry Button */}
                            <motion.button
                                onClick={this.resetError}
                                className="bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-4 rounded-lg border border-white/20 transition-all duration-200 text-sm min-h-[44px]"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                aria-label="ลองอีกครั้ง"
                            >
                                <RefreshCwIcon size={14} className="inline mr-1" /> ลองอีกครั้ง
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
