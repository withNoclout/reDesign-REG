'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import styles from './LoginTransitionShell.module.css';

const DEFAULT_LOGIN_FORM_ID = 'production-login-form';

const DESKTOP_CANVAS_BREAKPOINT = 901;
const LOGIN_CANVAS_WIDTH = 1440;
const LOGIN_CANVAS_HEIGHT = 1024;
const NAV_RIPPLE_DURATION_MS = 6200;
const NAV_RIPPLE_RING_COUNT = 4;
const NAV_RIPPLE_RING_DELAY_MS = 720;
const NAV_RIPPLE_CLEANUP_MS = NAV_RIPPLE_DURATION_MS + ((NAV_RIPPLE_RING_COUNT - 1) * NAV_RIPPLE_RING_DELAY_MS) + 900;
const NAV_RIPPLE_IMPACT_MIN_DELAY_MS = 920;
const NAV_RIPPLE_IMPACT_MAX_DELAY_MS = 2360;
const NAV_RIPPLE_ABSORB_SEGMENT_PX = 148;
const NAV_RIPPLE_ABSORB_CORNER_SEGMENT_PX = 190;
const NAV_RIPPLE_PANEL_RECT = Object.freeze({
    x: 400,
    y: 274,
    width: 1005,
    height: 600,
});

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getDistanceToRect(point, rect) {
    const nearestX = clampNumber(point.x, rect.x, rect.x + rect.width);
    const nearestY = clampNumber(point.y, rect.y, rect.y + rect.height);
    const dx = nearestX - point.x;
    const dy = nearestY - point.y;

    return Math.sqrt((dx * dx) + (dy * dy));
}

function getNavRippleAbsorbDelay(ripple, ringIndex) {
    const distance = getDistanceToRect(ripple, NAV_RIPPLE_PANEL_RECT);
    const travelDelay = clampNumber(distance * 3.2, NAV_RIPPLE_IMPACT_MIN_DELAY_MS, NAV_RIPPLE_IMPACT_MAX_DELAY_MS);

    return Math.round(travelDelay + (ringIndex * NAV_RIPPLE_RING_DELAY_MS));
}

function getNavRippleAbsorbSegments(ripple) {
    const rect = NAV_RIPPLE_PANEL_RECT;
    const segmentHalf = NAV_RIPPLE_ABSORB_SEGMENT_PX / 2;
    const cornerLength = NAV_RIPPLE_ABSORB_CORNER_SEGMENT_PX;
    const rectRight = rect.x + rect.width;
    const rectBottom = rect.y + rect.height;

    if (ripple.y < rect.y + segmentHalf) {
        return [
            { edge: 'top', x1: rect.x, y1: rect.y, x2: clampNumber(rect.x + cornerLength, rect.x, rectRight), y2: rect.y, delayOffset: 0 },
            { edge: 'left', x1: rect.x, y1: rect.y, x2: rect.x, y2: clampNumber(rect.y + cornerLength, rect.y, rectBottom), delayOffset: 140 },
        ];
    }

    if (ripple.y > rectBottom - segmentHalf) {
        return [
            { edge: 'bottom', x1: rect.x, y1: rectBottom, x2: clampNumber(rect.x + cornerLength, rect.x, rectRight), y2: rectBottom, delayOffset: 0 },
            { edge: 'left', x1: rect.x, y1: clampNumber(rectBottom - cornerLength, rect.y, rectBottom), x2: rect.x, y2: rectBottom, delayOffset: 140 },
        ];
    }

    const centerY = clampNumber(ripple.y, rect.y + segmentHalf, rectBottom - segmentHalf);

    return [
        { edge: 'left', x1: rect.x, y1: centerY - segmentHalf, x2: rect.x, y2: centerY + segmentHalf, delayOffset: 0 },
    ];
}


const DEFAULT_NAV_ITEMS = [
    { id: 'grade', label: 'GRADE', href: '/grade', slot: 'grade' },
    { id: 'registry', label: 'REGISTRY', href: '/registration/enroll', slot: 'registry' },
    { id: 'evaluation', label: 'EVAL', href: '/evaluation', slot: 'textPrimary' },
    { id: 'portfolio', label: 'PORT', href: '/portfolio', slot: 'portfolio' },
    { id: 'loan', label: 'LOAN', href: '/student-loan', slot: 'loan' },
    { id: 'schedule', label: 'SCHEDULE', href: '/grade/schedule', slot: 'schedule' },
    { id: 'settings', label: 'SETTING', href: '/settings/classroom', slot: 'setting' },
];

const navSlotClassName = {
    grade: styles.loginTransitionNavGrade,
    registry: styles.loginTransitionNavRegistry,
    textPrimary: styles.loginTransitionNavTextPrimary,
    textSecondary: styles.loginTransitionNavPortfolio,
    portfolio: styles.loginTransitionNavPortfolio,
    loan: styles.loginTransitionNavLoan,
    schedule: styles.loginTransitionNavSchedule,
    setting: styles.loginTransitionNavSetting,
};

const gradeTermSlotClassName = [styles.isTerm1, styles.isTerm2, styles.isTerm3];

const GRADE_ROW_SLOTS = [
    { top: 101, height: 43, delay: 270 },
    { top: 145, height: 43, delay: 310 },
    { top: 191, height: 41, delay: 350 },
    { top: 234, height: 44, delay: 390 },
    { top: 279, height: 43, delay: 430 },
    { top: 323, height: 44, delay: 470 },
    { top: 369, height: 41, delay: 510 },
    { top: 413, height: 43, delay: 550 },
    { top: 457, height: 43, delay: 590 },
];
const GRADE_WHEEL_THRESHOLD_PX = 54;
const GRADE_WHEEL_RESET_MS = 180;
const GRADE_SWAP_OUT_MS = 120;
const GRADE_SWAP_IN_MS = 150;
const GRADE_WHEEL_COOLDOWN_MS = 260;
const GRADE_WHEEL_AXIS_LOCK_RATIO = 1.15;

function getGradeFragmentLevel(progress) {
    if (progress >= 0.74) return 3;
    if (progress >= 0.48) return 2;
    if (progress >= 0.22) return 1;
    return 0;
}



const EMPTY_GRADE_TERM = Object.freeze({
    term: '',
    rows: [],
});

const gradeStressClassNames = () => [
    styles.isStress1,
    styles.isStress2,
    styles.isStress3,
    styles.isStress4,
].filter(Boolean);

function normalizeNavItem(item, index) {
    const slot = item.slot || ['grade', 'registry', 'textPrimary', 'textSecondary', 'schedule', 'setting'][index] || 'textPrimary';
    return {
        ...item,
        id: item.id || item.href || item.label,
        label: item.label || item.id || 'TEXT',
        slot,
    };
}

export { DEFAULT_NAV_ITEMS as LOGIN_TRANSITION_NAV_ITEMS };

