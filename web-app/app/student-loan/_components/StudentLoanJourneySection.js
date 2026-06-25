'use client';

import { AlertTriangleIcon, ChevronRightIcon, ClockIcon, ListIcon } from '@/app/components/Icons';
import { formatThaiDateTime } from './studentLoanViewModel';
import { LOAN_SURFACE, LOAN_SURFACE_EMBED, toneClass } from './loanDashboardTheme';

function FeedItem({ item }) {
    return (
        <a
            href={item.href || '#'}
            target={item.href?.startsWith('http') ? '_blank' : undefined}
            rel={item.href?.startsWith('http') ? 'noreferrer' : undefined}
            className={`${LOAN_SURFACE_EMBED} block p-4 transition-colors hover:bg-white/[0.08] md:p-5`}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-[0.16em] px-2 py-1 rounded-full border border-white/10 bg-white/[0.05] text-white/70">
                            {item.eyebrow}
                        </span>
                        <span className={`text-[10px] uppercase tracking-[0.16em] px-2 py-1 rounded-full border ${toneClass(item.tone)}`}>
                            {item.statusLabel}
                        </span>
                    </div>
                    <p className="mt-3 text-base font-semibold text-white font-prompt md:text-lg">{item.title}</p>
                    <p className="mt-2 text-sm text-white/60 font-prompt leading-relaxed">{item.description}</p>

                    {item.schedule && (
                        <div className="mt-4 grid gap-3 text-xs text-white/55 font-montserrat md:grid-cols-2">
                            <div className="flex items-center gap-2"><ClockIcon size={13} /> เปิด: {formatThaiDateTime(item.schedule.opensAt)}</div>
                            <div className="flex items-center gap-2"><AlertTriangleIcon size={13} /> ปิด: {formatThaiDateTime(item.schedule.closesAt)}</div>
                        </div>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-xs text-white/40 font-montserrat">{item.meta}</p>
                        {item.ctaLabel && item.href && (
                            <span className="inline-flex items-center gap-2 text-sm text-[#ff9b7a] font-semibold font-prompt">
                                {item.ctaLabel}
                                <ChevronRightIcon size={14} />
                            </span>
                        )}
                    </div>
                </div>
                <ChevronRightIcon size={16} className="text-white/35 shrink-0 mt-1" />
            </div>
        </a>
    );
}

export default function StudentLoanJourneySection({ items }) {
    return (
        <section className={`${LOAN_SURFACE} p-5 md:p-6`}>
            <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-[#ff8a65]">
                    <ListIcon size={18} />
                </div>
                <div>
                    <p className="text-sm text-white/50 font-montserrat uppercase tracking-[0.16em]">Monitoring Feed</p>
                    <h2 className="text-lg text-white font-prompt font-bold md:text-xl">feed การติดตามและการดำเนินการ</h2>
                </div>
            </div>

            {items.length > 0 ? (
                <div className="space-y-4">
                    {items.map((item) => <FeedItem key={item.id} item={item} />)}
                </div>
            ) : (
                <div className={`${LOAN_SURFACE_EMBED} p-4 text-white/60 font-prompt md:p-5`}>
                    ยังไม่พบรายการใน feed สำหรับประเภทผู้กู้ของคุณในขณะนี้
                </div>
            )}
        </section>
    );
}
