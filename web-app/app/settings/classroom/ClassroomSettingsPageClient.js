'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Navbar from '../../components/Navbar';
import GlowingBackground from '../../components/GlowingBackground';
import { useAuth } from '../../context/AuthContext';
import {
    AlertTriangleIcon,
    BookOpenIcon,
    CheckCircleIcon,
    ChevronRightIcon,
    LinkIcon,
    RefreshCwIcon,
    XIcon,
} from '../../components/Icons';
import {
    buildClientGoogleMailReadiness,
    buildClientGoogleMailSettingsSummary,
    getClientGoogleMailSettings,
    saveClientGoogleMailSettings,
} from '@/lib/googleClientMailState.js';
import {
    connectClientGoogleMail,
    disconnectClientGoogleMail,
    syncClientGoogleMailNotifications,
} from '@/lib/googleClientMailGis.js';

const EMPTY_SETTINGS = {
    configured: false,
    pushConfigured: false,
    rollout: {
        mode: 'pilot',
        enabled: false,
        reason: 'login_required',
    },
    connected: false,
    reconnectRequired: false,
    selectedFeatures: {
        announcements: true,
        coursework: true,
        returnedWork: true,
        pushSync: false,
    },
    featureCatalog: [],
    requestedScopes: [],
    grantedScopes: [],
    unreadCount: 0,
    connectUrl: null,
    lastSyncedAt: null,
    lastSyncError: null,
    connection: null,
};

const EMPTY_READINESS = {
    checkedAt: null,
    status: 'blocked',
    configured: false,
    pushConfigured: false,
    missingConfig: [],
    rollout: {
        mode: 'pilot',
        enabled: false,
        reason: 'login_required',
    },
    connected: false,
    reconnectRequired: false,
    connection: null,
    checklist: [],
    blockers: [],
    nextSteps: [],
};

