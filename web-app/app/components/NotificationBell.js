'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertTriangleIcon,
    BellIcon,
    BookOpenIcon,
    CalendarIcon,
    ChevronRightIcon,
    LinkIcon,
    XIcon,
} from './Icons';
import ClassroomConnectModal from './ClassroomConnectModal';
import { useAuth } from '../context/AuthContext';
import { buildClientGoogleMailBellItems } from '@/lib/googleClientMailFeed.js';
import {
    buildGuestPromptStorageKey,
    filterGuestDismissedPromptItems,
    markNotificationAsRead,
    removeNotificationById,
} from '@/lib/notificationBellState.js';
import { markClientGoogleMailNotificationsSeen } from '@/lib/googleClientMailState.js';
const EMPTY_FEED = {
    viewer: { authenticated: false, userCode: null },
    classroom: {
        configured: false,
        pushConfigured: false,
        connected: false,
        reconnectRequired: false,
        authRequired: false,
        lastSyncError: null,
    },
    sections: {
        actionRequired: [],
        latest: [],
        upcoming: [],
        all: [],
    },
    counts: {
        total: 0,
        unread: 0,
        actionRequired: 0,
    },
    sourceErrors: [],
};

const SOURCE_STYLES = {
    classroom: {
        icon: BookOpenIcon,
        accent: 'rgba(14, 165, 233, 0.45)',
        badgeClass: 'bg-sky-500/20 text-sky-200 border border-sky-400/20',
        iconClass: 'text-sky-300/80',
    },
    studentLoan: {
        icon: LinkIcon,
        accent: 'rgba(245, 158, 11, 0.45)',
        badgeClass: 'bg-amber-500/20 text-amber-200 border border-amber-400/20',
        iconClass: 'text-amber-300/80',
    },
    studentAffairs: {
        icon: LinkIcon,
        accent: 'rgba(168, 85, 247, 0.45)',
        badgeClass: 'bg-violet-500/20 text-violet-200 border border-violet-400/20',
        iconClass: 'text-violet-300/80',
    },
    evaluation: {
        icon: AlertTriangleIcon,
        accent: 'rgba(239, 68, 68, 0.45)',
        badgeClass: 'bg-rose-500/20 text-rose-200 border border-rose-400/20',
        iconClass: 'text-rose-300/80',
    },
    portfolio: {
        icon: LinkIcon,
        accent: 'rgba(34, 197, 94, 0.45)',
        badgeClass: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/20',
        iconClass: 'text-emerald-300/80',
    },
    exam: {
        icon: CalendarIcon,
        accent: 'rgba(249, 115, 22, 0.45)',
        badgeClass: 'bg-orange-500/20 text-orange-200 border border-orange-400/20',
        iconClass: 'text-orange-300/80',
    },
};

const SECTION_META = {
    actionRequired: {
        title: 'ต้องทำ',
        icon: AlertTriangleIcon,
    },
    latest: {
        title: 'ใหม่ล่าสุด',
        icon: BookOpenIcon,
    },
    upcoming: {
        title: 'ใกล้ถึงกำหนด',
        icon: CalendarIcon,
    },
};

function openNotificationLink(href) {
    if (!href) return;
    if (href.startsWith('/')) {
        window.location.href = href;
        return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
}

function buildClassroomSettingsUrl() {
    return '/settings/classroom';
}

function readGuestDismissedPromptIds(feed) {
    if (typeof window === 'undefined' || feed.viewer.authenticated) return new Set();

    const promptIds = feed.sections.all
        .filter((item) => item.kind === 'system_prompt')
        .map((item) => item.id);

    try {
        return new Set(promptIds.filter((notificationId) => (
            window.localStorage.getItem(buildGuestPromptStorageKey(notificationId)) === '1'
        )));
    } catch {
        return new Set();
    }
}

function persistGuestPromptDismissed(notificationId) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(buildGuestPromptStorageKey(notificationId), '1');
    } catch {
        // Ignore local storage failures.
    }
}

