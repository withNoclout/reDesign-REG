'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Navbar from '@/app/components/Navbar';
import GlowingBackground from '@/app/components/GlowingBackground';
import { useAuth } from '@/app/context/AuthContext';
import {
    AlertTriangleIcon,
    CheckCircleIcon,
    FileTextIcon,
    LinkIcon,
    RefreshCwIcon,
    SendIcon,
    ShieldIcon,
    XIcon,
} from '@/app/components/Icons';

const EMPTY_STATE = {
    configured: false,
    pushConfigured: false,
    missingConfig: [],
    readiness: {
        ready: false,
        state: 'blocked',
        webhookUrl: null,
        host: null,
        dnsAddresses: [],
        issues: [],
        checks: {
            channelSecret: false,
            channelAccessToken: false,
            webhookUrl: false,
            https: false,
            publicHost: false,
            dnsResolvable: false,
            recentWebhookEvent: false,
            proxyProtection: false,
        },
        telemetry: {
            recentEventCount: 0,
            lastWebhookEventAt: null,
            lastWebhookEventType: null,
            lastWebhookEventStatus: null,
        },
    },
    linked: false,
    account: null,
    pendingLinkRequest: null,
    instructions: {
        commandExamples: ['link <code>', 'ผูกบัญชี <code>'],
        note: '',
        commands: {
            primary: null,
            secondary: null,
        },
        quickActions: {
            addFriendUrl: null,
            openChatUrl: null,
        },
    },
};

function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function listReadinessIssues(settings, severity = null) {
    const issues = Array.isArray(settings.readiness?.issues) ? settings.readiness.issues : [];
    return severity ? issues.filter((issue) => issue.severity === severity) : issues;
}

function buildReadinessSummary(settings) {
    const blockingIssues = listReadinessIssues(settings, 'blocking');
    const warningIssues = listReadinessIssues(settings, 'warning');
    return blockingIssues[0]?.message
        || warningIssues[0]?.message
        || 'Webhook พร้อมรับ event จาก LINE แล้ว';
}


function buildStatusCard(settings) {
    const blockingIssues = listReadinessIssues(settings, 'blocking');
    if (blockingIssues.length > 0) {
        return {
            label: 'Webhook ยังไม่พร้อม',
            tone: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
            description: buildReadinessSummary(settings),
        };
    }

    if (settings.linked) {
        return {
            label: 'เชื่อม LINE แล้ว',
            tone: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
            description: 'บัญชี LINE นี้พร้อมรับ notification และ deep-link กลับเข้าระบบแล้ว',
        };
    }

    if (settings.pendingLinkRequest) {
        return {
            label: 'รอเชื่อมบัญชี',
            tone: 'border-sky-400/20 bg-sky-500/10 text-sky-200',
            description: 'คัดลอกคำสั่งพร้อมส่ง แล้ววางในแชต LINE OA เพื่อรับลิงก์ยืนยันการเชื่อมบัญชี',
        };
    }

    return {
        label: 'ยังไม่ได้เชื่อม LINE',
        tone: 'border-white/10 bg-white/[0.04] text-white/75',
        description: listReadinessIssues(settings, 'warning')[0]?.message
            || 'สร้าง Pairing Code แล้วใช้ปุ่มคัดลอกคำสั่งเพื่อเริ่มเชื่อมบัญชีได้ทันที',
    };
}

async function readJson(response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.success) {
        throw new Error(body?.error?.message || body?.message || 'Request failed');
    }
    return body.data;
}

