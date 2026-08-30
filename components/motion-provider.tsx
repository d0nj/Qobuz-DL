'use client';

import React from 'react';
import { MotionConfig } from 'motion/react';

/**
 * `reducedMotion="user"` makes every motion node honour the OS setting, which
 * individually-authored animations here did not. It disables transforms while
 * keeping opacity, so state changes stay legible.
 */
export const MotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <MotionConfig reducedMotion='user' transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>{children}</MotionConfig>;
};

export default MotionProvider;
