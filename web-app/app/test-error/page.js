'use client';

import { useState } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import { motion } from 'framer-motion';
import { ShieldIcon, CheckIcon, BookOpenIcon, BombIcon, ZapIcon } from '../components/Icons';

/**
 * Test component that can throw errors on demand
 * Used to test the ErrorBoundary component
 */
function BuggyComponent({ shouldThrow }) {
    if (shouldThrow) {
        throw new Error('💥 This is a test error from BuggyComponent!');
    }

    return (
        <div className="glass-card p-4 border-green-500/50 shadow-green-500/20">
            <div className="flex items-center gap-2 text-green-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span className="text-white">Component is working correctly! <CheckIcon size={14} className="inline" /></span>
            </div>
        </div>
    );
}

/**
 * Error Boundary Test Page
 * Demonstrates both error.js and ErrorBoundary.js functionality
 */
export default function ErrorBoundaryTest() {
    const [throwError, setThrowError] = useState(false);
    const [throwPageError, setThrowPageError] = useState(false);

    // This will be caught by error.js (page-level error)
    if (throwPageError) {
        throw new Error('💥 This is a test PAGE ERROR! (caught by error.js)');
    }

    return (
        <div className="min-h-screen p-8">
            {/* Background */}
            <div className="bg-image" />
            <div className="bg-overlay" />

            <div className="max-w-4xl mx-auto relative z-10 pt-20">
                {/* Header */}
                <motion.div
                    className="glass-card p-8 mb-6"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h1 className="text-3xl font-bold text-white mb-2">
                        <ShieldIcon size={20} className="inline mr-2" /> Error Boundary Test Page
                    </h1>
                    <p className="text-gray-300">
                        Test error handling with Next.js error.js and React ErrorBoundary
                    </p>
                </motion.div>

                {/* Test Buttons */}
                <motion.div
                    className="glass-card p-6 mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <h2 className="text-xl font-semibold text-white mb-4">Test Controls</h2>
                    
                    <div className="space-y-3">
                        {/* Test Component Error (caught by ErrorBoundary) */}
                        <div>
                            <p className="text-sm text-gray-400 mb-2">
                                Test 1: Component-level error (caught by ErrorBoundary)
                            </p>
                            <motion.button
                                onClick={() => setThrowError(true)}
                                className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/50 font-medium py-3 px-4 rounded-lg transition-all duration-200 min-h-[44px]"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <BombIcon size={16} className="inline mr-1" /> Throw Component Error
                            </motion.button>
                        </div>

                        {/* Test Page Error (caught by error.js) */}
                        <div>
                            <p className="text-sm text-gray-400 mb-2">
                                Test 2: Page-level error (caught by error.js)
                            </p>
                            <motion.button
                                onClick={() => setThrowPageError(true)}
                                className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50 font-medium py-3 px-4 rounded-lg transition-all duration-200 min-h-[44px]"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <ZapIcon size={16} className="inline mr-1" /> Throw Page Error
                            </motion.button>
                        </div>

                        {/* Reset */}
                        <div>
                            <p className="text-sm text-gray-400 mb-2">
                                Reset all errors
                            </p>
                            <motion.button
                                onClick={() => {
                                    setThrowError(false);
                                    setThrowPageError(false);
                                }}
                                className="w-full bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/50 font-medium py-3 px-4 rounded-lg transition-all duration-200 min-h-[44px]"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <CheckIcon size={14} className="inline mr-1" /> Reset
                            </motion.button>
                        </div>
                    </div>
                </motion.div>

                {/* Test Component with ErrorBoundary */}
                <motion.div
                    className="mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <h2 className="text-xl font-semibold text-white mb-3">
                        Component with Error Boundary
                    </h2>
                    
                    <ErrorBoundary>
                        <BuggyComponent shouldThrow={throwError} />
                    </ErrorBoundary>
                </motion.div>

                {/* Documentation */}
                <motion.div
                    className="glass-card p-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <h2 className="text-xl font-semibold text-white mb-3">
                        <BookOpenIcon size={16} className="inline mr-1" /> How It Works
                    </h2>
                    
                    <div className="space-y-3 text-sm text-gray-300">
                        <div className="bg-black/20 rounded-lg p-3">
                            <strong className="text-yellow-400">error.js</strong> - Next.js convention
                            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                                <li>Catches page-level errors</li>
                                <li>Provides global error fallback UI</li>
                                <li>Located at: <code className="text-blue-400">app/error.js</code></li>
                            </ul>
                        </div>

                        <div className="bg-black/20 rounded-lg p-3">
                            <strong className="text-green-400">ErrorBoundary.js</strong> - React component
                            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                                <li>Catches component-level errors</li>
                                <li>Can wrap specific sections</li>
                                <li>Located at: <code className="text-blue-400">app/components/ErrorBoundary.js</code></li>
                            </ul>
                        </div>

                        <div className="bg-black/20 rounded-lg p-3">
                            <strong className="text-blue-400">Usage Example:</strong>
                            <pre className="mt-2 text-xs bg-black/40 p-2 rounded overflow-x-auto">
{`<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>`}
                            </pre>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10">
                        <a 
                            href="/" 
                            className="text-orange-400 hover:text-orange-300 text-sm flex items-center gap-2"
                        >
                            ← กลับหน้าหลัก
                        </a>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
