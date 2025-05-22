import React from 'react';
import { motion } from 'framer-motion';

const PageTransition = ({ children, direction = 'right' }) => {
    // Các variant cho animation
    const variants = {
        initial: (direction) => {
            return {
                x: direction === 'right' ? '100%' : direction === 'left' ? '-100%' : 0,
                y: direction === 'up' ? '100%' : direction === 'down' ? '-100%' : 0,
                opacity: 0,
                scale: 0.95,
            };
        },
        animate: {
            x: 0,
            y: 0,
            opacity: 1,
            scale: 1,
            transition: {
                type: 'spring',
                stiffness: 100,
                damping: 20,
                duration: 0.5,
            },
        },
        exit: (direction) => {
            return {
                x: direction === 'right' ? '-100%' : direction === 'left' ? '100%' : 0,
                y: direction === 'up' ? '-100%' : direction === 'down' ? '100%' : 0,
                opacity: 0,
                scale: 0.95,
                transition: {
                    type: 'spring',
                    stiffness: 100,
                    damping: 20,
                    duration: 0.3,
                },
            };
        },
    };

    return (
        <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={variants}
            custom={direction}
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;