function getCanvasScale() {
    if (typeof window === 'undefined' || window.innerWidth < DESKTOP_CANVAS_BREAKPOINT) {
        return null;
    }

    const scale = Math.min(
        window.innerWidth / LOGIN_CANVAS_WIDTH,
        window.innerHeight / LOGIN_CANVAS_HEIGHT,
        1,
    );

    return Number.isFinite(scale) ? scale : 1;
}

function useCanvasScale() {
    const [canvasScale, setCanvasScale] = useState(null);

    useEffect(() => {
        let animationFrame = 0;
        const updateCanvasScale = () => {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = window.requestAnimationFrame(() => {
                setCanvasScale(getCanvasScale());
            });
        };

        updateCanvasScale();
        window.addEventListener('resize', updateCanvasScale);
        window.visualViewport?.addEventListener('resize', updateCanvasScale);

        return () => {
            window.cancelAnimationFrame(animationFrame);
            window.removeEventListener('resize', updateCanvasScale);
            window.visualViewport?.removeEventListener('resize', updateCanvasScale);
        };
    }, []);

    return canvasScale;
}

const stateClassName = {
    idle: styles.isIdle,
    running: styles.isRunning,
    complete: styles.isComplete,
    loggingOut: styles.isLoggingOut,
};

function classNames(...tokens) {
    return tokens.filter(Boolean).join(' ');
}

function renderHeroText(text) {
    return text.split('').map((char, index) => (
        <span
            className={classNames(
                styles.loginTransitionHeroTextChar,
                char === ' ' ? styles.loginTransitionHeroTextSpace : null,
            )}
            key={`${char}-${index}`}
            style={{ '--i': index }}
        >
            {char === ' ' ? '\u00a0' : char}
        </span>
    ));
}

function renderHeroPanelTeeth() {
    return ['top', 'bottom'].flatMap((side) =>
        Array.from({ length: 24 }, (_, index) => (
            <span
                className={classNames(
                    styles.loginTransitionHeroPanelTooth,
                    side === 'top' ? styles.isTop : styles.isBottom,
                )}
                key={`${side}-${index}`}
                style={{ '--i': index }}
            />
        )),
    );
}

function renderMenuTransitionTeeth() {
    return ['top', 'bottom'].flatMap((side) =>
        Array.from({ length: 24 }, (_, index) => (
            <span
                className={classNames(
                    styles.loginTransitionMenuTooth,
                    side === 'top' ? styles.isTop : styles.isBottom,
                )}
                key={`${side}-${index}`}
                style={{ '--i': index, '--d': Math.abs(index - 11.5) }}
            />
        )),
    );
}

function renderContractText() {
    return 'contract ?'.split('').map((char, index) => (
        <span
            className={classNames(
                styles.loginTransitionContractChar,
                char === ' ' ? styles.loginTransitionContractSpace : null,
            )}
            key={`${char}-${index}`}
        >
            {char === ' ' ? '\u00a0' : char}
        </span>
    ));
}

function sanitizeUsername(value) {
    return String(value || '').replace(/[^\x20-\x7E]/g, '');
}

function normalizeGradeRows(rows = [], statusText = '') {
    return GRADE_ROW_SLOTS.map((_, index) => {
        const row = rows[index];
        if (row) {
            return {
                subject: String(row.subject || row.course || row.name || '').trim(),
                unit: String(row.unit || row.credit || '').trim(),
                score: String(row.score || row.grade || '').trim(),
            };
        }

        if (index === 0 && statusText) {
            return { subject: statusText, unit: '-', score: '-' };
        }

        return { subject: '', unit: '', score: '' };
    });
}

function normalizeGradeTerms(gradeTerms) {
    const sourceTerms = Array.isArray(gradeTerms) ? gradeTerms : [];
    const terms = sourceTerms
        .map((term) => ({
            term: String(term?.term || '').trim(),
            rows: normalizeGradeRows(term?.rows || term?.subjects || []),
        }))
        .filter((term) => term.term || term.rows.some((row) => row.subject || row.unit || row.score));

    if (!terms.length) {
        terms.push({
            term: '',
            rows: normalizeGradeRows(),
        });
    }

    return [EMPTY_GRADE_TERM, ...terms, EMPTY_GRADE_TERM];
}

function getInitialGradeTermIndex(terms) {
    if (!Array.isArray(terms) || terms.length < 3) {
        return 1;
    }

    for (let index = terms.length - 2; index >= 1; index -= 1) {
        const hasIssuedGrade = terms[index]?.rows?.some((row) => {
            const score = String(row?.score || '').trim();
            return score && score !== '-';
        });
        if (hasIssuedGrade) {
            return index;
        }
    }

    return Math.max(1, terms.length - 2);
}

function getGradeTermsKey(terms) {
    return terms
        .map((term) => `${term.term}:${term.rows.map((row) => `${row.subject}/${row.unit}/${row.score}`).join(',')}`)
        .join('|');
}

function renderGradeTermText(term) {
    const value = String(term || '').trim();
    const characters = value
        ? (() => {
            const [termNumber = '', year = ''] = value.split('|').map((part) => part.trim());
            return [
                termNumber.slice(0, 1) || ' ',
                '|',
                ...year.padEnd(4, ' ').slice(0, 4).split(''),
            ];
        })()
        : [' ', ' ', ' ', ' ', ' ', ' '];

    return characters.map((char, index) => (
        <span className={styles.loginTransitionGradeTermChar} key={`${value || 'blank'}-${index}`}>
            {char === ' ' ? '\u00a0' : char}
        </span>
    ));
}

function splitGradeSubject(subject) {
    const value = String(subject || '').trim();
    const match = value.match(/^(\d{9})(?:\s+(.+))?$/);

    if (!match) {
        return { code: '', name: value };
    }

    return {
        code: match[1],
        name: match[2] || '',
    };
}

