'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGuest } from '../context/GuestContext';
import { LOGIN_TRANSITION_NAV_ITEMS, ProductionHeroShell } from '../components/LoginTransitionShell';
import {
    buildGradeTerms,
    buildStatusGradeTerms,
    canUseModule,
    extractErrorMessage,
    getAcademicRecord,
    getGradeRows,
    isModuleAllowed,
    MODULE_ENDPOINTS,
    MODULES,
    ModuleContent,
    PORTAL_NAV_ITEMS,
    readString,
} from '../components/PortalModulePageClient';
import {
    buildUserMeta,
    getDisplayGpaxForStudent,
    getDisplayName,
    getUserCode,
} from '@/lib/studentPortalSummary.mjs';

const DEFAULT_MODULE_ID = 'grade';
const INITIAL_GRADE_STATE = Object.freeze({ loading: true, error: '', payload: null });
const EMPTY_MODULE_STATE = Object.freeze({ loading: false, error: '', payload: null });
const INITIAL_MODULE_STATES = Object.freeze({ [DEFAULT_MODULE_ID]: INITIAL_GRADE_STATE });
const MENU_ID_ALIASES = {
    home: DEFAULT_MODULE_ID,
    main: DEFAULT_MODULE_ID,
    registration: 'registry',
    settings: 'classroom',
    'student-loan': 'loan',
};

function normalizeMenuId(value) {
    const raw = readString(value)?.toLowerCase();
    if (!raw) return DEFAULT_MODULE_ID;
    const candidate = MENU_ID_ALIASES[raw] || raw;
    return MODULES[candidate] ? candidate : DEFAULT_MODULE_ID;
}

function readInitialMenuId() {
    if (typeof window === 'undefined') return DEFAULT_MODULE_ID;
    return normalizeMenuId(new URLSearchParams(window.location.search).get('menu'));
}

function resolveMenuItemModuleId(item) {
    if (!item) return DEFAULT_MODULE_ID;
    return normalizeMenuId(item.id || item.module || item.href);
}

function buildModuleEndpoint(moduleId) {
    return MODULE_ENDPOINTS[moduleId] || null;
}

