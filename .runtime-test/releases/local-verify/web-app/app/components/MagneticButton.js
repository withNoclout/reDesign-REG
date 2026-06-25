'use client';
import { useRef, useState } from 'react';
import { motion, useSpring, useTransform, useMotionValue } from 'framer-motion';

export default function MagneticButton({ children, onClick, className = '', disabled = false, style = {}, type = "button" }) {
    const ref = useRef(null);
    const [isHovered, setIsHovered] = useState(false);

    // Magnetic pull variables
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // Spring physics for natural elastic snap
    const springX = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
    const springY = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

    const handleMouseMove = (e) => {
        if (disabled || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();

        // Calculate distance from center of the button
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const distanceX = e.clientX - centerX;
        const distanceY = e.clientY - centerY;

        // Apply magnetic pull (capped at 20px)
        x.set(distanceX * 0.3);
        y.set(distanceY * 0.3);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        x.set(0);
        y.set(0);
    };

    return (
        <motion.button
            ref={ref}
            type={type}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
            disabled={disabled}
            style={{
                x: springX,
                y: springY,
                ...style
            }}
            className={`relative overflow-hidden ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
            whileTap={!disabled ? { scale: 0.95 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
            {/* The Text Content - moves slightly more than the button for parallax */}
            <motion.div
                style={{
                    x: useTransform(springX, v => v * 0.5),
                    y: useTransform(springY, v => v * 0.5),
                }}
                className="relative z-10 w-full h-full flex items-center justify-center gap-2"
            >
                {children}
            </motion.div>
        </motion.button>
    );
}