function useMenuTransition(state, onMenuCommit, activeMenuId = 'grade') {
    const [activeMenu, setActiveMenu] = useState(activeMenuId);
    const [isMenuTransitioning, setIsMenuTransitioning] = useState(false);
    const [isMenuTransitionPending, setIsMenuTransitionPending] = useState(false);
    const [navRipples, setNavRipples] = useState([]);
    const menuRippleTimerRef = useRef(null);
    const menuCommitTimerRef = useRef(null);
    const menuStressTimersRef = useRef([]);
    const rippleIdRef = useRef(0);

    const clearMenuTimer = useCallback(() => {
        if (menuRippleTimerRef.current !== null) {
            window.clearTimeout(menuRippleTimerRef.current);
            menuRippleTimerRef.current = null;
        }

        if (menuCommitTimerRef.current !== null) {
            window.clearTimeout(menuCommitTimerRef.current);
            menuCommitTimerRef.current = null;
        }
    }, []);

    const clearMenuStress = useCallback((element) => {
        menuStressTimersRef.current.forEach((timer) => window.clearTimeout(timer));
        menuStressTimersRef.current = [];
        element?.classList.remove(...gradeStressClassNames());
    }, []);

    const clearAllMenuStress = useCallback(() => {
        menuStressTimersRef.current.forEach((timer) => window.clearTimeout(timer));
        menuStressTimersRef.current = [];
        document
            .querySelectorAll('[data-login-transition-menu-item="true"]')
            .forEach((element) => element.classList.remove(...gradeStressClassNames()));
    }, []);

    const setMenuStress = useCallback((element, level) => {
        element.classList.remove(...gradeStressClassNames());
        const className = styles[`isStress${level}`];
        if (className) element.classList.add(className);
    }, []);

    const startMenuStress = useCallback((element) => {
        clearMenuStress(element);
        setMenuStress(element, 1);
        menuStressTimersRef.current = [
            window.setTimeout(() => setMenuStress(element, 2), 1500),
            window.setTimeout(() => setMenuStress(element, 3), 3000),
            window.setTimeout(() => setMenuStress(element, 4), 4500),
        ];
    }, [clearMenuStress, setMenuStress]);

    const menuStressHandlers = useCallback(() => ({
        onMouseEnter: (event) => startMenuStress(event.currentTarget),
        onMouseLeave: (event) => clearMenuStress(event.currentTarget),
        onFocus: (event) => startMenuStress(event.currentTarget),
        onBlur: (event) => clearMenuStress(event.currentTarget),
    }), [clearMenuStress, startMenuStress]);

    const resetMenuTransitions = useCallback(() => {
        clearMenuTimer();
        clearAllMenuStress();
        setIsMenuTransitioning(false);
        setIsMenuTransitionPending(false);
    }, [clearAllMenuStress, clearMenuTimer]);

    const triggerMenuRipple = useCallback((element, point) => {
        const stageElement = element.closest('[data-login-transition-stage="true"]');
        if (!(stageElement instanceof HTMLElement)) return;

        const stageRect = stageElement.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const clientX = point?.clientX ?? elementRect.left + elementRect.width / 2;
        const clientY = point?.clientY ?? elementRect.top + elementRect.height / 2;
        const nextRipple = {
            id: rippleIdRef.current,
            x: ((clientX - stageRect.left) / stageRect.width) * 1440,
            y: ((clientY - stageRect.top) / stageRect.height) * 1024,
        };

        rippleIdRef.current += 1;
        setNavRipples((ripples) => [...ripples, nextRipple]);
        window.setTimeout(() => {
            setNavRipples((ripples) => ripples.filter((ripple) => ripple.id !== nextRipple.id));
        }, NAV_RIPPLE_CLEANUP_MS);
    }, []);

    const startMenuTransition = useCallback((item) => {
        setActiveMenu(item.id);
        setIsMenuTransitioning(false);
        window.requestAnimationFrame(() => setIsMenuTransitioning(true));

        if (onMenuCommit) {
            menuCommitTimerRef.current = window.setTimeout(() => onMenuCommit(item), 1540);
        }
    }, [onMenuCommit]);

    const activateMenu = useCallback((item, element, point) => {
        if (
            state !== 'complete' ||
            isMenuTransitioning ||
            isMenuTransitionPending ||
            item.id === activeMenu
        ) {
            return;
        }

        setIsMenuTransitionPending(true);
        clearMenuStress(element);
        triggerMenuRipple(element, point);
        clearMenuTimer();
        menuRippleTimerRef.current = window.setTimeout(() => startMenuTransition(item), 220);
    }, [activeMenu, clearMenuStress, clearMenuTimer, isMenuTransitionPending, isMenuTransitioning, startMenuTransition, state, triggerMenuRipple]);

    useEffect(() => {
        if (!onMenuCommit || isMenuTransitioning || isMenuTransitionPending) return;
        setActiveMenu(activeMenuId);
    }, [activeMenuId, isMenuTransitionPending, isMenuTransitioning, onMenuCommit]);

    useEffect(() => {
        if (!isMenuTransitioning) return undefined;

        const timeoutId = window.setTimeout(() => {
            setIsMenuTransitioning(false);
            setIsMenuTransitionPending(false);
        }, 1900);

        return () => window.clearTimeout(timeoutId);
    }, [isMenuTransitioning]);

    useEffect(() => () => {
        clearMenuTimer();
        clearAllMenuStress();
    }, [clearAllMenuStress, clearMenuTimer]);

    return {
        activeMenu,
        activateMenu,
        isMenuTransitioning,
        isMenuTransitionPending,
        menuStressHandlers,
        navRipples,
        resetMenuTransitions,
    };
}