function addDismissedPromptId(current, notificationId) {
    const next = new Set(current);
    next.add(notificationId);
    return next;
}

function overlayClientClassroomFeed(serverFeed, clientOverlay) {
    const withoutClassroom = {
        ...serverFeed,
        sections: {
            actionRequired: serverFeed.sections.actionRequired.filter((item) => item.source !== 'classroom'),
            latest: serverFeed.sections.latest.filter((item) => item.source !== 'classroom'),
            upcoming: serverFeed.sections.upcoming.filter((item) => item.source !== 'classroom'),
        },
    };
    const nextSections = {
        actionRequired: [...withoutClassroom.sections.actionRequired, ...clientOverlay.items.filter((item) => item.section === 'actionRequired')],
        latest: [...withoutClassroom.sections.latest, ...clientOverlay.items.filter((item) => item.section === 'latest')],
        upcoming: [...withoutClassroom.sections.upcoming, ...clientOverlay.items.filter((item) => item.section === 'upcoming')],
    };
    return {
        ...withoutClassroom,
        classroom: clientOverlay.classroom,
        sections: {
            ...nextSections,
            all: [...nextSections.actionRequired, ...nextSections.latest, ...nextSections.upcoming],
        },
        counts: {
            total: [...nextSections.actionRequired, ...nextSections.latest, ...nextSections.upcoming].length,
            unread: [...nextSections.actionRequired, ...nextSections.latest, ...nextSections.upcoming].filter((item) => item.unread).length,
            actionRequired: nextSections.actionRequired.length,
        },
    };
}

function resolveItemStyle(item) {
    return SOURCE_STYLES[item.source] || SOURCE_STYLES.classroom;
}
function getHeaderAction(feed) {
    const hasClassroomPrompt = feed.sections.actionRequired.some((item) => item.source === 'classroom' && item.kind === 'system_prompt');
    if (hasClassroomPrompt) {
        return { label: 'เชื่อม Classroom Mail', action: 'openClassroomModal' };
    }

    if (feed.classroom.connected || feed.classroom.configured) {
        return { label: 'ตั้งค่า Classroom Mail', action: 'openClassroomModal' };
    }

    return null;
}

