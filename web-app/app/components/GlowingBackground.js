'use client';
import { useEffect, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

export default function GlowingBackground() {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    // Using useSpring for smooth trailing effect behind the raw mouse position
    const springX = useSpring(0, { stiffness: 50, damping: 20 });
    const springY = useSpring(0, { stiffness: 50, damping: 20 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
            springX.set(e.clientX);
            springY.set(e.clientY);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [springX, springY]);

    return (
        <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
            {/* Primary soft orange/white glow that follows exactly on the cursor */}
            <motion.div
                className="absolute rounded-full opacity-30"
                style={{
                    x: springX,
                    y: springY,
                    width: '600px',
                    height: '600px',
                    marginLeft: '-300px',
                    marginTop: '-300px',
                    background: 'radial-gradient(circle, rgba(255,87,34,0.15) 0%, rgba(255,255,255,0.05) 30%, transparent 70%)',
                    filter: 'blur(40px)',
                }}
            />

            {/* Secondary wider ambient glow with more trailing */}
            <motion.div
                className="absolute rounded-full opacity-20"
                animate={{
                    x: mousePosition.x,
                    y: mousePosition.y,
                }}
                transition={{ type: 'tween', ease: 'easeOut', duration: 1.5 }}
                style={{
                    width: '1000px',
                    height: '1000px',
                    marginLeft: '-500px',
                    marginTop: '-500px',
                    background: 'radial-gradient(circle, rgba(15,23,42,0.1) 0%, rgba(15,23,42,0) 60%)',
                    filter: 'blur(80px)',
                }}
            />
        </div>
    );
}
