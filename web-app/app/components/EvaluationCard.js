'use client';

import { motion } from 'framer-motion';

// Local SVG icons to avoid lucide-react build error
const UserCheck = ({ className }) => (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <polyline points="17 11 19 13 23 9" />
    </svg>
);

const AlertCircle = ({ className, size = 24 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
);

const Clock = ({ className }) => (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);

const ChevronRight = ({ className }) => (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
    </svg>
);

export default function EvaluationCard({ item, onEvaluate }) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="group relative overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all duration-300 shadow-xl"
        >
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/0 via-orange-500/20 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur" />

            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">

                {/* Left Section: Teacher Info */}
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <UserCheck className="text-white w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-orange-300 transition-colors">
                            {item.officer_name}
                        </h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-white/50 text-sm">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                {item.course_code} {item.course_name}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                Section {item.section}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Section: Action */}
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex flex-col items-end mr-4 hidden sm:flex">
                        <span className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Still Unevaluated
                        </span>
                        <span className="text-white/30 text-[10px]">{item.eva_date}</span>
                    </div>

                    <button
                        onClick={() => onEvaluate(item)}
                        className="flex-1 md:flex-none py-3 px-8 rounded-2xl bg-white text-gray-900 font-bold hover:bg-orange-400 hover:text-white transition-all duration-300 shadow-lg hover:shadow-orange-500/40 flex items-center justify-center gap-2"
                    >
                        ประเมินผล
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Background Decorations */}
            <div className="absolute top-0 right-0 -tr-1/4 opacity-[0.03] pointer-events-none">
                <AlertCircle size={150} />
            </div>
        </motion.div>
    );
}
