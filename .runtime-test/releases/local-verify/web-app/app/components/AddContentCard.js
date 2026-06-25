'use client';

import { motion } from 'framer-motion';

export default function AddContentCard({ onClick, className = '' }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`group flex-grow relative rounded-2xl overflow-hidden cursor-pointer border-2 border-dashed border-white/20 hover:border-[#ff5722]/50 transition-colors bg-white/5 min-h-[300px] ${className}`}
            onClick={onClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
            role="button"
            tabIndex={0}
            aria-label="Add new content to portfolio"
        >
            {/* Background Pattern (CSS Gradient) */}
            <div
                className="absolute inset-0 opacity-20"
                style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '24px 24px'
                }}
            />

            {/* Center Plus Icon (Default State) */}
            <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 group-hover:opacity-0">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="opacity-50">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </div>

            {/* Hover State: Blur & Button */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3 pb-8">
                <motion.div
                    initial={{ scale: 1 }}
                    whileHover={{ scale: 1.1 }}
                    className="w-12 h-12 rounded-full bg-[#ff5722] flex items-center justify-center shadow-lg shadow-orange-500/30"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </motion.div>
                <span className="text-white font-prompt font-bold tracking-wider uppercase text-sm">Add Content</span>
            </div>
        </motion.div>
    );
}
