'use client';

import { BookOpenIcon, CalendarIcon, ChevronRightIcon, GraduationCapIcon, LinkIcon, RefreshCwIcon } from '@/app/components/Icons';
import { formatThaiDateTime } from './studentLoanViewModel';
import { LOAN_SURFACE, LOAN_SURFACE_EMBED, toneClass } from './loanDashboardTheme';

function HighlightCard({ item }) {
    return (
        <div className={`${LOAN_SURFACE_EMBED} p-4 ${toneClass(item.tone)}`}>
            <p className="text-xs uppercase tracking-[0.16em] font-montserrat opacity-80">{item.title}</p>
            <p className="mt-3 text-base text-white font-semibold font-prompt leading-tight md:text-lg">{item.value}</p>
            <p className="mt-2 text-sm text-white/60 font-prompt leading-relaxed">{item.description}</p>
        </div>
    );
}

function SidebarLink({ item }) {
    return (
        <a
            href={item.href}
            target={item.href?.startsWith('http') ? '_blank' : undefined}
            rel={item.href?.startsWith('http') ? 'noreferrer' : undefined}
            className={`${LOAN_SURFACE_EMBED} block p-4 transition-colors hover:bg-white/[0.08]`}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-white font-semibold font-prompt">{item.title}</p>
                    <p className="mt-2 text-sm text-white/55 font-prompt leading-relaxed">{item.description}</p>
                </div>
                <ChevronRightIcon size={16} className="text-white/40 shrink-0 mt-1" />
            </div>
        </a>
    );
}

export default function StudentLoanSidebar({ highlights, linkGroups, sources, onOpenProfileModal }) {
    return (
        <div className="flex flex-col gap-5 lg:sticky lg:top-28">
            <section className={`${LOAN_SURFACE} p-5 md:p-6`}>
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-[#ff8a65]">
                        <GraduationCapIcon size={18} />
                    </div>
                    <div>
                        <p className="text-sm text-white/50 font-montserrat uppercase tracking-[0.16em]">Dashboard Summary</p>
                        <h2 className="text-lg text-white font-prompt font-bold md:text-xl">แผงจัดการผู้กู้</h2>
                    </div>
                </div>

                <div className="space-y-3">
                    {highlights.map((item) => <HighlightCard key={item.id} item={item} />)}
                </div>

                <button
                    type="button"
                    onClick={onOpenProfileModal}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-white/90 transition-colors hover:bg-white/[0.1] font-prompt"
                >
                    <RefreshCwIcon size={16} />
                    เปลี่ยนประเภทผู้กู้
                </button>
            </section>

            {linkGroups.map((group, index) => (
                <section key={group.key} className={`${LOAN_SURFACE} p-5 md:p-6`}>
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-[#ff8a65]">
                            {index === linkGroups.length - 1 ? <BookOpenIcon size={18} /> : <LinkIcon size={18} />}
                        </div>
                        <div>
                            <p className="text-sm text-white/50 font-montserrat uppercase tracking-[0.16em]">Quick Access</p>
                            <h2 className="text-lg text-white font-prompt font-bold md:text-xl">{group.title}</h2>
                        </div>
                    </div>
                    <p className="mb-4 text-sm text-white/55 font-prompt leading-relaxed">{group.description}</p>
                    <div className="space-y-3">
                        {group.items.map((item) => <SidebarLink key={item.id} item={item} />)}
                    </div>
                </section>
            ))}

            {sources.length > 0 && (
                <section className={`${LOAN_SURFACE} p-5 md:p-6`}>
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-[#ff8a65]">
                            <CalendarIcon size={18} />
                        </div>
                        <div>
                            <p className="text-sm text-white/50 font-montserrat uppercase tracking-[0.16em]">Sources</p>
                            <h2 className="text-lg text-white font-prompt font-bold md:text-xl">ประกาศต้นทางล่าสุด</h2>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {sources.map((source) => (
                            <a
                                key={source.id}
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`${LOAN_SURFACE_EMBED} block p-4 transition-colors hover:bg-white/[0.08]`}
                            >
                                <p className="text-white font-semibold font-prompt">{source.title}</p>
                                <p className="mt-2 text-sm text-white/55 font-prompt">อัปเดตล่าสุด {formatThaiDateTime(source.modifiedAt)}</p>
                            </a>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
