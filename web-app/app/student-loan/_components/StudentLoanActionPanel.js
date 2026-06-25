'use client';

import Link from 'next/link';
import {
    AlertTriangleIcon,
    CalendarIcon,
    CheckCircleIcon,
    ChevronRightIcon,
    ClockIcon,
    SparklesIcon,
} from '@/app/components/Icons';
import { LOAN_SURFACE, LOAN_SURFACE_EMBED, toneClass } from './loanDashboardTheme';

const ICON_TONE_CLASSES = {
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    sky: 'text-sky-300',
    slate: 'text-white/60',
};

function ActionLink({ action }) {
    if (!action?.href) return null;

    const isExternal = action.href.startsWith('http');
    const className = 'inline-flex items-center gap-2 rounded-xl bg-[#ff5722] px-4 py-3 text-white font-semibold font-prompt hover:bg-[#e64a19] transition-colors shadow-[0_12px_28px_rgba(255,87,34,0.24)]';

    if (isExternal) {
        return (
            <a href={action.href} target="_blank" rel="noreferrer" className={className}>
                {action.ctaLabel}
                <ChevronRightIcon size={16} />
            </a>
        );
    }

    return (
        <Link href={action.href} className={className}>
            {action.ctaLabel}
            <ChevronRightIcon size={16} />
        </Link>
    );
}

function OverviewCard({ item }) {
    const iconMap = {
        'สถานะผู้กู้': CheckCircleIcon,
        'รายการกำลังเปิด': SparklesIcon,
        'สิ่งที่ต้องเฝ้าดู': AlertTriangleIcon,
        'เดดไลน์ถัดไป': CalendarIcon,
    };
    const Icon = iconMap[item.eyebrow] || ClockIcon;

    return (
        <div className={`${LOAN_SURFACE_EMBED} p-4`}>
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] text-white/45 font-montserrat">{item.eyebrow}</p>
                <Icon size={16} className={ICON_TONE_CLASSES[item.tone] || ICON_TONE_CLASSES.slate} />
            </div>
            <p className="mt-3 text-base text-white font-semibold font-prompt leading-tight md:text-lg">{item.value}</p>
            <p className="mt-2 text-sm text-white/60 font-prompt leading-relaxed">{item.description}</p>
        </div>
    );
}

export default function StudentLoanActionPanel({ nextAction, overviewCards }) {
    const tone = nextAction.phase === 'closingSoon'
        ? 'amber'
        : nextAction.phase === 'open'
            ? 'emerald'
            : nextAction.phase === 'setup'
                ? 'sky'
                : 'slate';

    return (
        <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.42fr)_minmax(250px,0.92fr)]">
            <div className={`${LOAN_SURFACE} p-5 md:p-6`}>
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-[#ff8a65]">
                        <SparklesIcon size={18} />
                    </div>
                    <div>
                        <p className="text-sm text-white/50 font-montserrat uppercase tracking-[0.16em]">Primary Action</p>
                        <h2 className="text-lg text-white font-prompt font-bold md:text-xl">สิ่งที่ควรทำตอนนี้</h2>
                    </div>
                </div>

                <div className={`${LOAN_SURFACE_EMBED} p-5 md:p-6 ${toneClass(tone)}`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-montserrat uppercase tracking-[0.16em] opacity-80">งานสำคัญลำดับแรก</p>
                            <h3 className="mt-2 text-xl font-bold leading-tight text-white font-prompt md:text-[1.85rem]">{nextAction.title}</h3>
                            <p className="mt-3 font-prompt leading-relaxed text-white/80">{nextAction.detail}</p>
                        </div>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08]">
                            <AlertTriangleIcon size={18} className={ICON_TONE_CLASSES[tone] || ICON_TONE_CLASSES.slate} />
                        </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                        <p className="text-sm font-semibold text-white/90 font-prompt">{nextAction.description}</p>
                        {nextAction.deadlineText && (
                            <p className="mt-2 text-sm text-white/70 font-prompt">{nextAction.deadlineText}</p>
                        )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                        <ActionLink action={nextAction} />
                    </div>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {overviewCards.map((item) => <OverviewCard key={item.id} item={item} />)}
            </div>
        </section>
    );
}