function useGradeTransition(state, activeMenu, isMenuTransitioning, gradeTermsInput, deferInitialGradeRender = false) {
    const gradeTerms = useMemo(() => normalizeGradeTerms(gradeTermsInput), [gradeTermsInput]);
    const gradeTermsKey = useMemo(() => getGradeTermsKey(gradeTerms), [gradeTerms]);
    const initialGradeTermIndex = useMemo(() => getInitialGradeTermIndex(gradeTerms), [gradeTerms]);
    const [gradeActiveTermIndex, setGradeActiveTermIndex] = useState(initialGradeTermIndex);
    const [isGradeTeleporting, setIsGradeTeleporting] = useState(false);
    const [isGradeWheeling, setIsGradeWheeling] = useState(false);
    const [isGradePreparing, setIsGradePreparing] = useState(false);
    const [gradeFragmentLevel, setGradeFragmentLevel] = useState(0);
    const [isGradeInitialRendering, setIsGradeInitialRendering] = useState(false);
    const [isGradeMenuRendering, setIsGradeMenuRendering] = useState(false);
    const [gradeSwapPhase, setGradeSwapPhase] = useState('idle');
    const [gradeDirection, setGradeDirection] = useState('down');
    const gradeInitialRenderTimerRef = useRef(null);
    const gradeWheelAccumulatorRef = useRef(0);
    const gradeWheelDirectionRef = useRef(0);
    const gradeWheelResetTimerRef = useRef(null);
    const gradeWheelCooldownUntilRef = useRef(0);
    const gradeSwapOutTimerRef = useRef(null);
    const gradeSwapInTimerRef = useRef(null);
    const renderedGradeKeyRef = useRef(gradeTermsKey);
    const didInitializeGradeTermsRef = useRef(false);
    const pendingGradeRenderModeRef = useRef('initial');
    const deferInitialGradeRenderRef = useRef(deferInitialGradeRender);

    const clearGradeTimers = useCallback(() => {
        const clearTimerRef = (timerRef) => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };

        [
            gradeInitialRenderTimerRef,
            gradeWheelResetTimerRef,
            gradeSwapOutTimerRef,
            gradeSwapInTimerRef,
        ].forEach(clearTimerRef);
    }, []);

    useEffect(() => {
        deferInitialGradeRenderRef.current = deferInitialGradeRender;
    }, [deferInitialGradeRender]);


    const startGradeInitialRender = useCallback((mode = 'initial') => {
        setIsGradeInitialRendering(false);
        setIsGradeMenuRendering(false);
        window.requestAnimationFrame(() => {
            setIsGradeMenuRendering(mode === 'menu');
            setIsGradeInitialRendering(true);
        });
        if (gradeInitialRenderTimerRef.current !== null) {
            window.clearTimeout(gradeInitialRenderTimerRef.current);
        }
        gradeInitialRenderTimerRef.current = window.setTimeout(() => {
            setIsGradeInitialRendering(false);
            setIsGradeMenuRendering(false);
        }, 3600);
    }, []);

    useEffect(() => {
        clearGradeTimers();
        gradeWheelAccumulatorRef.current = 0;
        gradeWheelDirectionRef.current = 0;
        gradeWheelCooldownUntilRef.current = 0;
        setGradeActiveTermIndex(initialGradeTermIndex);
        setIsGradeTeleporting(false);
        setIsGradeWheeling(false);
        setIsGradePreparing(false);
        setGradeFragmentLevel(0);
        setGradeSwapPhase('idle');
        setIsGradeInitialRendering(false);
        setIsGradeMenuRendering(false);

        if (didInitializeGradeTermsRef.current) {
            renderedGradeKeyRef.current = '';
            pendingGradeRenderModeRef.current = deferInitialGradeRenderRef.current ? 'initial' : 'menu';
        } else {
            didInitializeGradeTermsRef.current = true;
            renderedGradeKeyRef.current = gradeTermsKey;
        }
    }, [clearGradeTimers, gradeTermsKey, initialGradeTermIndex]);

    useEffect(() => {
        if (state !== 'complete' || activeMenu !== 'grade' || isMenuTransitioning) {
            if (activeMenu !== 'grade') {
                renderedGradeKeyRef.current = '';
                pendingGradeRenderModeRef.current = 'menu';
            }
            return;
        }

        if (renderedGradeKeyRef.current === gradeTermsKey) return;
        renderedGradeKeyRef.current = gradeTermsKey;
        startGradeInitialRender(pendingGradeRenderModeRef.current);
        pendingGradeRenderModeRef.current = 'menu';
    }, [activeMenu, gradeTermsKey, isMenuTransitioning, startGradeInitialRender, state]);


    const handleGradeWheel = useCallback((event) => {
        const maxTermIndex = Math.max(1, gradeTerms.length - 2);
        if (
            state !== 'complete' ||
            activeMenu !== 'grade' ||
            isMenuTransitioning ||
            isGradeInitialRendering ||
            maxTermIndex <= 1
        ) {
            return;
        }

        const normalizedDeltaY = event.deltaMode === 1
            ? event.deltaY * 16
            : event.deltaMode === 2
                ? event.deltaY * (window.innerHeight || 120)
                : event.deltaY;
        const normalizedDeltaX = event.deltaMode === 1
            ? event.deltaX * 16
            : event.deltaMode === 2
                ? event.deltaX * (window.innerWidth || 120)
                : event.deltaX;
        const absDeltaY = Math.abs(normalizedDeltaY);
        const absDeltaX = Math.abs(normalizedDeltaX);

        if (absDeltaY < 0.5 || absDeltaY < absDeltaX * GRADE_WHEEL_AXIS_LOCK_RATIO) return;
        const now = window.performance?.now ? window.performance.now() : Date.now();
        if (now < gradeWheelCooldownUntilRef.current) {
            event.preventDefault();
            return;
        }


        event.preventDefault();
        if (isGradeTeleporting) return;
        setIsGradeWheeling(true);

        if (gradeWheelResetTimerRef.current !== null) {
            window.clearTimeout(gradeWheelResetTimerRef.current);
        }
        gradeWheelResetTimerRef.current = window.setTimeout(() => {
            gradeWheelAccumulatorRef.current = 0;
            gradeWheelDirectionRef.current = 0;
            gradeWheelResetTimerRef.current = null;
            setIsGradeWheeling(false);
            setIsGradePreparing(false);
            setGradeFragmentLevel(0);
        }, GRADE_WHEEL_RESET_MS);


        const wheelDirection = normalizedDeltaY > 0 ? -1 : 1;
        if (gradeWheelDirectionRef.current !== wheelDirection) {
            gradeWheelAccumulatorRef.current = 0;
            gradeWheelDirectionRef.current = wheelDirection;
        }

        const nextAccumulator = gradeWheelAccumulatorRef.current + normalizedDeltaY;
        gradeWheelAccumulatorRef.current = nextAccumulator;
        setGradeFragmentLevel((currentLevel) => {
            const nextLevel = getGradeFragmentLevel(Math.min(1, Math.abs(nextAccumulator) / GRADE_WHEEL_THRESHOLD_PX));
            return currentLevel === nextLevel ? currentLevel : nextLevel;
        });

        if (Math.abs(nextAccumulator) < GRADE_WHEEL_THRESHOLD_PX) {
            setIsGradePreparing(true);
            return;
        }

        gradeWheelAccumulatorRef.current = 0;
        gradeWheelDirectionRef.current = 0;
        setIsGradePreparing(false);

        const nextTermIndex = Math.min(maxTermIndex, Math.max(1, gradeActiveTermIndex + wheelDirection));
        if (nextTermIndex === gradeActiveTermIndex) return;
        gradeWheelCooldownUntilRef.current = now + GRADE_SWAP_OUT_MS + GRADE_SWAP_IN_MS + GRADE_WHEEL_COOLDOWN_MS;

        setGradeDirection(nextTermIndex > gradeActiveTermIndex ? 'down' : 'up');
        setGradeSwapPhase('out');
        setIsGradeTeleporting(true);

        if (gradeSwapOutTimerRef.current !== null) window.clearTimeout(gradeSwapOutTimerRef.current);
        if (gradeSwapInTimerRef.current !== null) window.clearTimeout(gradeSwapInTimerRef.current);

        gradeSwapOutTimerRef.current = window.setTimeout(() => {
            setGradeActiveTermIndex(nextTermIndex);
            setGradeSwapPhase('in');
            gradeSwapOutTimerRef.current = null;

            gradeSwapInTimerRef.current = window.setTimeout(() => {
                setIsGradeTeleporting(false);
                setGradeSwapPhase('idle');
                gradeSwapInTimerRef.current = null;
            }, GRADE_SWAP_IN_MS);
        }, GRADE_SWAP_OUT_MS);
    }, [activeMenu, gradeActiveTermIndex, gradeTerms.length, isGradeInitialRendering, isGradeTeleporting, isMenuTransitioning, state]);

    useEffect(() => () => clearGradeTimers(), [clearGradeTimers]);

    const gradeFragmentClass = gradeFragmentLevel === 3
        ? styles.isGradeFragmentFine
        : gradeFragmentLevel === 2
            ? styles.isGradeFragmentMid
            : gradeFragmentLevel === 1
                ? styles.isGradeFragmentCoarse
                : null;

    return {
        activeRows: gradeTerms[gradeActiveTermIndex]?.rows || normalizeGradeRows(),
        direction: gradeDirection,
        fragmentClass: gradeFragmentClass,
        handleWheel: handleGradeWheel,
        isInitialRendering: isGradeInitialRendering,
        isMenuRendering: isGradeMenuRendering,
        isPreparing: isGradePreparing,
        isTeleporting: isGradeTeleporting,
        isWheeling: isGradeWheeling,
        swapPhase: gradeSwapPhase,
        visibleTerms: gradeTerms.slice(gradeActiveTermIndex - 1, gradeActiveTermIndex + 2),
    };
}

