import { motion } from 'framer-motion';

/**
 * Animation Timing Constants
 * Centralized timing values for consistent animation speeds
 */
export const TIMING = {
    instant: 0,
    fast: 0.1,
    normal: 0.2,
    slow: 0.3,
    stagger: 0.05,
    staggerSlow: 0.1,
};

/**
 * Common Animation Variants
 * Reusable animation patterns for consistent UI animations
 */

/**
 * Fade In Animation
 * Use for elements appearing from opacity 0 to 1
 */
export const fadeIn = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3, ease: 'easeOut' },
};

/**
 * Fade In Up Animation
 * Use for elements appearing from bottom with fade
 */
export const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: 'easeOut' },
};

/**
 * Fade In Down Animation
 * Use for elements appearing from top with fade
 */
export const fadeInDown = {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: 'easeOut' },
};

/**
 * Slide In Left Animation
 * Use for elements sliding from left
 */
export const slideInLeft = {
    initial: { x: -20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 },
    transition: { duration: 0.3, ease: 'easeOut' },
};

/**
 * Slide In Right Animation
 * Use for elements sliding from right
 */
export const slideInRight = {
    initial: { x: 20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 20, opacity: 0 },
    transition: { duration: 0.3, ease: 'easeOut' },
};

/**
 * Scale In Animation
 * Use for elements appearing with scale
 */
export const scaleIn = {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
    transition: { duration: 0.3, ease: 'easeOut' },
};

/**
 * Stagger Children Animation
 * Use for lists/grid items appearing one by one
 */
export const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

export const staggerItem = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
};

/**
 * Hover Animations
 * Use for interactive elements
 */
export const hoverLift = {
    whileHover: {
        y: -4,
        transition: { duration: 0.2 }
    },
    whileTap: {
        y: -2,
        transition: { duration: 0.1 }
    },
};

export const hoverScale = {
    whileHover: {
        scale: 1.02,
        transition: { duration: 0.2 }
    },
    whileTap: {
        scale: 0.98,
        transition: { duration: 0.1 }
    },
};

export const hoverGlow = {
    whileHover: {
        boxShadow: '0 0 30px rgba(255, 87, 34, 0.4)',
        borderColor: 'rgba(255, 87, 34, 0.6)',
        transition: { duration: 0.3 },
    },
};

/**
 * Pulse Glow Animation
 * Continuous subtle glow effect
 */
export const pulseGlow = {
    whileHover: {
        textShadow: '0 0 20px rgba(255, 87, 34, 0.6)',
        transform: 'scale(1.02)',
        transition: { duration: 0.3 },
    },
    whileTap: {
        transform: 'scale(1)',
        transition: { duration: 0.1 },
    },
};

/**
 * Button Animations
 */
export const buttonPress = {
    whileHover: {
        scale: 1.05,
        y: -2,
        transition: { duration: 0.2 }
    },
    whileTap: {
        scale: 0.98,
        y: 0,
        transition: { duration: 0.1 }
    },
};

/**
 * Card Hover Animation
 */
export const cardHover = {
    whileHover: {
        y: -8,
        transition: { duration: 0.3 }
    },
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
};

/**
 * Navbar Animation
 * Use for sliding down from top
 */
export const navbarSlideDown = {
    initial: { y: -100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -100, opacity: 0 },
    transition: {
        duration: 0.5,
        type: 'spring',
        stiffness: 100
    },
};

/**
 * Menu Item Animation
 * Use for menu items appearing
 */
export const menuItemSlide = {
    initial: { x: -20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    transition: { duration: 0.2 },
};

/**
 * Logo Animation
 * Use for brand logo entrance
 */
export const logoAppear = {
    initial: { scale: 0, rotate: -180 },
    animate: { scale: 1, rotate: 0 },
    transition: {
        duration: 0.5,
        type: 'spring',
        stiffness: 200
    },
};

/**
 * Text Glow Animation
 * Continuous text glow effect
 */
export const textGlow = {
    animate: {
        textShadow: [
            '0 0 10px rgba(255, 87, 34, 0.3)',
            '0 0 20px rgba(255, 87, 34, 0.6)',
            '0 0 10px rgba(255, 87, 34, 0.3)',
        ],
    },
    transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
    },
};

/**
 * Shake Animation
 * Use for error states
 */
export const shake = {
    animate: {
        x: [0, -5, 5, -5, 5, 0],
    },
    transition: {
        duration: 0.5,
        ease: 'easeInOut',
    },
};

/**
 * Loading Spinner Animation
 */
export const spinner = {
    animate: {
        rotate: 360,
    },
    transition: {
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
    },
};

/**
 * Page Transition
 * Use for smooth page transitions
 */
export const pageTransition = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.3 },
};

/**
 * Modal Animation
 * Use for modal dialogs
 */
export const modalOverlay = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 },
};

export const modalContent = {
    initial: { scale: 0.95, opacity: 0, y: 20 },
    animate: { scale: 1, opacity: 1, y: 0 },
    exit: { scale: 0.95, opacity: 0, y: 20 },
    transition: { duration: 0.3 },
};

/**
 * Mobile Menu Animation
 * Use for mobile menu toggle
 */
export const mobileMenuSlide = {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: { duration: 0.3, ease: 'easeOut' },
};

/**
 * Export motion components for convenience
 */
export const MotionDiv = motion.div;
export const MotionButton = motion.button;
export const MotionSpan = motion.span;
export const MotionNav = motion.nav;