function FeatureCheckbox({ feature, checked, disabled, onChange }) {
    return (
        <label className={`rounded-2xl border p-4 transition-colors ${disabled ? 'border-white/8 bg-white/[0.02] opacity-60' : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05] cursor-pointer'}`}>
            <div className="flex items-start gap-3">
                <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-[#ff5722]"
                />
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-prompt font-semibold">{feature.label}</p>
                        {feature.required && (
                            <span className="text-[10px] uppercase tracking-[0.16em] px-2 py-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
                                Core
                            </span>
                        )}
                        {!feature.available && (
                            <span className="text-[10px] uppercase tracking-[0.16em] px-2 py-1 rounded-full border border-amber-400/20 bg-amber-500/10 text-amber-200">
                                ยังไม่พร้อมในเซิร์ฟเวอร์นี้
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-white/60 font-prompt mt-1 leading-relaxed">{feature.description}</p>
                </div>
            </div>
        </label>
    );
}

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

function buildStatusSummary(settings) {
    if (!settings.configured) {
        return {
            label: 'ระบบยังไม่พร้อม',
            tone: 'border-white/10 bg-white/[0.03] text-white/75',
            description: 'ผู้ดูแลระบบยังไม่ได้ตั้งค่า Gmail-backed Classroom notification POC ในสภาพแวดล้อมนี้',
        };
    }
    if (!settings.rollout?.enabled) {
        return {
            label: settings.rollout?.mode === 'off' ? 'ปิดใช้งานชั่วคราว' : 'ทยอยเปิดใช้งาน',
            tone: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
            description: settings.rollout?.mode === 'off'
                ? 'Gmail-backed Classroom POC ถูกปิดใช้งานชั่วคราวเพื่อลดผลกระทบระหว่างการปรับปรุงระบบ'
                : 'Gmail-backed Classroom POC ยังจำกัดเฉพาะผู้ใช้ใน pilot rollout เพื่อควบคุม blast radius',
        };
    }
    if (settings.connected) {
        return {
            label: 'เชื่อมต่อแล้ว',
            tone: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
            description: 'ระบบพร้อมซิงก์อีเมลแจ้งเตือนจาก Classroom ใน Gmail ของคุณ',
        };
    }
    if (settings.reconnectRequired) {
        return {
            label: 'ต้องเชื่อมใหม่',
            tone: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
            description: 'สิทธิ์ Gmail readonly หมดอายุหรือถูกเพิกถอน ต้องอนุญาตใหม่ผ่าน Google',
        };
    }
    return {
        label: 'ยังไม่ได้เชื่อม',
        tone: 'border-sky-400/20 bg-sky-500/10 text-sky-200',
        description: 'เลือกฟีเจอร์ที่ต้องการ แล้วอนุญาต Gmail readonly ผ่าน Google consent screen เพื่อเริ่มซิงก์อีเมลแจ้งเตือน',
    };
}
export default function ClassroomSettingsPage() {
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading, logout: handleLogout } = useAuth();
    const [settings, setSettings] = useState(EMPTY_SETTINGS);
    const [selectedFeatures, setSelectedFeatures] = useState(EMPTY_SETTINGS.selectedFeatures);
    const [readiness, setReadiness] = useState(EMPTY_READINESS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [flash, setFlash] = useState({ type: '', message: '' });

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            handleLogout?.();
            router.replace('/');
        }
    }, [authLoading, isAuthenticated, handleLogout, router]);

    const loadSettings = useCallback(async () => {
        try {
            const currentUserCode = user?.usercode || user?.userid || '';
            const summary = buildClientGoogleMailSettingsSummary(currentUserCode);
            const currentSettings = getClientGoogleMailSettings(currentUserCode);
            const readinessSummary = buildClientGoogleMailReadiness(currentUserCode);
            setSettings({ ...EMPTY_SETTINGS, ...summary });
            setSelectedFeatures({ ...EMPTY_SETTINGS.selectedFeatures, ...currentSettings });
            setReadiness({ ...EMPTY_READINESS, ...readinessSummary });
        } catch (error) {
            console.error('Failed to load Gmail Classroom Mail settings:', error);
            setFlash({ type: 'error', message: error.message || 'Failed to load Gmail Classroom Mail settings' });
        } finally {
            setLoading(false);
        }
    }, [user?.usercode, user?.userid]);

    useEffect(() => {
        if (!isAuthenticated) return;
        loadSettings();
    }, [isAuthenticated, loadSettings]);

    const statusSummary = useMemo(() => buildStatusSummary(settings), [settings]);
    const isDirty = useMemo(() => JSON.stringify(selectedFeatures) !== JSON.stringify(settings.selectedFeatures || {}), [selectedFeatures, settings.selectedFeatures]);
    const rolloutDescription = useMemo(() => {
        if (settings.rollout?.enabled) {
            return settings.rollout?.mode === 'all'
                ? 'ระบบพร้อมให้ผู้ใช้ทุกคนเชื่อม Google Mail เพื่ออ่านข้อความแจ้งเตือนจาก Classroom ได้แล้ว'
                : 'บัญชีนี้อยู่ใน pilot rollout และสามารถเชื่อม Google Mail สำหรับ Classroom ได้';
        }
        if (settings.rollout?.mode === 'off') {
            return 'Google Mail Classroom POC ถูกปิดใช้งานชั่วคราวสำหรับทุกบัญชีเพื่อลด blast radius ระหว่างการปรับปรุง';
        }
        return 'บัญชีนี้ยังไม่อยู่ใน pilot rollout ของ Google Mail Classroom POC จึงยังไม่สามารถเริ่ม consent popup ได้';
    }, [settings.rollout]);

    const handleFeatureChange = useCallback((key, value) => {
        setSelectedFeatures((current) => ({ ...current, [key]: value }));
    }, []);


    const saveSettings = useCallback(async () => {
        setSaving(true);
        try {
            const currentUserCode = user?.usercode || user?.userid || '';
            saveClientGoogleMailSettings(currentUserCode, selectedFeatures);
            setFlash({ type: 'success', message: 'บันทึกการเลือกฟีเจอร์ของ Classroom Mail แล้ว' });
            await loadSettings();
            return buildClientGoogleMailSettingsSummary(currentUserCode);
        } catch (error) {
            console.error('Failed to save Classroom Mail settings:', error);
            setFlash({ type: 'error', message: error.message || 'Failed to save Classroom Mail settings' });
            return null;
        } finally {
            setSaving(false);
        }
    }, [loadSettings, selectedFeatures, user?.usercode, user?.userid]);

    const handleConnect = useCallback(async () => {
        let nextSettings = settings;
        if (isDirty) {
            const saved = await saveSettings();
            if (!saved) return;
            nextSettings = saved;
        }
        if (!nextSettings.rollout?.enabled) {
            setFlash({ type: 'error', message: 'บัญชีนี้ยังไม่อยู่ใน pilot rollout ของ Classroom Mail POC' });
            return;
        }
        try {
            setSyncing(true);
            const currentUserCode = user?.usercode || user?.userid || '';
            await connectClientGoogleMail(currentUserCode);
            await syncClientGoogleMailNotifications(currentUserCode);
            setFlash({ type: 'success', message: 'เชื่อม Google Mail สำเร็จแล้ว และดึงอีเมลแจ้งเตือนจาก Classroom เรียบร้อย' });
            await loadSettings();
        } catch (error) {
            console.error('Failed to connect Google Mail:', error);
            setFlash({ type: 'error', message: error.message || 'Failed to connect Google Mail' });
        } finally {
            setSyncing(false);
        }
    }, [isDirty, loadSettings, saveSettings, settings, user?.usercode, user?.userid]);

    const handleSyncNow = useCallback(async () => {
        setSyncing(true);
        try {
            const currentUserCode = user?.usercode || user?.userid || '';
            await syncClientGoogleMailNotifications(currentUserCode);
            setFlash({ type: 'success', message: 'สั่งซิงก์อีเมลแจ้งเตือน Classroom ใหม่แล้ว' });
            await loadSettings();
        } catch (error) {
            console.error('Failed to sync Classroom Mail:', error);
            setFlash({ type: 'error', message: error.message || 'Failed to sync Classroom Mail' });
        } finally {
            setSyncing(false);
        }
    }, [loadSettings, user?.usercode, user?.userid]);

    const handleDisconnect = useCallback(async () => {
        setDisconnecting(true);
        try {
            const currentUserCode = user?.usercode || user?.userid || '';
            disconnectClientGoogleMail(currentUserCode);
            setFlash({ type: 'success', message: 'ยกเลิกการเชื่อมต่อ Google Mail สำหรับ Classroom แล้ว' });
            await loadSettings();
        } catch (error) {
            console.error('Failed to disconnect Classroom Mail:', error);
            setFlash({ type: 'error', message: error.message || 'Failed to disconnect Classroom Mail' });
        } finally {
            setDisconnecting(false);
        }
    }, [loadSettings, user?.usercode, user?.userid]);
    if (authLoading || (!isAuthenticated && loading)) {
        return (
            <main className="main-content min-h-screen bg-[#0f172a]">
                <Navbar />
                <GlowingBackground />
                <div className="pt-32 flex justify-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#ff5722]"></div>
                </div>
            </main>
        );
    }

    return (
        <main className="main-content min-h-screen bg-[#0f172a]" id="main-content">
            <Navbar />
            <GlowingBackground />

            <section className="relative z-10 max-w-6xl mx-auto px-4 pt-28 pb-16 md:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-8"
                >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                        <div>
                            <span className="inline-flex items-center gap-2 py-1 px-3 rounded-full bg-[#ff5722]/10 border border-[#ff5722]/20 text-[#ffab91] text-xs font-bold tracking-[0.16em] uppercase">
                                <BookOpenIcon size={12} />
                                Gmail Classroom Mail
                            </span>
                            <h1 className="mt-4 text-4xl md:text-5xl font-bold text-white font-prompt leading-tight">
                                จัดการการเชื่อมต่อ<br />Google Mail สำหรับ Classroom
                            </h1>
                            <p className="mt-4 text-white/65 max-w-3xl font-prompt leading-relaxed">
                                เลือกฟีเจอร์ที่คุณต้องการเปิดใช้ จากนั้นกดอนุญาต Gmail readonly ผ่าน Google consent screen เพื่อให้ระบบอ่านอีเมลแจ้งเตือนจาก Classroom ของบัญชีคุณอย่างปลอดภัย
                            </p>
                        </div>
                        <div className={`rounded-2xl border px-4 py-3 ${statusSummary.tone} lg:max-w-sm`}>
                            <p className="text-xs uppercase tracking-[0.16em] font-montserrat mb-1">สถานะปัจจุบัน</p>
                            <p className="text-lg font-bold font-prompt">{statusSummary.label}</p>
                            <p className="text-sm mt-2 font-prompt leading-relaxed opacity-90">{statusSummary.description}</p>
                        </div>
                    </div>

                    {flash.message && (
                        <div className={`rounded-2xl border px-4 py-3 font-prompt ${flash.type === 'success'
                            ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                            : 'border-rose-400/20 bg-rose-500/10 text-rose-100'}`}>
                            {flash.message}
                        </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <div className="xl:col-span-2 space-y-6">
                            <section className="rounded-3xl border border-white/10 bg-[rgba(15,23,42,0.82)] backdrop-blur-xl shadow-xl overflow-hidden">
                                <div className="px-6 py-5 border-b border-white/10 bg-white/[0.03] flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-[#ff8a65] font-montserrat mb-2">Feature Access</p>
                                        <h2 className="text-2xl text-white font-prompt font-bold">เลือกฟีเจอร์ที่ต้องการเปิดใช้</h2>
                                        <p className="text-sm text-white/60 mt-2 font-prompt max-w-2xl">
                                            ฟีเจอร์ชุดนี้จะควบคุมว่า parser ฝั่ง browser จะอ่านข้อความอีเมลแจ้งเตือนประเภทใดจาก Google Classroom เพื่อแสดงใน Notification Bell
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={saveSettings}
                                        disabled={saving || !isDirty || !settings.rollout?.enabled}
                                        className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/[0.06] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {saving ? 'กำลังบันทึก...' : 'Apply'}
                                    </button>
                                </div>
                                <div className="p-6 grid md:grid-cols-2 gap-4">
                                    {settings.featureCatalog.map((feature) => (
                                        <FeatureCheckbox
                                            key={feature.key}
                                            feature={feature}
                                            checked={Boolean(selectedFeatures[feature.key])}
                                            disabled={feature.required || !feature.available || saving}
                                            onChange={(checked) => handleFeatureChange(feature.key, checked)}
                                        />
                                    ))}
                                </div>
                            </section>

                            <section className="rounded-3xl border border-white/10 bg-[rgba(15,23,42,0.82)] backdrop-blur-xl shadow-xl overflow-hidden">
                                <div className="px-6 py-5 border-b border-white/10 bg-white/[0.03]">
                                    <p className="text-xs uppercase tracking-[0.2em] text-[#ff8a65] font-montserrat mb-2">OAuth & Gmail Consent</p>
                                    <h2 className="text-2xl text-white font-prompt font-bold">ขั้นตอนการอนุญาตกับ Google</h2>
                                </div>
                                <div className="p-6 grid md:grid-cols-3 gap-4">
                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <p className="text-white font-semibold font-prompt mb-2">1. Apply ฟีเจอร์</p>
                                        <p className="text-sm text-white/60 font-prompt">บันทึก feature selection ของคุณก่อน เพื่อให้ระบบรู้ว่าต้องอ่านอีเมลแจ้งเตือนของ Classroom ในระดับใด</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <p className="text-white font-semibold font-prompt mb-2">2. อนุญาต Gmail readonly</p>
                                        <p className="text-sm text-white/60 font-prompt">Google จะเป็นผู้แสดง consent screen อย่างเป็นทางการ ให้คุณกดยอมรับการอ่านอีเมลของบัญชีคุณแบบ read-only</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <p className="text-white font-semibold text-white mb-2 font-prompt">3. parse notification mail</p>
                                        <p className="text-sm text-white/60 font-prompt">เมื่อ callback สำเร็จ ระบบจะดึงอีเมลที่เกี่ยวกับ Classroom มาแปลงเป็น notification ในกระดิ่งของคุณ</p>
                                    </div>
                                </div>
                                <div className="px-6 pb-6 flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={handleConnect}
                                        disabled={!settings.configured || !settings.rollout?.enabled || saving}
                                        className="inline-flex items-center rounded-xl bg-[#ff5722] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ff7043] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {settings.connected ? 'เชื่อม Google Mail ใหม่' : 'อนุญาตและเชื่อม Google Mail'}
                                        <ChevronRightIcon size={14} className="ml-1.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSyncNow}
                                        disabled={!settings.connected || syncing}
                                        className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/[0.06] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <RefreshCwIcon size={14} className="mr-1.5" />
                                        {syncing ? 'กำลังซิงก์...' : 'Sync now'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDisconnect}
                                        disabled={!settings.connection || disconnecting}
                                        className="inline-flex items-center rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <XIcon size={14} className="mr-1.5" />
                                        {disconnecting ? 'กำลังยกเลิก...' : 'Disconnect'}
                                    </button>
                                </div>
                            </section>
                        </div>

                        <div className="space-y-6">
                            <section className="rounded-3xl border border-white/10 bg-[rgba(15,23,42,0.82)] backdrop-blur-xl shadow-xl overflow-hidden">
                                <div className="px-6 py-5 border-b border-white/10 bg-white/[0.03]">
                                    <p className="text-xs uppercase tracking-[0.2em] text-[#ff8a65] font-montserrat mb-2">Connection</p>
                                    <h2 className="text-xl text-white font-prompt font-bold">รายละเอียดบัญชีที่เชื่อม</h2>
                                </div>
                                <div className="p-6 space-y-4 text-sm font-prompt">
                                    <div>
                                        <p className="text-white/45 mb-1">Google account</p>
                                        <p className="text-white/90">{settings.connection?.email || 'ยังไม่ได้เชื่อม'}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/45 mb-1">ชื่อบัญชี</p>
                                        <p className="text-white/90">{settings.connection?.displayName || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/45 mb-1">ซิงก์ล่าสุด</p>
                                        <p className="text-white/90">{formatDateTime(settings.lastSyncedAt)}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/45 mb-1">Unread classroom notifications</p>
                                        <p className="text-white/90">{settings.unreadCount}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/45 mb-1">Last sync error</p>
                                        <p className="text-white/90 leading-relaxed">{settings.lastSyncError || '—'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-amber-400/15 bg-amber-500/10 px-4 py-3 text-amber-50/90">
                                        <p className="font-semibold mb-1">Browser-local session</p>
                                        <p className="text-sm leading-relaxed">การเชื่อม Google Mail และ notification ที่ parse แล้วจะถูกเก็บใน browser นี้เท่านั้น ถ้าเปลี่ยนเครื่องหรือเปลี่ยน browser ต้องเชื่อมและ sync ใหม่ในเครื่องนั้น</p>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-3xl border border-white/10 bg-[rgba(15,23,42,0.82)] backdrop-blur-xl shadow-xl overflow-hidden">
                                <div className="px-6 py-5 border-b border-white/10 bg-white/[0.03]">
                                    <p className="text-xs uppercase tracking-[0.2em] text-[#ff8a65] font-montserrat mb-2">Readiness</p>
                                    <h2 className="text-xl text-white font-prompt font-bold">Pilot activation readiness</h2>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 border ${readiness.status === 'ready' ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200' : readiness.status === 'attention' ? 'border-amber-400/20 bg-amber-500/10 text-amber-200' : 'border-rose-400/20 bg-rose-500/10 text-rose-200'}`}>
                                        <span className="font-semibold">
                                            {readiness.status === 'ready' ? 'Ready' : readiness.status === 'attention' ? 'Needs attention' : 'Blocked'}
                                        </span>
                                        <span className="text-[11px] uppercase tracking-[0.16em]">{readiness.checkedAt ? formatDateTime(readiness.checkedAt) : 'pending'}</span>
                                    </div>

                                    <div className="space-y-2">
                                        {readiness.checklist.map((item) => (
                                            <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm text-white/90 font-prompt">{item.label}</p>
                                                        {item.detail && (
                                                            <p className="text-xs text-white/55 font-prompt mt-1 break-words">{item.detail}</p>
                                                        )}
                                                    </div>
                                                    <span className={`text-[11px] uppercase tracking-[0.16em] ${item.ready ? 'text-emerald-200' : 'text-amber-200'}`}>
                                                        {item.ready ? 'Ready' : 'Pending'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {readiness.blockers.length > 0 && (
                                        <div className="rounded-2xl border border-rose-400/15 bg-rose-500/10 p-4">
                                            <p className="text-sm font-semibold text-rose-100 font-prompt mb-2">Blockers</p>
                                            <ul className="space-y-2 text-sm text-rose-50/90 font-prompt">
                                                {readiness.blockers.map((item) => (
                                                    <li key={item.id}>- {item.message}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {readiness.nextSteps.length > 0 && (
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <p className="text-sm font-semibold text-white font-prompt mb-2">Next steps</p>
                                            <ol className="space-y-2 text-sm text-white/75 font-prompt list-decimal list-inside">
                                                {readiness.nextSteps.map((item) => (
                                                    <li key={item}>{item}</li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="rounded-3xl border border-white/10 bg-[rgba(15,23,42,0.82)] backdrop-blur-xl shadow-xl overflow-hidden">
                                <div className="px-6 py-5 border-b border-white/10 bg-white/[0.03]">
                                    <p className="text-xs uppercase tracking-[0.2em] text-[#ff8a65] font-montserrat mb-2">Rollout</p>
                                    <h2 className="text-xl text-white font-prompt font-bold">สถานะการเปิดใช้งาน</h2>
                                </div>
                                <div className="p-6 space-y-3 text-sm font-prompt">
                                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 border ${settings.rollout?.enabled ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/20 bg-amber-500/10 text-amber-200'}`}>
                                        <span className="font-semibold">{settings.rollout?.enabled ? 'พร้อมใช้งานสำหรับบัญชีนี้' : 'จำกัดการใช้งาน'}</span>
                                        <span className="text-[11px] uppercase tracking-[0.16em]">{settings.rollout?.mode || 'pilot'}</span>
                                    </div>
                                    <p className="text-white/70 leading-relaxed">{rolloutDescription}</p>
                                    <div>
                                        <p className="text-white/45 mb-1">Blast radius control</p>
                                        <p className="text-white/90">{settings.rollout?.enabled ? 'บัญชีนี้อยู่ในขอบเขต rollout ปัจจุบัน' : 'ระบบยังบล็อก consent flow สำหรับบัญชีนี้เพื่อลดผลกระทบต่อผู้ใช้อื่น'}</p>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-3xl border border-white/10 bg-[rgba(15,23,42,0.82)] backdrop-blur-xl shadow-xl overflow-hidden">
                                <div className="px-6 py-5 border-b border-white/10 bg-white/[0.03]">
                                    <p className="text-xs uppercase tracking-[0.2em] text-[#ff8a65] font-montserrat mb-2">Scopes</p>
                                    <h2 className="text-xl text-white font-prompt font-bold">สิทธิ์ Gmail ที่ระบบจะร้องขอ</h2>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <p className="text-white/45 text-sm font-prompt mb-2">Requested scopes</p>
                                        <ul className="space-y-2 text-xs text-white/70 font-montserrat break-all">
                                            {settings.requestedScopes.map((scope) => (
                                                <li key={scope} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{scope}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="text-white/45 text-sm font-prompt mb-2">Granted scopes</p>
                                        {settings.grantedScopes.length > 0 ? (
                                            <ul className="space-y-2 text-xs text-white/70 font-montserrat break-all">
                                                {settings.grantedScopes.map((scope) => (
                                                    <li key={scope} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{scope}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-white/60 font-prompt">ยังไม่มี scope ที่ถูกอนุญาตอยู่ในระบบ</p>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-3xl border border-white/10 bg-[rgba(15,23,42,0.82)] backdrop-blur-xl shadow-xl overflow-hidden">
                                <div className="px-6 py-5 border-b border-white/10 bg-white/[0.03]">
                                    <p className="text-xs uppercase tracking-[0.2em] text-[#ff8a65] font-montserrat mb-2">Security</p>
                                    <h2 className="text-xl text-white font-prompt font-bold">ข้อควรรู้</h2>
                                </div>
                                <div className="p-6 space-y-3 text-sm text-white/70 font-prompt leading-relaxed">
                                    <div className="flex items-start gap-3">
                                        <CheckCircleIcon size={16} className="shrink-0 mt-0.5 text-emerald-300" />
                                        <p>การอนุญาตสิทธิจริงเกิดขึ้นบน Google-hosted consent screen เท่านั้น ไม่ได้เกิดในหน้าเรา</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <AlertTriangleIcon size={16} className="shrink-0 mt-0.5 text-amber-300" />
                                        <p>ถ้า Google account ที่เลือกไม่ตรงกับผู้ใช้ปัจจุบัน ระบบจะไม่ bind ให้โดยอัตโนมัติ</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <LinkIcon size={16} className="shrink-0 mt-0.5 text-sky-300" />
                                        <p>คุณสามารถยกเลิกการเชื่อมต่อได้ภายหลังจากหน้านี้ และ Google อาจยังให้สิทธิเดิมอยู่จนกว่าจะ revoke สำเร็จ</p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </motion.div>
            </section>
        </main>
    );
}