function LogoutButton({ onClick }) {
    return (
        <button
            className={styles.loginTransitionLogout}
            type="button"
            aria-label="Logout"
            onClick={onClick}
        >
            <svg
                className={styles.loginTransitionLogoutIcon}
                width="20"
                height="20"
                viewBox="0 0 20 20"
                aria-hidden="true"
            >
                <circle
                    className={styles.loginTransitionLogoutIconCircle}
                    cx="10"
                    cy="10"
                    r="9"
                    pathLength="1"
                />
                <rect
                    className={styles.loginTransitionLogoutIconMask}
                    x="7"
                    y="0"
                    width="6"
                    height="15"
                />
                <line
                    className={styles.loginTransitionLogoutIconLine}
                    x1="10"
                    y1="-3"
                    x2="10"
                    y2="12"
                />
            </svg>
        </button>
    );
}

function RegLogo() {
    return (
        <svg className={styles.loginTransitionRegLogo} viewBox="0 0 136 49" aria-hidden="true">
            <path
                className={styles.loginTransitionRegPath}
                pathLength="1"
                d="M0 1.38199H21.7478C28.7289 1.15886 34.579 6.81644 34.5537 13.6977C34.5319 20.5501 28.6963 26.1537 21.7478 25.9342H10.8739C18.7684 33.3733 26.6628 40.8087 34.5537 48.2478"
            />
            <path
                className={styles.loginTransitionRegPath}
                pathLength="1"
                d="M81.9276 1.37842H49.1863L63.9241 24.8149L49.1863 48.2514H81.9276"
            />
            <path
                className={styles.loginTransitionRegPath}
                pathLength="1"
                d="M116.844 24.8149H135.275V36.9434"
            />
            <path
                className={styles.loginTransitionRegPath}
                pathLength="1"
                d="M135.275 16.3861V9.0694C134.34 7.96092 128.008 0.723387 117.732 0.719788C115.811 0.719788 107.282 0.968117 101.783 7.51105C97.5245 12.5748 97.597 18.4159 97.6768 24.8149C97.7565 31.2211 97.8254 37.0658 102.146 41.9424C108.098 48.6581 117.504 48.3378 119.182 48.2514C122.161 48.2622 125.141 48.273 128.124 48.2802"
            />
            <circle className={styles.loginTransitionRegOrigin} cx="0" cy="1.38" r="3" />
            <circle className={styles.loginTransitionRegOrigin} cx="49.18" cy="1.38" r="3" />
            <circle className={styles.loginTransitionRegOrigin} cx="117.73" cy="0.72" r="3" />
        </svg>
    );
}

function HeroTitle() {
    return <h1 className={styles.loginTransitionHeroTitle}>Hero Section</h1>;
}

function HeroNav({
    activateMenu,
    interactive = true,
    menuStressHandlers,
    navItems = DEFAULT_NAV_ITEMS,
    userMeta = 'YEAR 2 GPAX 4.00',
    userName = 'WORRAPONG SUNGPUK',
}) {
    const normalizedItems = navItems.map(normalizeNavItem);
    const stressHandlers = interactive && typeof menuStressHandlers === 'function'
        ? menuStressHandlers()
        : {};

    const makeKeyHandler = (item) => (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        activateMenu(item, event.currentTarget);
    };

    const makeClickHandler = (item) => (event) => {
        activateMenu(item, event.currentTarget, {
            clientX: event.clientX,
            clientY: event.clientY,
        });
    };

    return (
        <aside className={styles.loginTransitionNav} aria-hidden={!interactive} aria-label="Student navigation">
            <span className={styles.loginTransitionUserName} aria-label={userName}>
                {renderHeroText(userName)}
            </span>
            <span className={styles.loginTransitionUserMeta} aria-label={userMeta}>
                {renderHeroText(userMeta)}
            </span>
            {normalizedItems.map((item) => (
                <span
                    className={classNames(navSlotClassName[item.slot], styles.loginTransitionMenuItem)}
                    aria-label={item.label}
                    data-login-transition-menu-item="true"
                    role={interactive ? 'button' : undefined}
                    tabIndex={interactive ? 0 : -1}
                    onClick={interactive ? makeClickHandler(item) : undefined}
                    onKeyDown={interactive ? makeKeyHandler(item) : undefined}
                    key={item.id}
                    {...stressHandlers}
                >
                    {renderHeroText(item.label)}
                </span>
            ))}
        </aside>
    );
}

function GradePanel({ grade }) {
    return (
        <>
            {grade.visibleTerms.map((term, index) => (
                <span
                    className={classNames(styles.loginTransitionGradeTerm, gradeTermSlotClassName[index])}
                    key={`${term.term || 'blank'}-${index}`}
                    aria-label={term.term}
                >
                    {renderGradeTermText(term.term)}
                </span>
            ))}
            {GRADE_ROW_SLOTS.map((slot, index) => {
                const row = grade.activeRows[index] || {};
                const subject = splitGradeSubject(row.subject);

                return (
                    <span
                        className={styles.loginTransitionGradeSubject}
                        key={`grade-subject-${index}`}
                        aria-label={row.subject || ''}
                        style={{
                            '--subject-top': `${slot.top}px`,
                            '--subject-height': `${slot.height}px`,
                            '--subject-duration': `${760 + (GRADE_ROW_SLOTS.length - 1 - index) * 70}ms`,
                        }}
                    >
                        {subject.code ? (
                            <span className={styles.loginTransitionGradeCode} aria-hidden="true">
                                {subject.code.split('').map((char, charIndex) => (
                                    <span
                                        className={styles.loginTransitionGradeCodeChar}
                                        key={`${subject.code}-${charIndex}`}
                                    >
                                        {char}
                                    </span>
                                ))}
                            </span>
                        ) : null}
                        <span className={styles.loginTransitionGradeCourseName}>
                            {subject.name}
                        </span>
                    </span>
                );
            })}
            {GRADE_ROW_SLOTS.map((slot, index) => {
                const row = grade.activeRows[index] || {};
                return (
                    <span
                        className={styles.loginTransitionGradeUnit}
                        key={`grade-unit-${index}`}
                        aria-label={row.unit || ''}
                        style={{
                            '--unit-top': `${slot.top}px`,
                            '--unit-height': `${slot.height}px`,
                            '--unit-duration': `${760 + (GRADE_ROW_SLOTS.length - 1 - index) * 70}ms`,
                        }}
                    >
                        {row.unit}
                    </span>
                );
            })}
            {GRADE_ROW_SLOTS.map((slot, index) => {
                const row = grade.activeRows[index] || {};
                return (
                    <span
                        className={styles.loginTransitionGradeScore}
                        key={`grade-score-${index}`}
                        aria-label={row.score || ''}
                        style={{
                            '--grade-score-top': `${slot.top}px`,
                            '--grade-score-height': `${slot.height}px`,
                            '--grade-score-duration': `${760 + (GRADE_ROW_SLOTS.length - 1 - index) * 70}ms`,
                        }}
                    >
                        {row.score}
                    </span>
                );
            })}
        </>
    );
}

