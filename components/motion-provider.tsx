'use client';

import React from 'react';
import { MotionConfig } from 'motion/react';

/**
 * Motion defaults for the whole tree.
 *
 * `reducedMotion="user"` makes every `motion` node honour the OS setting,
 * which individually-authored animations here did not. It disables transforms
 * and layout animation but keeps opacity, so state changes stay legible for
 * users who ask for less movement.
 *
 * The transition is the shared cadence: arrivals decelerate rather than
 * bounce. Individual components override it where the moment calls for it.
 */
export const MotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <MotionConfig
            reducedMotion='user'
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
            {children}
        </MotionConfig>
    );
};

export default MotionProvider;
