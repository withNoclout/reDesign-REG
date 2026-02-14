'use client';

import { motion } from 'framer-motion';

/**
 * ToggleSwitch - Premium Glassmorphism Toggle
 * Uses Framer Motion for spring physics and layout animations.
 */
export default function ToggleSwitch({ enabled, onChange, label, description }) {
    return (
        <div
            onClick={() => onChange(!enabled)}
            className="group flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl cursor-pointer transition-all active:scale-[0.99]"
        >
            <div className="flex flex-col">
                <span className="text-white font-medium font-prompt text-lg">{label}</span>
                {description && (
                    <span className="text-white/40 text-sm font-prompt">{description}</span>
                )}
            </div>

            <div className="relative">
                {/* Glow Effect */}
                <div className={`absolute inset-0 rounded-full blur-md transition-opacity duration-500 ${enabled ? 'opacity-50 bg-[#ff5722]' : 'opacity-0'}`} />

                {/* Switch Track */}
                <motion.div
                    className={`relative w-14 h-8 rounded-full flex items-center p-1 transition-colors duration-300 ${enabled ? 'bg-[#ff5722]' : 'bg-white/10'}`}
                    animate={{ backgroundColor: enabled ? '#ff5722' : 'rgba(255,255,255,0.1)' }}
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
    );
}