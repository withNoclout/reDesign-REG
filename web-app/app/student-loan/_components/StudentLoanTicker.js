'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { BellIcon } from '@/app/components/Icons';
import { LOAN_SURFACE_SUBTLE, toneClass } from './loanDashboardTheme';

function TickerItem({ item }) {
    const className = `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-prompt whitespace-nowrap ${toneClass(item.tone)}`;

    if (!item.href) {
        return <span className={className}>{item.text}</span>;
    }

    const isExternal = item.href.startsWith('http');
    if (isExternal) {
        return (
            <a href={item.href} target="_blank" rel="noreferrer" className={className}>
                {item.text}
            </a>
        );
    }

    return (
        <Link href={item.href} className={className}>
            {item.text}
        </Link>
    );
}

export default function StudentLoanTicker({ items }) {
    if (items.length === 0) return null;

    const repeatedItems = [...items, ...items];

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${LOAN_SURFACE_SUBTLE} px-4 md:px-5 py-3 overflow-hidden`}
        >
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                <div className="flex items-center gap-3 shrink-0 px-1">
                    <div className="h-9 w-9 rounded-2xl bg-white/[0.08] border border-white/10 flex items-center justify-center text-[#ff8a65] shrink-0">
                        <BellIcon size={16} />
                    </div>
                    <div>
                        <p className="text-[11px] text-white/45 font-montserrat uppercase tracking-[0.2em]">Loan News Ticker</p>
                        <p className="text-white font-semibold font-prompt">ข่าวและสถานะล่าสุด</p>
                    </div>
                </div>

                <div className="relative overflow-hidden mask-gradient-x flex-1 min-w-0">
                    <div className="student-loan-ticker-track flex items-center gap-3 w-max pr-3">
                        {repeatedItems.map((item, index) => (
                            <TickerItem key={`${item.id}-${index}`} item={item} />
                        ))}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .student-loan-ticker-track {
                    animation: student-loan-ticker 32s linear infinite;
                }

                .student-loan-ticker-track:hover {
                    animation-play-state: paused;
                }

                @keyframes student-loan-ticker {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
            `}</style>
            <style jsx global>{`
                .mask-gradient-x {
                    -webkit-mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent);
                    mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent);
                }
            `}</style>
        </motion.section>
    );
}