function HeroPanel({ activeMenu, children, grade, onGradeWheel }) {
    const showGradeCanvas = activeMenu === 'grade' && grade;
    const hasContent = Boolean(children) && !showGradeCanvas;

    return (
        <section
            className={styles.loginTransitionHeroPanel}
            aria-hidden={hasContent || showGradeCanvas ? undefined : true}
            aria-label={hasContent || showGradeCanvas ? 'Portal content' : undefined}
            onWheel={showGradeCanvas ? onGradeWheel : undefined}
        >
            <span className={styles.loginTransitionHeroPanelSurface} aria-hidden="true" />
            <span className={styles.loginTransitionHeroPanelRevealLayer} aria-hidden="true">{renderHeroPanelTeeth()}</span>
            {showGradeCanvas && <GradePanel grade={grade} />}
            <span className={styles.loginTransitionMenuOverlay} aria-hidden="true">
                <span className={classNames(styles.loginTransitionMenuLine, styles.isBlack)} />
                <span className={classNames(styles.loginTransitionMenuLayer, styles.isBlack)}>
                    {renderMenuTransitionTeeth()}
                </span>
                <span className={classNames(styles.loginTransitionMenuLine, styles.isNext)} />
                <span className={classNames(styles.loginTransitionMenuLayer, styles.isNext)}>
                    {renderMenuTransitionTeeth()}
                </span>
            </span>
            {hasContent && (
                <div className={styles.loginTransitionHeroPanelContent}>
                    {children}
                </div>
            )}
        </section>
    );
}


function RippleLayer({ clipIdBase, navRipples }) {
    const navClipId = `${clipIdBase}-nav`;
    const mainClipId = `${clipIdBase}-main`;

    return (
        <>
            <svg
                className={styles.loginTransitionNavRippleLayer}
                viewBox="0 0 1440 1024"
                preserveAspectRatio="none"
                aria-hidden="true"
            >
                <defs>
                    <clipPath id={navClipId}>
                        <rect x="0" y="0" width="389" height="1024" />
                    </clipPath>
                    <clipPath id={mainClipId}>
                        <rect x="389" y="0" width="1051" height="1024" />
                    </clipPath>
                </defs>
                <g clipPath={`url(#${navClipId})`}>
                    {navRipples.flatMap((ripple) =>
                        Array.from({ length: NAV_RIPPLE_RING_COUNT }, (_, index) => (
                            <circle
                                className={classNames(styles.loginTransitionNavRippleRing, styles.isNav)}
                                cx={ripple.x}
                                cy={ripple.y}
                                key={`nav-${ripple.id}-${index}`}
                                r="2"
                                style={{ animationDelay: `${index * NAV_RIPPLE_RING_DELAY_MS}ms` }}
                            />
                        )),
                    )}
                </g>
                <g clipPath={`url(#${mainClipId})`}>
                    {navRipples.flatMap((ripple) =>
                        Array.from({ length: NAV_RIPPLE_RING_COUNT }, (_, index) => (
                            <circle
                                className={classNames(styles.loginTransitionNavRippleRing, styles.isMain)}
                                cx={ripple.x}
                                cy={ripple.y}
                                key={`main-${ripple.id}-${index}`}
                                r="2"
                                style={{ animationDelay: `${index * NAV_RIPPLE_RING_DELAY_MS}ms` }}
                            />
                        )),
                    )}
                </g>
            </svg>
            <svg
                className={styles.loginTransitionNavRippleImpactLayer}
                viewBox="0 0 1440 1024"
                preserveAspectRatio="none"
                aria-hidden="true"
            >
                {navRipples.flatMap((ripple) =>
                    Array.from({ length: NAV_RIPPLE_RING_COUNT }, (_, ringIndex) => {
                        const impactDelay = getNavRippleAbsorbDelay(ripple, ringIndex);
                        return getNavRippleAbsorbSegments(ripple).flatMap((segment, segmentIndex) => {
                            const delay = impactDelay + segment.delayOffset;
                            const key = `${ripple.id}-${ringIndex}-${segment.edge}-${segmentIndex}`;
                            const style = { '--impact-delay': `${delay}ms` };

                            return [
                                <line
                                    className={styles.loginTransitionNavRippleAbsorbBloom}
                                    key={`bloom-${key}`}
                                    pathLength="1"
                                    style={style}
                                    x1={segment.x1}
                                    y1={segment.y1}
                                    x2={segment.x2}
                                    y2={segment.y2}
                                />,
                                <line
                                    className={styles.loginTransitionNavRippleAbsorbSegment}
                                    key={`segment-${key}`}
                                    pathLength="1"
                                    style={style}
                                    x1={segment.x1}
                                    y1={segment.y1}
                                    x2={segment.x2}
                                    y2={segment.y2}
                                />,
                            ];
                        });
                    }),
                )}
            </svg>
        </>
    );
}

function TransitionLayers({ onFrontWipeEnd }) {
    return (
        <div className={styles.loginTransitionLayers} aria-hidden="true">
            <div className={styles.loginTransitionRed} />
            <div className={styles.loginTransitionMiddle} />
            <div
                className={styles.loginTransitionFront}
                onAnimationEnd={onFrontWipeEnd}
            />
        </div>
    );
}

function AnimatedLoginButton({ disabled }) {
    return (
        <button
            className={styles.loginTransitionButton}
            type="submit"
            aria-label="Login"
            disabled={disabled}
        >
            <svg
                className={styles.loginTransitionButtonBorderSvg}
                width="238"
                height="41"
                viewBox="0 0 238 41"
                aria-hidden="true"
            >
                <path
                    className={styles.loginTransitionButtonBorderTop}
                    pathLength="1"
                    d="M234 20.5V4H4V20.5"
                />
                <path
                    className={styles.loginTransitionButtonBorderBottom}
                    pathLength="1"
                    d="M234 20.5V37H4V20.5"
                />
                <path
                    className={styles.loginTransitionButtonBorderTopReverse}
                    pathLength="1"
                    d="M4 20.5V4H234V20.5"
                />
                <path
                    className={styles.loginTransitionButtonBorderBottomReverse}
                    pathLength="1"
                    d="M4 20.5V37H234V20.5"
                />
            </svg>
            <span className={styles.loginTransitionArrow} aria-hidden="true">
                <span className={styles.loginTransitionArrowLine} />
                <span className={styles.loginTransitionArrowHeadTop} />
                <span className={styles.loginTransitionArrowHeadBottom} />
            </span>
        </button>
    );
}

