'use client';

import { motion } from 'framer-motion';

/**
 * ToggleSwitch - Premium Glassmorphism Toggle
 * Uses semantic HTML button for accessibility and Framer Motion for animations.
 * Complies with UI/UX Pro Max rules (no layout shift, clear contrast).
 */
export default function ToggleSwitch({ enabled, onChange, label, description }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onChange(!enabled)}
            className="group w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl cursor-pointer transition-all active:scale-[0.99] text-left"
        >
            <div className="flex flex-col pr-4">
                <span className="text-white font-medium font-prompt text-lg">{label}</span>
                {description && (
                    <span className="text-white/40 text-sm font-prompt leading-tight mt-1">{description}</span>
                )}
            </div>

            <div className="relative flex-shrink-0 flex items-center gap-3">
                {/* Status Text Indicator */}
                <span className={`text-xs font-bold tracking-wider ${enabled ? 'text-[#4ade80]' : 'text-white/30'}`}>
                    {enabled ? 'แสดง' : 'ซ่อน'}
                </span>

                <div className="relative">
                    {/* Glow Effect */}
                    <div className={`absolute inset-0 rounded-full blur-md transition-opacity duration-500 ${enabled ? 'opacity-50 bg-[#4ade80]' : 'opacity-0'}`} />

                    {/* Switch Track */}
                    <motion.div
                        className={`relative w-14 h-8 rounded-full flex items-center p-1 transition-colors duration-300 ${enabled ? 'bg-[#4ade80]' : 'bg-white/10'}`}
                        animate={{ backgroundColor: enabled ? '#4ade80' : 'rgba(255,255,255,0.1)' }}
                    >
                        {/* Switch Handle */}
                        <motion.div
                            layout
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="w-6 h-6 bg-white rounded-full shadow-lg"
                            animate={{ x: enabled ? 24 : 0 }}
                        />
                    </motion.div>
                </div>
            </div>
        </button>
    );
}