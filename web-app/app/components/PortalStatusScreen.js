'use client';

import { motion } from 'framer-motion';
import { AlertTriangleIcon, HomeIcon, RefreshCwIcon } from './Icons';

export default function PortalStatusScreen({
    actions,
    children,
    details,
    homeHref = '/',
    onRetry,
    retryLabel = 'ลองอีกครั้ง',
    subtitle = 'Something went wrong',
    title = 'เกิดข้อผิดพลาด',
}) {
    const visibleActions = actions || [
        onRetry ? { type: 'button', label: retryLabel, onClick: onRetry, variant: 'primary' } : null,
        { type: 'link', label: 'หน้าหลัก', href: homeHref, variant: 'secondary' },
    ].filter(Boolean);

    return (
        <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden p-4" id="main-content">
            <div className="bg-image" aria-hidden="true" />
            <div className="bg-overlay" aria-hidden="true" />
            <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[5px]" aria-hidden="true" />

            <motion.section
                className="relative z-10 w-full max-w-3xl px-4 text-center text-white"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                role="alert"
                aria-live="assertive"
            >
                <motion.div
                    className="mx-auto mb-9 grid h-28 w-28 place-items-center rounded-full bg-red-500/18 text-red-300 shadow-[0_0_60px_rgba(248,113,113,0.28)] ring-1 ring-red-300/25"
                    initial={{ scale: 0.94 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                    <div className="grid h-14 w-14 place-items-center rounded-full border-2 border-red-300/90">
                        <AlertTriangleIcon size={26} aria-hidden="true" />
                    </div>
                </motion.div>

                <h1 className="font-prompt text-4xl font-bold leading-tight tracking-[-0.04em] md:text-5xl">
                    {title}
                </h1>
                <p className="mt-4 font-montserrat text-2xl font-semibold tracking-[-0.04em] text-white/80">
                    {subtitle}
                </p>
                {children || (
                    <p className="mx-auto mt-5 max-w-2xl font-prompt text-base leading-7 text-white/52">
                        เราขออภัยในความไม่สะดวก กรุณาลองอีกครั้ง
                    </p>
                )}

                {details && (
                    <div className="mx-auto mt-7 max-w-2xl rounded-2xl border border-white/10 bg-black/25 p-4 text-left font-mono text-xs leading-6 text-red-100/80">
                        {details}
                    </div>
                )}

                <div className="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
                    {visibleActions.map((action) => {
                        const className = action.variant === 'primary'
                            ? 'inline-flex min-h-[68px] items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-8 font-prompt text-xl font-bold text-white shadow-[0_20px_60px_rgba(248,81,45,0.28)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0'
                            : 'inline-flex min-h-[68px] items-center justify-center gap-3 rounded-2xl border border-white/28 bg-white/8 px-8 font-prompt text-xl font-bold text-white backdrop-blur-md transition-colors duration-200 hover:bg-white/14';

                        if (action.type === 'button') {
                            return (
                                <button className={className} key={action.label} type="button" onClick={action.onClick}>
                                    <RefreshCwIcon size={20} aria-hidden="true" />
                                    {action.label}
                                </button>
                            );
                        }

                        return (
                            <a className={className} href={action.href} key={action.label}>
                                <HomeIcon size={22} aria-hidden="true" />
                                {action.label}
                            </a>
                        );
                    })}
                </div>

                <p className="mt-10 font-prompt text-sm leading-6 text-white/35">
                    หากปัญหายังคงอยู่ กรุณาติดต่อผู้ดูแลระบบ
                </p>
            </motion.section>
        </main>
    );
}