function SsoDivider() {
    return (
        <div className={styles.loginTransitionSsoDivider} aria-hidden="true">
            <svg width="237" height="16" viewBox="0 0 237 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                    d="M0 14.77H108.18V0.5H116V8H118V0.5H128C128 2.6 127.36 6.96 121 8.5L131.86 14.77H237"
                    stroke="black"
                    strokeWidth="1"
                    strokeLinejoin="miter"
                    strokeLinecap="butt"
                />
            </svg>
        </div>
    );
}

function ContractLink() {
    return (
        <div className={styles.loginTransitionContractLink} aria-hidden="true">
            <span className={styles.loginTransitionContractText}>{renderContractText()}</span>
        </div>
    );
}

function LoginControlLayer({
    disabled,
    error,
    formId,
    frozenCredentials,
    onPasswordChange,
    onSsoLogin,
    onSubmit,
    onUsernameChange,
    password,
    ssoDisabled,
    ssoTitle,
    username,
}) {
    const [focusedInput, setFocusedInput] = useState(null);
    const [passwordShiftKey, setPasswordShiftKey] = useState(0);
    const errorId = `${formId}-error`;
    const passwordDisplay = '*'.repeat(Math.min(password.length, 8));
    const hasFrozenCredentials = Boolean(frozenCredentials);
    const visualUsername = frozenCredentials?.username ?? username;
    const visualPasswordDisplay = frozenCredentials?.passwordDisplay ?? passwordDisplay;
    const visualPasswordLength = hasFrozenCredentials ? visualPasswordDisplay.length : password.length;
    const shouldSuppressPlaceholders = Boolean(error) || hasFrozenCredentials;

    const inputVisualClass = (field, value, overflowAt) =>
        classNames(
            styles.loginTransitionInputVisual,
            field === 'username' ? styles.loginTransitionUsernameVisual : styles.loginTransitionPasswordVisual,
            value.length > 0 ? styles.hasValue : null,
            focusedInput === field ? styles.isFocused : null,
            field === 'username' && value.length > overflowAt ? styles.isOverflowing : null,
        );

    const handlePasswordChange = (nextPassword) => {
        if (nextPassword.length > password.length && password.length >= 8) {
            setPasswordShiftKey((key) => key + 1);
        }

        onPasswordChange(nextPassword);
    };

    return (
        <form id={formId} className={styles.loginTransitionForm} onSubmit={onSubmit} noValidate>
            <button
                className={styles.loginTransitionSsoButton}
                type="button"
                aria-label="SSO login"
                disabled={ssoDisabled}
                onClick={onSsoLogin}
                title={ssoTitle}
            />
            <div className={styles.loginTransitionSsoLabel} aria-hidden="true">
                <span className={styles.loginTransitionSsoLabelText}>SSO</span>
            </div>

            <SsoDivider />

            <input
                className={styles.loginTransitionUsernameInput}
                id="username"
                type="text"
                aria-label="Username"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                autoComplete="username"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                required
                placeholder="user"
                value={username}
                onChange={(event) => onUsernameChange(sanitizeUsername(event.currentTarget.value))}
                onFocus={() => setFocusedInput('username')}
                onBlur={() => setFocusedInput(null)}
                disabled={disabled}
            />

            <div className={inputVisualClass('username', visualUsername, 18)} aria-hidden="true">
                <span className={styles.loginTransitionInputVisualText}>{visualUsername}</span>
                <span className={styles.loginTransitionInputVisualCaret} />
            </div>

            <div
                className={classNames(
                    styles.loginTransitionUsernameLabel,
                    shouldSuppressPlaceholders || focusedInput === 'username' || visualUsername.length > 0 ? styles.isHidden : null,
                )}
                aria-hidden="true"
            >
                <span className={styles.loginTransitionUsernameLabelText}>user</span>
            </div>

            <input
                className={styles.loginTransitionPasswordInput}
                id="password"
                type="password"
                aria-label="Password"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                autoComplete="current-password"
                required
                placeholder="pass"
                value={password}
                onChange={(event) => handlePasswordChange(event.currentTarget.value)}
                onFocus={() => setFocusedInput('password')}
                onBlur={() => setFocusedInput(null)}
                disabled={disabled}
            />

            <div className={inputVisualClass('password', visualPasswordDisplay, 8)} aria-hidden="true">
                <span
                    key={passwordShiftKey}
                    className={classNames(
                        styles.loginTransitionInputVisualText,
                        passwordShiftKey > 0 ? styles.isShifting : null,
                    )}
                >
                    {visualPasswordDisplay}
                </span>
                <span className={styles.loginTransitionInputVisualCaret} />
            </div>

            <div
                className={classNames(
                    styles.loginTransitionPasswordLabel,
                    shouldSuppressPlaceholders || focusedInput === 'password' || visualPasswordLength > 0 ? styles.isHidden : null,
                )}
                aria-hidden="true"
            >
                <span className={styles.loginTransitionPasswordLabelText}>pass</span>
            </div>

            <ContractLink />

            {error && (
                <p className={styles.loginTransitionErrorMessage} id={errorId} role="alert" aria-live="assertive">
                    {error}
                </p>
            )}

            <AnimatedLoginButton disabled={disabled} />
        </form>
    );
}

function StageFrame({
    children,
    className,
    gradeTerms,
    onLogoutClick,
    onFrontWipeEnd,
    menu,
    navItems,
    overlays,
    revealNavText = false,
    state,
    userMeta,
    userName,
}) {
    const clipIdBase = useId().replaceAll(':', '');
    const canvasScale = useCanvasScale();
    const grade = useGradeTransition(state, menu.activeMenu, menu.isMenuTransitioning || menu.isMenuTransitionPending, gradeTerms, revealNavText);
    const stageClassName = classNames(
        styles.loginTransitionStage,
        stateClassName[state],
        menu.isMenuTransitioning ? styles.isMenuTransitioning : null,
        revealNavText ? styles.isNavTextRevealing : null,
        grade.isTeleporting ? styles.isGradeTeleporting : null,
        grade.isWheeling ? styles.isGradeWheeling : null,
        grade.isPreparing ? styles.isGradePreparing : null,
        grade.isInitialRendering ? styles.isGradeInitialRendering : null,
        grade.isMenuRendering ? styles.isGradeMenuRendering : null,
        grade.fragmentClass,
        className,
    );
    const stageStyle = canvasScale === null ? undefined : { '--login-canvas-scale': canvasScale };
    const canvasStyle = stageStyle;

    return (
        <main
            className={stageClassName}
            data-active-menu={menu.activeMenu}
            data-grade-direction={grade.direction}
            data-grade-swap-phase={grade.swapPhase}
            id="main-content"
            style={stageStyle}
        >
            <div
                className={styles.loginTransitionCanvas}
                style={canvasStyle}
                data-active-menu={menu.activeMenu}
                data-login-transition-stage="true"
            >
                <section className={styles.loginTransitionHero} aria-label="Hero Section">
                    <HeroNav
                        activateMenu={menu.activateMenu}
                        interactive={state === 'complete'}
                        menuStressHandlers={menu.menuStressHandlers}
                        navItems={navItems}
                        userMeta={userMeta}
                        userName={userName}
                    />
                    <div className={styles.loginTransitionMain}>
                        {(state === 'complete' || state === 'loggingOut') && <LogoutButton onClick={onLogoutClick} />}
                        <HeroPanel activeMenu={menu.activeMenu} grade={grade} onGradeWheel={grade.handleWheel}>{children}</HeroPanel>
                    </div>
                </section>

                <RippleLayer clipIdBase={clipIdBase} navRipples={menu.navRipples} />
                <TransitionLayers onFrontWipeEnd={onFrontWipeEnd} />

                <div className={styles.loginTransitionRegMotion} aria-hidden="true">
                    <RegLogo />
                </div>

                {overlays}
            </div>
        </main>
    );
}