export default function LineSettingsPageClient() {
    const router = useRouter();
    const { isAuthenticated, loading: authLoading, logout: handleLogout } = useAuth();
    const [settings, setSettings] = useState(EMPTY_STATE);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [creatingCode, setCreatingCode] = useState(false);
    const [unlinking, setUnlinking] = useState(false);
    const [flash, setFlash] = useState({ type: '', message: '' });

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            handleLogout?.();
            router.replace('/');
        }
    }, [authLoading, isAuthenticated, handleLogout, router]);

    const loadSettings = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        setRefreshing(silent);
        try {
            const next = await readJson(await fetch('/api/line/settings', { cache: 'no-store' }));
            setSettings({ ...EMPTY_STATE, ...next });
        } catch (error) {
            console.error('Failed to load LINE settings:', error);
            setFlash({ type: 'error', message: error.message || 'Failed to load LINE settings' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;
        loadSettings();
    }, [isAuthenticated, loadSettings]);

    const statusCard = useMemo(() => buildStatusCard(settings), [settings]);
    const blockingIssues = useMemo(() => listReadinessIssues(settings, 'blocking'), [settings]);
    const warningIssues = useMemo(() => listReadinessIssues(settings, 'warning'), [settings]);
    const pairingReady = settings.pushConfigured && settings.readiness?.ready;
    const pairingCode = settings.pendingLinkRequest?.pairingCode || '';
    const primaryCommand = useMemo(
        () => settings.instructions?.commands?.primary || (pairingCode ? `link ${pairingCode}` : ''),
        [settings.instructions?.commands?.primary, pairingCode]
    );
    const secondaryCommand = useMemo(
        () => settings.instructions?.commands?.secondary || (pairingCode ? `ผูกบัญชี ${pairingCode}` : ''),
        [settings.instructions?.commands?.secondary, pairingCode]
    );
    const addFriendUrl = settings.instructions?.quickActions?.addFriendUrl || null;
    const openChatUrl = settings.instructions?.quickActions?.openChatUrl || null;

    const handleCreateCode = useCallback(async () => {
        setCreatingCode(true);
        try {
            const session = await readJson(await fetch('/api/line/link/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            }));
            await loadSettings({ silent: true });
            setFlash({
                type: 'success',
                message: session.reused
                    ? 'ใช้ Pairing Code เดิมที่ยังไม่หมดอายุอยู่'
                    : 'สร้าง Pairing Code ใหม่แล้ว คัดลอกคำสั่งพร้อมส่งไปวางใน LINE ได้ทันที',
            });
        } catch (error) {
            console.error('Failed to create LINE pairing session:', error);
            setFlash({ type: 'error', message: error.message || 'Failed to create LINE pairing session' });
        } finally {
            setCreatingCode(false);
        }
    }, [loadSettings]);

    const handleUnlink = useCallback(async () => {
        setUnlinking(true);
        try {
            await readJson(await fetch('/api/line/link/unlink', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            }));
            setFlash({ type: 'success', message: 'ยกเลิกการเชื่อม LINE แล้ว' });
            await loadSettings({ silent: true });
        } catch (error) {
            console.error('Failed to unlink LINE account:', error);
            setFlash({ type: 'error', message: error.message || 'Failed to unlink LINE account' });
        } finally {
            setUnlinking(false);
        }
    }, [loadSettings]);

    const handleCopyText = useCallback(async (value, successMessage, errorMessage = 'ไม่สามารถคัดลอกข้อความได้ กรุณาคัดลอกด้วยตนเอง') => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setFlash({ type: 'success', message: successMessage });
        } catch (error) {
            console.error('Failed to copy LINE text:', error);
            setFlash({ type: 'error', message: errorMessage });
        }
    }, []);

    const handleCopyCode = useCallback(() => {
        handleCopyText(pairingCode, 'คัดลอกรหัส Pairing Code แล้ว', 'ไม่สามารถคัดลอกรหัสได้ กรุณาคัดลอกด้วยตนเอง');
    }, [handleCopyText, pairingCode]);

    const handleCopyPrimaryCommand = useCallback(() => {
        handleCopyText(primaryCommand, 'คัดลอกคำสั่งพร้อมส่งแล้ว');
    }, [handleCopyText, primaryCommand]);

    const handleCopySecondaryCommand = useCallback(() => {
        handleCopyText(secondaryCommand, 'คัดลอกคำสั่งสำรองแล้ว');
    }, [handleCopyText, secondaryCommand]);

    if (authLoading || (!isAuthenticated && loading)) {
        return (
            <main className="main-content min-h-screen bg-[#0f172a]">
                <Navbar />
                <GlowingBackground />
                <div className="pt-32 flex justify-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#06c755]"></div>
                </div>
            </main>
        );
    }

    return (
        <main className="main-content min-h-screen bg-[#0f172a] pb-20">
            <Navbar />
            <GlowingBackground />

            <div className="main-container pt-28">
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-[32px] border border-white/10 bg-[rgba(15,23,42,0.72)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-8"
                >
                    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)] lg:items-start">
                        <div>
                            <span className="inline-flex items-center gap-2 rounded-full border border-[#06c755]/20 bg-[#06c755]/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-[#8bf5b2]">
                                <LinkIcon size={12} />
                                LINE Messaging
                            </span>
                            <h1 className="mt-4 text-3xl md:text-4xl font-bold text-white font-prompt leading-tight">
                                เชื่อม LINE OA<br />ให้กดส่งได้ง่ายขึ้น
                            </h1>
                            <p className="mt-4 max-w-2xl text-white/65 font-prompt leading-relaxed">
                                หน้านี้เตรียม Pairing Code, คำสั่งพร้อมส่ง และทางลัดสำหรับเปิด LINE OA ไว้ให้ในจุดเดียว
                                ถ้า LINE เปิดอยู่บนมือถือหรือบน Mac/PC แล้ว คุณสามารถคัดลอกคำสั่งไปวางต่อได้ทันที
                            </p>

                            {flash.message && (
                                <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-prompt ${flash.type === 'error' ? 'border-red-400/20 bg-red-500/10 text-red-100' : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'}`}>
                                    {flash.message}
                                </div>
                            )}
                        </div>

                        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                            <div className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${statusCard.tone}`}>
                                {statusCard.label}
                            </div>
                            <p className="mt-4 text-white font-prompt font-semibold">สถานะปัจจุบัน</p>
                            <p className="mt-2 text-sm text-white/60 font-prompt leading-relaxed">{statusCard.description}</p>
                            {settings.readiness?.webhookUrl && (
                                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/55 font-mono break-all">
                                    {settings.readiness.webhookUrl}
                                </div>
                            )}
                            <div className="mt-5 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => loadSettings({ silent: true })}
                                    disabled={refreshing}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-white/90 transition-colors hover:bg-white/[0.1] disabled:opacity-60"
                                >
                                    <RefreshCwIcon size={16} className={refreshing ? 'animate-spin' : ''} />
                                    รีเฟรชสถานะ
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCreateCode}
                                    disabled={creatingCode || !pairingReady}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#06c755] px-4 py-2.5 text-[#04160a] font-semibold transition-colors hover:bg-[#05b84d] disabled:opacity-60"
                                >
                                    <SendIcon size={16} />
                                    {settings.pendingLinkRequest ? 'สร้างรหัสใหม่ / ใช้ของเดิม' : 'สร้างรหัสสำหรับเชื่อม LINE'}
                                </button>
                            </div>
                            <p className="mt-4 text-xs leading-relaxed text-white/45 font-prompt">
                                {pairingReady
                                    ? 'หลังสร้างรหัสแล้ว ใช้ปุ่มคัดลอกคำสั่งด้านล่างเพื่อวางใน LINE ได้ทันที'
                                    : 'ปุ่มสร้างรหัสจะเปิดใช้งานเมื่อ webhook endpoint พร้อมรับ event จาก LINE จริงแล้ว'}
                            </p>
                        </div>
                    </div>
                </motion.section>

                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.95fr)]">
                    <section className="rounded-[28px] border border-white/10 bg-[rgba(15,23,42,0.72)] p-6 backdrop-blur-xl">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-[#8bf5b2]">
                                <SendIcon size={18} />
                            </div>
                            <div>
                                <p className="text-sm uppercase tracking-[0.16em] text-white/45 font-montserrat">Quick pairing</p>
                                <h2 className="text-xl font-bold text-white font-prompt">คัดลอก แล้วส่งใน LINE ได้เลย</h2>
                            </div>
                        </div>

                        {blockingIssues.length > 0 && (
                            <div className="mt-5 rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-50">
                                <p className="font-semibold font-prompt">ตอนนี้ระบบยังรับข้อความจาก LINE OA ไม่ได้</p>
                                <div className="mt-3 space-y-3">
                                    {blockingIssues.map((issue) => (
                                        <div key={issue.code} className="rounded-2xl border border-amber-300/10 bg-black/10 px-4 py-3">
                                            <p className="font-medium">{issue.message}</p>
                                            {issue.recommendation && (
                                                <p className="mt-1 text-amber-100/80">{issue.recommendation}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {settings.pendingLinkRequest ? (
                            <div className="mt-5 space-y-4">
                                <div className="rounded-3xl border border-[#06c755]/20 bg-[#06c755]/10 p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.16em] text-[#8bf5b2]">Active code</p>
                                            <p className="mt-2 text-3xl font-black tracking-[0.2em] text-white font-prompt">{pairingCode}</p>
                                            <p className="mt-3 text-sm text-white/70">หมดอายุ {formatDateTime(settings.pendingLinkRequest.expiresAt)}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleCopyCode}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-white/90 hover:bg-white/[0.1]"
                                        >
                                            <FileTextIcon size={16} />
                                            คัดลอกรหัส
                                        </button>
                                    </div>

                                    <div className="mt-5 rounded-2xl border border-white/10 bg-[#04160a]/30 p-4">
                                        <p className="text-xs uppercase tracking-[0.16em] text-[#8bf5b2]">คำสั่งพร้อมส่ง</p>
                                        <p className="mt-2 break-all text-2xl font-semibold text-white font-prompt">{primaryCommand}</p>
                                        <p className="mt-2 text-sm text-white/65 font-prompt">
                                            เหมาะที่สุดสำหรับ LINE บน Mac, PC หรือเวลาที่ต้องการคัดลอกไปวางเอง
                                        </p>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-3">
                                        <button
                                            type="button"
                                            onClick={handleCopyPrimaryCommand}
                                            className="inline-flex items-center gap-2 rounded-xl bg-white text-[#04160a] px-4 py-2.5 font-semibold transition-colors hover:bg-[#e8fff0]"
                                        >
                                            <FileTextIcon size={16} />
                                            คัดลอกคำสั่งพร้อมส่ง
                                        </button>
                                        {openChatUrl && (
                                            <a
                                                href={openChatUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 rounded-xl border border-[#06c755]/25 bg-[#06c755]/12 px-4 py-2.5 font-semibold text-[#c9ffd9] transition-colors hover:bg-[#06c755]/18"
                                            >
                                                <LinkIcon size={16} />
                                                เปิด LINE พร้อมข้อความ
                                            </a>
                                        )}
                                        {addFriendUrl && (
                                            <a
                                                href={addFriendUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-white/90 transition-colors hover:bg-white/[0.1]"
                                            >
                                                <LinkIcon size={16} />
                                                เปิดหน้า LINE OA
                                            </a>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-white font-prompt">คำสั่งสำรอง</p>
                                            <p className="mt-1 text-sm text-white/60 font-prompt">
                                                ใช้ได้เหมือนกัน เผื่ออยากส่งเป็นภาษาไทย
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleCopySecondaryCommand}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-white/90 transition-colors hover:bg-white/[0.1]"
                                        >
                                            <FileTextIcon size={16} />
                                            คัดลอกแบบภาษาไทย
                                        </button>
                                    </div>
                                    <p className="mt-4 break-all rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-lg font-medium text-white/90 font-prompt">
                                        {secondaryCommand}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/65 font-prompt">
                                    <p className="font-semibold text-white">วิธีที่เร็วที่สุดตอนนี้</p>
                                    <p className="mt-2 leading-relaxed">{settings.instructions.note}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-5 space-y-4">
                                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-white/55 font-prompt">
                                    {pairingReady
                                        ? 'ยังไม่มี Pairing Code ที่ใช้งานอยู่ กดปุ่มด้านบนเพื่อสร้างรหัส แล้วระบบจะเตรียมคำสั่งพร้อมส่งให้ทันที'
                                        : 'ยังไม่สามารถสร้าง Pairing Code ใหม่ได้จนกว่า webhook endpoint จะพร้อมรับ event จาก LINE'}
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                    <p className="text-sm font-semibold text-white font-prompt">รูปแบบคำสั่งที่รองรับ</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {settings.instructions.commandExamples.map((command) => (
                                            <span key={command} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-white/80">
                                                {command}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    <div className="space-y-6">
                        <section className="rounded-[28px] border border-white/10 bg-[rgba(15,23,42,0.72)] p-6 backdrop-blur-xl">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-[#8bf5b2]">
                                    <AlertTriangleIcon size={18} />
                                </div>
                                <div>
                                    <p className="text-sm uppercase tracking-[0.16em] text-white/45 font-montserrat">Webhook readiness</p>
                                    <h2 className="text-xl font-bold text-white font-prompt">สถานะปลายทางที่ LINE จะเรียกกลับ</h2>
                                </div>
                            </div>

                            <div className="mt-5 space-y-4 text-sm text-white/65 font-prompt leading-relaxed">
                                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                    <p className="font-semibold text-white">Webhook URL</p>
                                    <p className="mt-2 break-all text-xs text-white/55 font-mono">
                                        {settings.readiness?.webhookUrl || 'ยังไม่ได้ตั้งค่า'}
                                    </p>
                                    <p className="mt-3 text-white/65">
                                        สถานะล่าสุด: {buildReadinessSummary(settings)}
                                    </p>
                                </div>

                                {warningIssues.length > 0 && blockingIssues.length === 0 && (
                                    <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4 text-sky-100">
                                        {warningIssues.map((issue) => (
                                            <div key={issue.code} className="mt-3 first:mt-0">
                                                <p className="font-medium">{issue.message}</p>
                                                {issue.recommendation && (
                                                    <p className="mt-1 text-sky-100/80">{issue.recommendation}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                    <p className="font-semibold text-white">หลักฐานล่าสุดจาก webhook</p>
                                    <p className="mt-2">เวลาที่พบ event ล่าสุด: {formatDateTime(settings.readiness?.telemetry?.lastWebhookEventAt)}</p>
                                    <p className="mt-1">ประเภท event ล่าสุด: {settings.readiness?.telemetry?.lastWebhookEventType || '—'}</p>
                                    <p className="mt-1">สถานะ event ล่าสุด: {settings.readiness?.telemetry?.lastWebhookEventStatus || '—'}</p>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-[28px] border border-white/10 bg-[rgba(15,23,42,0.72)] p-6 backdrop-blur-xl">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-[#8bf5b2]">
                                    <ShieldIcon size={18} />
                                </div>
                                <div>
                                    <p className="text-sm uppercase tracking-[0.16em] text-white/45 font-montserrat">Usage guide</p>
                                    <h2 className="text-xl font-bold text-white font-prompt">เลือกวิธีที่ตรงกับอุปกรณ์ของคุณ</h2>
                                </div>
                            </div>

                            <div className="mt-5 space-y-4 text-sm text-white/65 font-prompt leading-relaxed">
                                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                    <p className="font-semibold text-white">มือถือเครื่องเดียว</p>
                                    <ol className="mt-3 space-y-2 list-decimal pl-5">
                                        <li>กดสร้างรหัสจากด้านบน</li>
                                        <li>{openChatUrl ? 'กด “เปิด LINE พร้อมข้อความ” แล้วส่งข้อความได้เลย' : 'คัดลอกคำสั่งพร้อมส่ง แล้ววางในแชต LINE OA'}</li>
                                        <li>เมื่อ OA ส่งลิงก์ยืนยันกลับมา ให้เปิดลิงก์นั้นใน LINE เพื่อจบการเชื่อมบัญชี</li>
                                    </ol>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                    <p className="font-semibold text-white">LINE บน Mac / PC ที่ล็อกอินอยู่แล้ว</p>
                                    <ol className="mt-3 space-y-2 list-decimal pl-5">
                                        <li>กด “คัดลอกคำสั่งพร้อมส่ง” จากการ์ดซ้ายมือ</li>
                                        <li>เปิดแชต LINE OA บนเครื่องที่ใช้อยู่ แล้ววางคำสั่งนั้นส่งได้ทันที</li>
                                        <li>เปิดลิงก์ยืนยันที่ OA ตอบกลับมา แล้วทำขั้นตอนยืนยันต่อใน LINE</li>
                                    </ol>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                    <p className="font-semibold text-white">ก่อนเริ่มใช้งาน</p>
                                    <p className="mt-1">
                                        ระบบจะรู้จักบัญชี LINE ได้เมื่อคุณเพิ่ม OA เป็นเพื่อน หรือส่งข้อความเข้ามาอย่างน้อยหนึ่งครั้ง
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-[28px] border border-white/10 bg-[rgba(15,23,42,0.72)] p-6 backdrop-blur-xl">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-[#8bf5b2]">
                                    {settings.linked ? <CheckCircleIcon size={18} /> : <AlertTriangleIcon size={18} />}
                                </div>
                                <div>
                                    <p className="text-sm uppercase tracking-[0.16em] text-white/45 font-montserrat">Linked account</p>
                                    <h2 className="text-xl font-bold text-white font-prompt">สถานะบัญชี LINE</h2>
                                </div>
                            </div>

                            {settings.linked && settings.account ? (
                                <div className="mt-5 space-y-3 text-sm text-white/65 font-prompt">
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                        <p className="text-white font-semibold">{settings.account.displayName || 'LINE account linked'}</p>
                                        <p className="mt-1">LINE user ID: <span className="text-white/80">{settings.account.lineUserId}</span></p>
                                        <p className="mt-1">เชื่อมล่าสุด: {formatDateTime(settings.account.lastLinkedAt)}</p>
                                        <p className="mt-1">ข้อความล่าสุดจาก LINE: {formatDateTime(settings.account.lastMessageAt)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleUnlink}
                                        disabled={unlinking}
                                        className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2.5 text-red-100 hover:bg-red-500/15 disabled:opacity-60"
                                    >
                                        <XIcon size={16} />
                                        ยกเลิกการเชื่อม LINE
                                    </button>
                                </div>
                            ) : (
                                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55 font-prompt">
                                    ยังไม่พบบัญชี LINE ที่เชื่อมกับบัญชีนี้
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
}
