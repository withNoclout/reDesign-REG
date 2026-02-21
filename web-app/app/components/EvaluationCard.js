'use client';

import { motion } from 'framer-motion';
import { UserCheckIcon, ClockIcon, AlertTriangleIcon, ZapIcon } from './Icons';

export default function EvaluationCard({ item, onEvaluate, onAutoEvaluate }) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="group relative overflow-hidden bg-[rgba(255,255,255,0.08)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-3xl p-6 hover:bg-[rgba(255,255,255,0.12)] transition-all duration-300 shadow-xl hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
        >
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">

                {/* Left Section: Teacher Info */}
                <div className="flex items-start md:items-center gap-5">
                    <div className="w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-2xl bg-[rgba(255,87,34,0.15)] flex items-center justify-center border border-[rgba(255,87,34,0.3)]">
                        <UserCheckIcon size={28} className="text-[#ff5722]" />
                    </div>
                    <div>
                        <h3 className="text-lg md:text-xl font-bold text-white mb-1 group-hover:text-[#ff5722] transition-colors font-prompt">
                            {item.officer_name}
                        </h3>
                        <div className="flex flex-col md:flex-row gap-y-1 gap-x-4 text-white/60 text-sm font-montserrat">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722]" />
                                <span className="font-bold text-white/80">{item.course_code}</span>
                                <span className="font-prompt ml-1 truncate max-w-[200px] md:max-w-[300px]">{item.course_name}</span>
                            </span>
                            <span className="flex items-center gap-1.5 text-white/50">
                                <ClockIcon size={14} />
                                Sec {item.section}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Section: Action */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t border-white/10 md:border-0">
                    <div className="flex-1 md:flex-none flex justify-between md:justify-end items-center w-full md:w-auto md:mr-4">
                        <div className="flex flex-col md:items-end">
                            <span className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1 font-montserrat">
                                <AlertTriangleIcon size={12} /> Pending
                            </span>
                            <span className="text-white/40 text-[10px] font-montserrat">{item.eva_date}</span>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={() => onAutoEvaluate && onAutoEvaluate(item)}
                            className="flex-1 md:flex-none py-2.5 px-4 rounded-xl bg-[rgba(255,87,34,0.15)] border border-[rgba(255,87,34,0.3)] text-[#ff5722] font-bold hover:bg-[#ff5722] hover:text-white transition-all duration-300 flex items-center justify-center gap-2 group/auto"
                            title="Auto Evaluate"
                        >
                            <ZapIcon size={16} className="group-hover/auto:animate-pulse" />
                            <span className="md:hidden">Auto</span>
                        </button>

                        <button
                            onClick={() => onEvaluate(item)}
                            className="flex-[2] md:flex-none py-2.5 px-6 rounded-xl bg-white text-gray-900 font-bold hover:bg-gray-200 transition-all duration-300 flex items-center justify-center font-prompt"
                        >
                            ประเมินผล
                        </button>
                    </div>
                </div>
            </div>

            {/* Very subtle background decoration */}
            <div className="absolute top-[-20%] right-[-5%] opacity-[0.02] pointer-events-none transform rotate-12 scale-150">
                <UserCheckIcon size={120} />
            </div>
        </motion.div>
    );
}