export function ProductionHeroShell({
    activeMenu = 'grade',
    children = <HeroTitle />,
    gradeTerms,
    navItems = DEFAULT_NAV_ITEMS,
    onLogout,
    onNavigate,
    userMeta = 'YEAR 2 GPAX 4.00',
    userName = 'WORRAPONG SUNGPUK',
}) {
    const [state, setState] = useState('complete');
    const [isInitialContentRevealPending, setIsInitialContentRevealPending] = useState(true);

    useEffect(() => {
        const revealTimerId = window.setTimeout(() => {
            setIsInitialContentRevealPending(false);
        }, 2060);

        return () => window.clearTimeout(revealTimerId);
    }, []);
    const menu = useMenuTransition(state, onNavigate, activeMenu);

    const startLogoutTransition = useCallback(() => {
        if (state !== 'complete') return;
        menu.resetMenuTransitions();
        setState('loggingOut');
    }, [menu, state]);

    const finishLogoutTransition = useCallback(() => {
        if (state !== 'loggingOut') return;
        setState('idle');
        onLogout?.();
    }, [onLogout, state]);

    const handleFrontWipeEnd = useCallback((event) => {
        if (event.target !== event.currentTarget) return;
        finishLogoutTransition();
    }, [finishLogoutTransition]);

    useEffect(() => {
        if (state !== 'loggingOut') return undefined;

        const timeoutId = window.setTimeout(finishLogoutTransition, 3600);
        return () => window.clearTimeout(timeoutId);
    }, [finishLogoutTransition, state]);

    return (
        <StageFrame
            className={classNames(
                styles.productionHeroStage,
                isInitialContentRevealPending ? styles.isProductionInitialRendering : null,
            )}
            revealNavText={isInitialContentRevealPending}
            gradeTerms={gradeTerms}
            menu={menu}
            navItems={navItems}
            onFrontWipeEnd={handleFrontWipeEnd}
            onLogoutClick={startLogoutTransition}
            overlays={state === 'loggingOut' ? (
                <LoginControlLayer
                    disabled
                    error=""
                    formId={DEFAULT_LOGIN_FORM_ID}
                    frozenCredentials={null}
                    onPasswordChange={() => {}}
                    onSsoLogin={() => {}}
                    onSubmit={(event) => event.preventDefault()}
                    onUsernameChange={() => {}}
                    password=""
                    ssoDisabled
                    ssoTitle="Login form is returning"
                    username=""
                />
            ) : null}
            state={state}
            userMeta={userMeta}
            userName={userName}
        >
            {children}
        </StageFrame>
    );
}

export default function LoginTransitionShell({
    children = <HeroTitle />,
    error = '',
    formId = DEFAULT_LOGIN_FORM_ID,
    gradeTerms,
    onLoginComplete,
    onLoginStart,
    onLogout,
    onPasswordChange = () => {},
    onSsoLogin,
    onUsernameChange = () => {},
    password = '',
    ssoDisabled = false,
    ssoTitle = 'Sign in with KMUTNB SSO',
    submitDisabled = false,
    username = '',
}) {
    const [state, setState] = useState('idle');
    const [frozenCredentials, setFrozenCredentials] = useState(null);
    const [isCompleteContentRevealPending, setIsCompleteContentRevealPending] = useState(false);
    const menu = useMenuTransition(state);
    const isLocked = state === 'running' || state === 'loggingOut';
    const isSubmitDisabled = submitDisabled || isLocked || state === 'complete';

    const startLoginTransition = useCallback(async (event) => {
        event?.preventDefault();
        if (isSubmitDisabled) return;

        const submittedCredentials = {
            username,
            passwordDisplay: '*'.repeat(Math.min(password.length, 8)),
        };
        const shouldRun = await onLoginStart?.();
        if (shouldRun === false) return;

        setFrozenCredentials(submittedCredentials);
        setIsCompleteContentRevealPending(false);
        menu.resetMenuTransitions();
        setState('running');
    }, [isSubmitDisabled, menu, onLoginStart, password, username]);

    const startLogoutTransition = useCallback(() => {
        if (state !== 'complete') return;
        menu.resetMenuTransitions();
        setIsCompleteContentRevealPending(false);
        setState('loggingOut');
    }, [menu, state]);

    const finishLogoutTransition = useCallback(() => {
        if (state !== 'loggingOut') return;
        setFrozenCredentials(null);
        setState('idle');
        onLogout?.();
    }, [onLogout, state]);

    const handleFrontWipeEnd = useCallback((event) => {
        if (event.target !== event.currentTarget) return;

        if (state === 'running') {
            setIsCompleteContentRevealPending(true);
            setState('complete');
            onLoginComplete?.();
            return;
        }

        finishLogoutTransition();
    }, [finishLogoutTransition, onLoginComplete, state]);

    useEffect(() => {
        if (state !== 'loggingOut') return undefined;

        const timeoutId = window.setTimeout(finishLogoutTransition, 3600);
        return () => window.clearTimeout(timeoutId);
    }, [finishLogoutTransition, state]);

    useEffect(() => {
        if (!isCompleteContentRevealPending) return undefined;

        const revealTimerId = window.setTimeout(() => {
            setIsCompleteContentRevealPending(false);
        }, 2060);

        return () => window.clearTimeout(revealTimerId);
    }, [isCompleteContentRevealPending]);

    return (
        <StageFrame
            gradeTerms={gradeTerms}
            menu={menu}
            navItems={DEFAULT_NAV_ITEMS}
            onFrontWipeEnd={handleFrontWipeEnd}
            onLogoutClick={startLogoutTransition}
            revealNavText={isCompleteContentRevealPending}
            overlays={(
                <LoginControlLayer
                    disabled={isSubmitDisabled}
                    error={error}
                    formId={formId}
                    frozenCredentials={state === 'idle' ? null : frozenCredentials}
                    onPasswordChange={onPasswordChange}
                    onSsoLogin={onSsoLogin}
                    onSubmit={startLoginTransition}
                    onUsernameChange={onUsernameChange}
                    password={password}
                    ssoDisabled={ssoDisabled || isLocked}
                    ssoTitle={ssoTitle}
                    username={username}
                />
            )}
            state={state}
        >
            {children}
        </StageFrame>
    );
}
