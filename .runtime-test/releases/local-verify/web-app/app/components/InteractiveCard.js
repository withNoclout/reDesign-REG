'use client';
import { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';

export default function InteractiveCard({ children, className = '', containerStyle = {} }) {
    const cardRef = useRef(null);

    // Glow position variables
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Build the dynamic glare masking radial gradient
    const background = useMotionTemplate`radial-gradient(
        800px circle at ${mouseX}px ${mouseY}px,
        rgba(255,255,255,0.06),
        transparent 40%
    )`;

    const handleMouseMove = (e) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();

        const mouseXLocal = e.clientX - rect.left;
        const mouseYLocal = e.clientY - rect.top;

        // Set absolute pixel positions for the radial glare layer
        mouseX.set(mouseXLocal);
        mouseY.set(mouseYLocal);
    };

    return (
        <motion.div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            style={{
                ...containerStyle
            }}
            className={`relative group ${className}`}
        >
            {/* The main content */}
            <div className="w-full h-full relative z-10">
                {children}
            </div>

            {/* The interactive glare layer that follows the mouse inside the card */}
            <motion.div
                className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                    background
                }}
            />
        </motion.div>
    );
}
