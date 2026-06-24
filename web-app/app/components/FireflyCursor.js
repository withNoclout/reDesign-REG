'use client';

import { useEffect, useRef } from 'react';

import styles from './FireflyCursor.module.css';

const TRAIL_TTL_MS = 700;
const TRAIL_MIN_DISTANCE_PX = 2.2;
const TRAIL_MAX_POINTS = 140;
const TRAIL_STROKE_WIDTH_PX = 1.65;
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

        let enabled = false;
        let visible = false;
        let headX = -120;
        let headY = -120;
        let canvasWidth = 0;
        let canvasHeight = 0;
        let animationFrame = 0;

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

        const clearTrail = () => {
            trailPoints.length = 0;
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
            clearTrail();
        };

        const syncEnabled = () => {
            enabled = pointerFineQuery.matches && !reducedMotionQuery.matches;
            root.dataset.enabled = enabled ? 'true' : 'false';
            setCursorClass(enabled);

            if (!enabled) {
                setVisible(false);
                clearTrail();
            }
        };

        const updateInteractiveState = (event) => {
            const target = event.target;
            const isTextInput = target instanceof Element && Boolean(target.closest(TEXT_INPUT_SELECTOR));
            const isInteractive = target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));

            root.dataset.textInput = isTextInput ? 'true' : 'false';
            root.dataset.interactive = isInteractive && !isTextInput ? 'true' : 'false';
        };

        const positionHead = () => {
            const isTextInput = root.dataset.textInput === 'true';
            const isInteractive = root.dataset.interactive === 'true';
            const dotScale = isTextInput ? 1 : (isInteractive ? 1.18 : 1);
            const haloScale = isTextInput ? 0.56 : (isInteractive ? 1.28 : 1);
            const baseTransform = `translate3d(${headX}px, ${headY}px, 0) translate(-50%, -50%)`;

            dot.style.transform = `${baseTransform} scale(${dotScale})`;
            halo.style.transform = `${baseTransform} scale(${haloScale})`;
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

            headX = event.clientX;
            headY = event.clientY;
            setVisible(true);
            updateInteractiveState(event);
            pushTrailPoint(headX, headY, performance.now());
            positionHead();
        };

        const handlePointerLeave = () => {
            setVisible(false);
            clearTrail();
        };
        const handleWindowBlur = () => {
            setVisible(false);
            clearTrail();
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

        const drawTrail = (now) => {
            while (trailPoints.length > 0 && now - trailPoints[0].time > TRAIL_TTL_MS) {
                trailPoints.shift();
            }

            context.clearRect(0, 0, canvasWidth, canvasHeight);

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
                drawTrail(performance.now());

                if (visible) {
                    positionHead();
                }
            }

            animationFrame = window.requestAnimationFrame(render);
        };

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
            data-interactive="false"
            data-text-input="false"
            data-trail-points="0"
            data-visible="false"
            aria-hidden="true"
        >
            <canvas ref={canvasRef} className={styles.trailLayer} />
            <span ref={haloRef} className={styles.halo} />
            <span ref={dotRef} className={styles.dot} />
        </div>
    );
}