export default function NotificationBell() {
    const { user } = useAuth();
    const [feed, setFeed] = useState(EMPTY_FEED);
    const [guestDismissedPromptIds, setGuestDismissedPromptIds] = useState(() => new Set());
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false);
    const [busyNotificationIds, setBusyNotificationIds] = useState([]);
    const dropdownRef = useRef(null);

    const applyVisibleFeed = useCallback((nextFeed) => {
        setFeed(nextFeed);
        setGuestDismissedPromptIds(readGuestDismissedPromptIds(nextFeed));
    }, []);

    const refreshFeed = useCallback(async () => {
        const response = await fetch('/api/notifications');
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result?.error?.message || 'Failed to load notifications');
        }
        applyVisibleFeed({ ...EMPTY_FEED, ...result.data });
    }, [applyVisibleFeed]);

    useEffect(() => {
        let cancelled = false;
        const loadFeed = async () => {
            try {
                const response = await fetch('/api/notifications');
                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result?.error?.message || 'Failed to load notifications');
                }
                if (!cancelled) {
                    applyVisibleFeed({ ...EMPTY_FEED, ...result.data });
                }
            } catch (error) {
                console.error('Failed to load unified notifications:', error);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadFeed();
        return () => {
            cancelled = true;
        };
    }, [applyVisibleFeed]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const interval = window.setInterval(() => {
            refreshFeed().catch((error) => {
                console.error('Failed to refresh notifications:', error);
            });
        }, 60_000);
        return () => window.clearInterval(interval);
    }, [refreshFeed]);

    const visibleFeed = useMemo(() => {
        const baseFeed = filterGuestDismissedPromptItems(feed, guestDismissedPromptIds);
        const currentUserCode = user?.usercode || baseFeed.viewer.userCode || null;
        if (!currentUserCode) return baseFeed;
        return overlayClientClassroomFeed(baseFeed, buildClientGoogleMailBellItems(currentUserCode));
    }, [feed, guestDismissedPromptIds, user?.usercode]);
    const headerAction = useMemo(() => getHeaderAction(visibleFeed), [visibleFeed]);
    const classroomPromptItem = useMemo(
        () => visibleFeed.sections.actionRequired.find((item) => item.source === 'classroom' && item.kind === 'system_prompt') || null,
        [visibleFeed.sections.actionRequired]
    );
    const hasNotifications = visibleFeed.sections.all.length > 0;
    const showIndicator = visibleFeed.counts.total > 0 || visibleFeed.counts.unread > 0;
    const setBusy = useCallback((notificationId, active) => {
        setBusyNotificationIds((current) => {
            if (active) {
                return current.includes(notificationId) ? current : [...current, notificationId];
            }
            return current.filter((item) => item !== notificationId);
        });
    }, []);

    const dismissPrompt = useCallback(async (item) => {
        if (visibleFeed.viewer.authenticated) {
            const response = await fetch('/api/notifications/dismiss', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationId: item.id }),
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result?.error?.message || 'Failed to dismiss notification');
            }
            setFeed((current) => removeNotificationById(current, item.id));
            return;
        }

        persistGuestPromptDismissed(item.id);
        setGuestDismissedPromptIds((current) => addDismissedPromptId(current, item.id));
        setFeed((current) => removeNotificationById(current, item.id));
    }, [visibleFeed.viewer.authenticated]);

    const prepareClassroomPromptForNavigation = useCallback(async () => {
        if (!classroomPromptItem || classroomPromptItem.meta?.clientManaged) return;
        await dismissPrompt(classroomPromptItem);
    }, [classroomPromptItem, dismissPrompt]);

    const handleOpenClassroomSettings = useCallback(async () => {
        if (visibleFeed.viewer.authenticated && classroomPromptItem && !classroomPromptItem.meta?.clientManaged) {
            await prepareClassroomPromptForNavigation();
        } else if (!visibleFeed.viewer.authenticated && classroomPromptItem) {
            persistGuestPromptDismissed(classroomPromptItem.id);
            setGuestDismissedPromptIds((current) => addDismissedPromptId(current, classroomPromptItem.id));
            setFeed((current) => removeNotificationById(current, classroomPromptItem.id));
        }
        setIsClassroomModalOpen(false);
        setIsOpen(false);
        window.location.href = visibleFeed.viewer.authenticated ? '/settings/classroom' : '/';
    }, [classroomPromptItem, prepareClassroomPromptForNavigation, visibleFeed.viewer.authenticated]);

    const handleBeginClassroomAuth = useCallback(async () => {
        if (!visibleFeed.viewer.authenticated) {
            if (classroomPromptItem) {
                persistGuestPromptDismissed(classroomPromptItem.id);
                setGuestDismissedPromptIds((current) => addDismissedPromptId(current, classroomPromptItem.id));
                setFeed((current) => removeNotificationById(current, classroomPromptItem.id));
            }
            setIsClassroomModalOpen(false);
            setIsOpen(false);
            window.location.href = '/';
            return;
        }

        setIsClassroomModalOpen(false);
        setIsOpen(false);
        window.location.href = buildClassroomSettingsUrl();
    }, [classroomPromptItem, prepareClassroomPromptForNavigation, visibleFeed.viewer.authenticated]);

    const handleOpenClassroomModal = useCallback(() => {
        setIsOpen(false);
        setIsClassroomModalOpen(true);
    }, []);

    const handleNotificationOpen = useCallback(async (item) => {
        const isBusy = busyNotificationIds.includes(item.id);
        if (isBusy) return;

        setBusy(item.id, true);
        try {
            if (item.kind === 'system_prompt' && item.source === 'classroom') {
                handleOpenClassroomModal();
                return;
            }

            if (item.openAction) {
                const response = await fetch('/api/notifications/act', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notificationId: item.id }),
                });
                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result?.error?.message || 'Failed to process notification action');
                }

                if (item.source === 'studentLoan' && item.meta?.phase === 'open' && result.data?.updated) {
                    setFeed((current) => removeNotificationById(current, item.id));
                } else if (item.source === 'classroom' && item.unread && !item.meta?.clientManaged) {
                    setFeed((current) => markNotificationAsRead(current, item.id));
                }
            }

            if (item.meta?.clientManaged && item.unread) {
                const currentUserCode = user?.usercode || visibleFeed.viewer.userCode || null;
                if (currentUserCode) {
                    markClientGoogleMailNotificationsSeen(currentUserCode, [item.id]);
                }
                setFeed((current) => markNotificationAsRead(current, item.id));
            }

            setIsOpen(false);
            openNotificationLink(item.href);
        } catch (error) {
            console.error('Failed to open notification:', error);
            setIsOpen(false);
            openNotificationLink(item.href);
        } finally {
            setBusy(item.id, false);
        }
    }, [busyNotificationIds, handleOpenClassroomModal, setBusy, user?.usercode, visibleFeed.viewer.userCode]);

    const handleNotificationDismiss = useCallback(async (item, event) => {
        event.stopPropagation();
        const isBusy = busyNotificationIds.includes(item.id);
        if (isBusy) return;

        setBusy(item.id, true);
        try {
            await dismissPrompt(item);
        } catch (error) {
            console.error('Failed to dismiss notification prompt:', error);
        } finally {
            setBusy(item.id, false);
        }
    }, [busyNotificationIds, dismissPrompt, setBusy]);

    const handleHeaderAction = useCallback(() => {
        if (!headerAction) return;
        if (headerAction.action === 'openClassroomModal') {
            setIsClassroomModalOpen(true);
        }
    }, [headerAction]);

    return (
        <div className="relative" ref={dropdownRef}>
            <motion.button
                onClick={() => setIsOpen((current) => !current)}
                className="relative p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                whileHover={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ duration: 0.4 }}
                aria-label="การแจ้งเตือน"
            >
                <BellIcon size={20} />
                {showIndicator && (
                    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff5722] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ff5722] border-2 border-[rgba(15,23,42,1)]"></span>
                    </span>
                )}
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-3 w-96 max-w-[calc(100vw-2rem)] bg-[rgba(15,23,42,0.95)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-2xl shadow-xl overflow-hidden z-50 flex flex-col"
                    >
                        <div className="flex justify-between items-center px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                            <div>
                                <h3 className="text-sm font-bold text-white font-prompt flex items-center gap-2">
                                    <AlertTriangleIcon size={14} className="text-[#ff5722]" />
                                    การแจ้งเตือน
                                </h3>
                                <p className="text-[11px] text-white/45 font-prompt mt-0.5">
                                    รวม Classroom Mail, กยศ., ประเมินอาจารย์, ข่าวกิจการนักศึกษา, Portfolio และสอบ
                                </p>
                            </div>
                            {headerAction ? (
                                <button
                                    type="button"
                                    onClick={handleHeaderAction}
                                    className="text-xs text-[#ff5722] hover:text-[#ff8a65] font-montserrat transition-colors flex items-center text-right"
                                >
                                    {headerAction.label} <ChevronRightIcon size={12} className="ml-0.5" />
                                </button>
                            ) : (
                                <span className="text-xs text-white/45 font-montserrat">
                                    {visibleFeed.counts.total} รายการ
                                </span>
                            )}
                        </div>

                        <div className="p-2 flex flex-col gap-3 max-h-[480px] overflow-y-auto custom-scrollbar">
                            {loading ? (
                                <div className="p-4 flex justify-center">
                                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#ff5722]"></div>
                                </div>
                            ) : hasNotifications ? (
                                <>
                                    {(['actionRequired', 'latest', 'upcoming']).map((sectionKey) => {
                                        const items = visibleFeed.sections[sectionKey] || [];
                                        if (items.length === 0) return null;
                                        const sectionMeta = SECTION_META[sectionKey];
                                        const SectionIcon = sectionMeta.icon;

                                        return (
                                            <section key={sectionKey} className="flex flex-col gap-1">
                                                <div className="px-2 pt-1 pb-1 text-[11px] uppercase tracking-[0.16em] text-white/45 font-montserrat flex items-center gap-2">
                                                    <SectionIcon size={11} className="text-white/40" />
                                                    {sectionMeta.title}
                                                </div>
                                                {items.map((item) => {
                                                    const styles = resolveItemStyle(item);
                                                    const SourceIcon = styles.icon;
                                                    const isBusy = busyNotificationIds.includes(item.id);
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className="flex items-start gap-1 rounded-xl hover:bg-[rgba(255,255,255,0.06)] transition-colors group"
                                                            style={{ borderLeft: `3px solid ${styles.accent}` }}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => handleNotificationOpen(item)}
                                                                disabled={isBusy}
                                                                className="min-w-0 flex-1 text-left flex items-start gap-3 p-3 rounded-l-xl disabled:opacity-70 disabled:cursor-wait"
                                                            >
                                                                <div className="mt-0.5 shrink-0">
                                                                    <SourceIcon size={14} className={styles.iconClass} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${styles.badgeClass}`}>
                                                                            {item.badgeLabel || item.sourceLabel}
                                                                        </span>
                                                                        {item.unread && (
                                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#ff5722]/15 text-[#ffab91] border border-[#ff5722]/20">
                                                                                ใหม่
                                                                            </span>
                                                                        )}
                                                                        {item.meta?.preview && (
                                                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/5 text-white/55 border border-white/10">
                                                                                Preview
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-sm text-white/90 font-prompt">{item.title}</p>
                                                                    <p className="text-xs text-white/55 font-prompt mt-1 leading-relaxed">{item.message}</p>
                                                                    {item.meta?.lastSyncError && (
                                                                        <p className="text-[11px] text-amber-200/80 font-prompt mt-2">{item.meta.lastSyncError}</p>
                                                                    )}
                                                                </div>
                                                                <ChevronRightIcon size={14} className="text-white/35 mt-1 shrink-0 group-hover:text-white/60 transition-colors" />
                                                            </button>
                                                            {item.dismissible && (
                                                                <div className="flex shrink-0 items-start p-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(event) => handleNotificationDismiss(item, event)}
                                                                        disabled={isBusy}
                                                                        aria-label={`Dismiss ${item.title}`}
                                                                        className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white/75 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                                                    >
                                                                        <XIcon size={14} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </section>
                                        );
                                    })}

                                    {visibleFeed.sourceErrors.length > 0 && (
                                        <div className="mx-2 mt-1 rounded-xl border border-amber-500/15 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/85 font-prompt leading-relaxed">
                                            บางแหล่งข้อมูลโหลดไม่สำเร็จ: {visibleFeed.sourceErrors.map((item) => item.source).join(', ')}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="py-8 px-4 text-center text-white/50 text-sm font-prompt">
                                    ไม่มีการแจ้งเตือนใหม่
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <ClassroomConnectModal
                isOpen={isClassroomModalOpen}
                classroom={visibleFeed.classroom}
                authenticated={visibleFeed.viewer.authenticated}
                onClose={() => setIsClassroomModalOpen(false)}
                onOpenSettings={handleOpenClassroomSettings}
                onBeginAuth={handleBeginClassroomAuth}
                onOpenClassroom={() => {
                    setIsClassroomModalOpen(false);
                    setIsOpen(false);
                    openNotificationLink('https://mail.google.com/mail/u/0/#search/classroom');
                }}
            />
        </div>
    );
}
