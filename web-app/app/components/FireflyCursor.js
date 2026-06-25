'use client';

import { useEffect, useRef } from 'react';

import styles from './FireflyCursor.module.css';

const TRAIL_TTL_MS = 700;
const TRAIL_MIN_DISTANCE_PX = 2.2;
const TRAIL_MAX_POINTS = 140;
const TRAIL_STROKE_WIDTH_PX = 1.65;
const IDLE_DELAY_MS = 2000;
const IDLE_TRANSITION_MS = 280;
const IDLE_RIPPLE_DURATION_MS = 860;
const IDLE_RIPPLE_START_RADIUS_PX = 6;
const IDLE_RIPPLE_END_RADIUS_PX = 34;
const IDLE_RIPPLE_LINE_WIDTH_PX = 2;
const IDLE_RIPPLE_DASH = Object.freeze([4, 10]);
const IDLE_DOT_MIN_SCALE = 0.16;
const IDLE_HALO_MIN_SCALE = 0.68;
const MAX_DEVICE_PIXEL_RATIO = 2;
const INTERACTIVE_SELECTOR = [
    'a',
    'button',
    'input',
    'textarea',
    'select',
    'summary',
    'label',
    '[role="button"]',
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])',
].join(',');
const TEXT_INPUT_SELECTOR = [
    'input:not([type="button"]):not([type="checkbox"]):not([type="color"]):not([type="file"]):not([type="image"]):not([type="radio"]):not([type="range"]):not([type="reset"]):not([type="submit"])',
    'textarea',
    '[contenteditable="true"]',
].join(',');


function setCursorClass(enabled) {
    document.documentElement.classList.toggle('firefly-cursor-active', enabled);
}