export default function Main() {
    const { user, isAuthenticated, loading: authLoading, logout: handleLogout } = useAuth();
    const { isGuest, allowedModules, guestName, loading: guestLoading } = useGuest();
    const [mounted, setMounted] = useState(false);
    const [activeModuleId, setActiveModuleId] = useState(DEFAULT_MODULE_ID);
    const [moduleStates, setModuleStates] = useState(INITIAL_MODULE_STATES);
    const moduleStatesRef = useRef(moduleStates);
    const controllersRef = useRef(new Map());

    useEffect(() => {
        setMounted(true);
        setActiveModuleId(readInitialMenuId());
    }, []);

    useEffect(() => {
        moduleStatesRef.current = moduleStates;
    }, [moduleStates]);

    useEffect(() => () => {
        controllersRef.current.forEach((controller) => controller.abort());
        controllersRef.current.clear();
    }, []);

    const activeConfig = MODULES[activeModuleId] || MODULES[DEFAULT_MODULE_ID];
    const canAccess = isGuest ? isModuleAllowed(activeConfig.module, isGuest, allowedModules) : isAuthenticated;

    useEffect(() => {
        if (!authLoading && !guestLoading && !canAccess) {
            handleLogout();
        }
    }, [canAccess, authLoading, guestLoading, handleLogout]);

    const fetchModule = useCallback((moduleId, { force = false } = {}) => {
        const normalizedModuleId = normalizeMenuId(moduleId);
        const endpoint = buildModuleEndpoint(normalizedModuleId);
        const currentState = moduleStatesRef.current[normalizedModuleId];

        if (isGuest || !endpoint) {
            setModuleStates((current) => ({
                ...current,
                [normalizedModuleId]: EMPTY_MODULE_STATE,
            }));
            return;
        }

        if (!force && (currentState?.payload || (currentState?.loading && controllersRef.current.has(normalizedModuleId)))) {
            return;
        }

        controllersRef.current.get(normalizedModuleId)?.abort();
        const controller = new AbortController();
        controllersRef.current.set(normalizedModuleId, controller);

        setModuleStates((current) => ({
            ...current,
            [normalizedModuleId]: {
                loading: true,
                error: '',
                payload: current[normalizedModuleId]?.payload || null,
            },
        }));

        fetch(endpoint, {
            cache: 'no-store',
            credentials: 'same-origin',
            signal: controller.signal,
        })
            .then(async (response) => {
                const payload = await response.json().catch(() => null);
                if (response.status === 401 || payload?.code === 'SESSION_EXPIRED' || payload?.error?.code === 'UNAUTHORIZED') {
                    setModuleStates((current) => ({
                        ...current,
                        [normalizedModuleId]: {
                            loading: false,
                            error: 'SESSION_EXPIRED',
                            payload: current[normalizedModuleId]?.payload || null,
                        },
                    }));
                    handleLogout();
                    return;
                }
                if (!response.ok || payload?.success === false) {
                    throw new Error(extractErrorMessage(payload, `โหลดข้อมูลไม่สำเร็จ (${response.status})`));
                }

                setModuleStates((current) => ({
                    ...current,
                    [normalizedModuleId]: { loading: false, error: '', payload },
                }));
            })
            .catch((cause) => {
                if (controller.signal.aborted) return;
                setModuleStates((current) => ({
                    ...current,
                    [normalizedModuleId]: {
                        loading: false,
                        error: cause?.message || 'โหลดข้อมูลไม่สำเร็จ',
                        payload: current[normalizedModuleId]?.payload || null,
                    },
                }));
            })
            .finally(() => {
                if (controllersRef.current.get(normalizedModuleId) === controller) {
                    controllersRef.current.delete(normalizedModuleId);
                }
            });
    }, [handleLogout, isGuest]);

    useEffect(() => {
        if (authLoading || guestLoading || !canAccess) return;
        fetchModule(DEFAULT_MODULE_ID);
    }, [authLoading, canAccess, fetchModule, guestLoading]);

    useEffect(() => {
        if (authLoading || guestLoading || !canAccess) return;
        fetchModule(activeModuleId);
    }, [activeModuleId, authLoading, canAccess, fetchModule, guestLoading]);

    const navItems = useMemo(
        () => PORTAL_NAV_ITEMS
            .filter((item) => canUseModule(item, isGuest, allowedModules))
            .map((item) => ({ ...item })),
        [allowedModules, isGuest],
    );

    const handleNavigate = useCallback((item) => {
        const nextModuleId = resolveMenuItemModuleId(item);
        setActiveModuleId(nextModuleId);
        fetchModule(nextModuleId);
    }, [fetchModule]);

    const activeModuleState = moduleStates[activeModuleId] || EMPTY_MODULE_STATE;
    const gradeState = moduleStates.grade || EMPTY_MODULE_STATE;
    const gradeTerms = useMemo(() => {
        if (gradeState.loading) return buildStatusGradeTerms('LOADING');
        if (gradeState.error) return buildStatusGradeTerms(gradeState.error);
        return buildGradeTerms(gradeState.payload, gradeState.payload?.empty ? 'ไม่พบข้อมูลผลการเรียนจาก REG' : '');
    }, [gradeState.error, gradeState.loading, gradeState.payload]);

    const studentCode = getUserCode(user);
    const gradeRows = !gradeState.error ? getGradeRows(gradeState.payload) : null;
    const gradeRecord = !gradeState.error ? getAcademicRecord(gradeState.payload) : null;
    const gpax = getDisplayGpaxForStudent(studentCode, gradeRows, gradeRecord);
    const userName = getDisplayName(user, isGuest, guestName);
    const userMeta = buildUserMeta(user, null, gpax, isGuest);

    if (authLoading || guestLoading || (mounted && !canAccess)) {
        return null;
    }

    return (
        <ProductionHeroShell
            activeMenu={activeConfig.activeMenu}
            navItems={navItems.length ? navItems : LOGIN_TRANSITION_NAV_ITEMS}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            gradeTerms={gradeTerms}
            userMeta={userMeta}
            userName={userName}
        >
            <ModuleContent config={activeConfig} moduleId={activeModuleId} state={activeModuleState} />
        </ProductionHeroShell>
    );
}