function getDistanceSquared(first, second) {
    const dx = first.x - second.x;
    const dy = first.y - second.y;

    return dx * dx + dy * dy;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export default function FireflyCursor() {
    const rootRef = useRef(null);
    const canvasRef = useRef(null);
    const dotRef = useRef(null);
    const haloRef = useRef(null);

    useEffect(() => {
        const root = rootRef.current;
        const canvas = canvasRef.current;
        const dot = dotRef.current;
        const halo = haloRef.current;
        const context = canvas?.getContext('2d', { alpha: true });

        if (!root || !canvas || !context || !dot || !halo) {
            return undefined;
        }

        const pointerFineQuery = window.matchMedia('(pointer: fine)');
        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const trailPoints = [];
        const idleRipples = [];

        let enabled = false;
        let visible = false;
        let isIdle = false;
        let headX = -120;
        let headY = -120;
        let canvasWidth = 0;
        let canvasHeight = 0;
        let animationFrame = 0;
        let lastPointerMoveAt = 0;
        let idleStartedAt = 0;

        const setVisible = (nextVisible) => {
            if (visible === nextVisible) {
                return;
            }

            visible = nextVisible;
            root.dataset.visible = nextVisible ? 'true' : 'false';

            if (!nextVisible) {
                root.dataset.interactive = 'false';
                root.dataset.textInput = 'false';
            }
        };

        const setIdle = (nextIdle, now = performance.now()) => {
            if (isIdle === nextIdle) {
                return;
            }

            isIdle = nextIdle;
            root.dataset.idle = nextIdle ? 'true' : 'false';

            if (nextIdle) {
                idleStartedAt = now;

                if (headX >= 0 && headY >= 0 && root.dataset.textInput !== 'true') {
                    idleRipples.push({ x: headX, y: headY, startTime: now });
                }

                return;
            }

            idleStartedAt = 0;
        };

        const clearEffects = () => {
            trailPoints.length = 0;
            idleRipples.length = 0;
            root.dataset.trailPoints = '0';
            context.clearRect(0, 0, canvasWidth, canvasHeight);
        };

        const syncViewport = () => {
            const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);

            canvasWidth = window.innerWidth;
            canvasHeight = window.innerHeight;
            canvas.width = Math.max(1, Math.round(canvasWidth * pixelRatio));
            canvas.height = Math.max(1, Math.round(canvasHeight * pixelRatio));
            canvas.style.width = `${canvasWidth}px`;
            canvas.style.height = `${canvasHeight}px`;
            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            clearEffects();
        };

        const syncEnabled = () => {
            enabled = pointerFineQuery.matches && !reducedMotionQuery.matches;
            root.dataset.enabled = enabled ? 'true' : 'false';
            setCursorClass(enabled);

            if (!enabled) {
                setIdle(false);
                lastPointerMoveAt = 0;
                setVisible(false);
                clearEffects();
            }
        };

        const updateInteractiveState = (event) => {
            const target = event.target;
            const isTextInput = target instanceof Element && Boolean(target.closest(TEXT_INPUT_SELECTOR));
            const isInteractive = target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));

            root.dataset.textInput = isTextInput ? 'true' : 'false';
            root.dataset.interactive = isInteractive && !isTextInput ? 'true' : 'false';
        };

        const getHeadState = (now) => {
            const isTextInput = root.dataset.textInput === 'true';
            const isInteractive = root.dataset.interactive === 'true';
            const baseDotScale = isTextInput ? 1 : (isInteractive ? 1.18 : 1);
            const baseHaloScale = isTextInput ? 0.56 : (isInteractive ? 1.28 : 1);
            const baseDotOpacity = isTextInput ? 0.98 : 1;
            const baseHaloOpacity = isTextInput ? 0 : (isInteractive ? 0.9 : 0.74);
            const idleProgress = isIdle ? clamp((now - idleStartedAt) / IDLE_TRANSITION_MS, 0, 1) : 0;
            const dotScale = baseDotScale * (1 - ((1 - IDLE_DOT_MIN_SCALE) * idleProgress));
            const haloScale = baseHaloScale * (1 - ((1 - IDLE_HALO_MIN_SCALE) * idleProgress));
            const dotOpacity = baseDotOpacity * (1 - idleProgress);
            const haloOpacity = baseHaloOpacity * (1 - idleProgress);

            return {
                dotOpacity,
                dotScale,
                haloOpacity,
                haloScale,
            };
        };

        const positionHead = (now = performance.now()) => {
            const {
                dotOpacity,
                dotScale,
                haloOpacity,
                haloScale,
            } = getHeadState(now);
            const baseTransform = `translate3d(${headX}px, ${headY}px, 0) translate(-50%, -50%)`;

            dot.style.transform = `${baseTransform} scale(${dotScale})`;
            dot.style.opacity = `${dotOpacity}`;
            halo.style.transform = `${baseTransform} scale(${haloScale})`;
            halo.style.opacity = `${haloOpacity}`;
        };

        const pushTrailPoint = (x, y, time) => {
            const nextPoint = { x, y, time };
            const previousPoint = trailPoints[trailPoints.length - 1];
            const minimumDistanceSquared = TRAIL_MIN_DISTANCE_PX * TRAIL_MIN_DISTANCE_PX;

            if (previousPoint && getDistanceSquared(nextPoint, previousPoint) < minimumDistanceSquared) {
                return;
            }

            trailPoints.push(nextPoint);

            if (trailPoints.length > TRAIL_MAX_POINTS) {
                trailPoints.splice(0, trailPoints.length - TRAIL_MAX_POINTS);
            }
        };

        const handlePointerMove = (event) => {
            if (!enabled || (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen')) {
                return;
            }

            const now = performance.now();

            headX = event.clientX;
            headY = event.clientY;
            lastPointerMoveAt = now;
            setVisible(true);
            updateInteractiveState(event);
            setIdle(false, now);
            pushTrailPoint(headX, headY, now);
            positionHead(now);
        };

        const handlePointerLeave = () => {
            setIdle(false);
            lastPointerMoveAt = 0;
            setVisible(false);
            clearEffects();
        };
        const handleWindowBlur = () => {
            setIdle(false);
            lastPointerMoveAt = 0;
            setVisible(false);
            clearEffects();
        };

        const drawSmoothedTrailPath = (points) => {
            if (points.length < 2) {
                return;
            }

            context.beginPath();
            context.moveTo(points[0].x, points[0].y);

            for (let index = 1; index < points.length - 1; index += 1) {
                const current = points[index];
                const next = points[index + 1];
                const midX = (current.x + next.x) / 2;
                const midY = (current.y + next.y) / 2;

                context.quadraticCurveTo(current.x, current.y, midX, midY);
            }

            const last = points[points.length - 1];
            context.lineTo(last.x, last.y);
            context.stroke();
        };

        const drawIdleRipples = (now) => {
            if (idleRipples.length === 0) {
                return;
            }

            context.save();
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.strokeStyle = 'rgb(2, 6, 23)';
            context.setLineDash(IDLE_RIPPLE_DASH);

            for (let index = idleRipples.length - 1; index >= 0; index -= 1) {
                const ripple = idleRipples[index];
                const progress = clamp((now - ripple.startTime) / IDLE_RIPPLE_DURATION_MS, 0, 1);

                if (progress >= 1) {
                    idleRipples.splice(index, 1);
                    continue;
                }

                const easedProgress = 1 - Math.pow(1 - progress, 3);
                const radius = IDLE_RIPPLE_START_RADIUS_PX + ((IDLE_RIPPLE_END_RADIUS_PX - IDLE_RIPPLE_START_RADIUS_PX) * easedProgress);

                context.globalAlpha = 0.72 * (1 - progress);
                context.lineWidth = IDLE_RIPPLE_LINE_WIDTH_PX;
                context.lineDashOffset = -18 * progress;
                context.beginPath();
                context.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
                context.stroke();
            }

            context.restore();
        };

        const drawTrail = (now) => {
            while (trailPoints.length > 0 && now - trailPoints[0].time > TRAIL_TTL_MS) {
                trailPoints.shift();
            }

            if (trailPoints.length < 2) {
                root.dataset.trailPoints = String(trailPoints.length);
                return;
            }

            const newestPoint = trailPoints[trailPoints.length - 1];
            const trailFreshness = Math.min(1, Math.max(0, 1 - ((now - newestPoint.time) / TRAIL_TTL_MS)));
            const isTextInput = root.dataset.textInput === 'true';
            const trailOpacityMultiplier = isTextInput ? 0.48 : 1;
            const trailWidthMultiplier = isTextInput ? 0.78 : 1;

            context.save();
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.shadowBlur = 0;

            context.globalAlpha = 0.14 * trailFreshness * trailOpacityMultiplier;
            context.strokeStyle = 'rgb(2, 6, 23)';
            context.lineWidth = TRAIL_STROKE_WIDTH_PX * 2.25 * trailWidthMultiplier;
            drawSmoothedTrailPath(trailPoints);

            context.globalAlpha = 0.62 * trailFreshness * trailOpacityMultiplier;
            context.strokeStyle = 'rgb(2, 6, 23)';
            context.lineWidth = TRAIL_STROKE_WIDTH_PX * trailWidthMultiplier;
            drawSmoothedTrailPath(trailPoints);

            context.restore();
            root.dataset.trailPoints = String(trailPoints.length);
        };

        const render = () => {
            if (enabled) {
                const now = performance.now();
                const isTextInput = root.dataset.textInput === 'true';

                if (
                    visible
                    && !isIdle
                    && !isTextInput
                    && lastPointerMoveAt > 0
                    && now - lastPointerMoveAt >= IDLE_DELAY_MS
                ) {
                    setIdle(true, now);
                }

                context.clearRect(0, 0, canvasWidth, canvasHeight);
                drawIdleRipples(now);
                drawTrail(now);

                if (visible) {
                    positionHead(now);
                }
            }

            animationFrame = window.requestAnimationFrame(render);
        };

        root.dataset.idle = 'false';
        syncViewport();
        syncEnabled();

        window.addEventListener('pointermove', handlePointerMove, { passive: true });
        document.documentElement.addEventListener('pointerleave', handlePointerLeave, { passive: true });
        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('resize', syncViewport, { passive: true });
        pointerFineQuery.addEventListener('change', syncEnabled);
        reducedMotionQuery.addEventListener('change', syncEnabled);
        animationFrame = window.requestAnimationFrame(render);

        return () => {
            window.cancelAnimationFrame(animationFrame);
            window.removeEventListener('pointermove', handlePointerMove);
            document.documentElement.removeEventListener('pointerleave', handlePointerLeave);
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('resize', syncViewport);
            pointerFineQuery.removeEventListener('change', syncEnabled);
            reducedMotionQuery.removeEventListener('change', syncEnabled);
            setCursorClass(false);
        };
    }, []);

    return (
        <div
            ref={rootRef}
            className={styles.fireflyCursor}
            data-enabled="false"
            data-idle="false"
            data-interactive="false"
            data-text-input="false"
            data-trail-points="0"
            aria-hidden="true"
        >
            <canvas ref={canvasRef} className={styles.trailLayer} />
            <span ref={haloRef} className={styles.halo} />
            <span ref={dotRef} className={styles.dot} />
        </div>
    );
}
