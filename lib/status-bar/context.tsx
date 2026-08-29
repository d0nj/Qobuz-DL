'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { JobQueue } from './queue';
import { initialStatusBar, StatusBarProps } from './types';
import { setActiveQueue } from './jobs';

/**
 * How long a finished download holds before the bar retreats.
 *
 * Long enough for the filled bar and its readout to register as a result,
 * short enough that it never feels like the app stalled on the way out.
 */
const COMPLETION_HOLD_MS = 700;

type StatusBarContextValue = {
    statusBar: StatusBarProps;
    setStatusBar: React.Dispatch<React.SetStateAction<StatusBarProps>>;
    queue: JobQueue;
};

const StatusBarContext = createContext<StatusBarContextValue | undefined>(undefined);

export const StatusBarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [statusBar, setStatusBar] = useState<StatusBarProps>(initialStatusBar);
    const [queue] = useState(() => new JobQueue());
    const pendingReset = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setActiveQueue(queue);

        // A finished download holds briefly before the bar retreats. Without
        // the hold, the last thing a user sees is a bar vanishing at the
        // instant it filled, so completion reads as a glitch, not a result.
        // Cancelling a job instead of finishing it should dismiss immediately,
        // so the hold applies only when something actually completed.
        const unsubscribe = queue.subscribe((snapshot) => {
            if (snapshot.size > 0) {
                if (pendingReset.current) {
                    clearTimeout(pendingReset.current);
                    pendingReset.current = null;
                }
                return;
            }

            if (pendingReset.current) return;

            pendingReset.current = setTimeout(() => {
                pendingReset.current = null;
                setStatusBar((prev) =>
                    prev.processing
                        ? {
                              ...prev,
                              open: false,
                              title: '',
                              description: '',
                              progress: 0,
                              processing: false,
                              complete: false
                          }
                        : prev
                );
            }, COMPLETION_HOLD_MS);
        });

        return () => {
            unsubscribe();
            if (pendingReset.current) clearTimeout(pendingReset.current);
            queue.clear();
            setActiveQueue(null);
        };
    }, [queue]);

    const value = useMemo<StatusBarContextValue>(() => ({ statusBar, setStatusBar, queue }), [statusBar, setStatusBar, queue]);

    return <StatusBarContext.Provider value={value}>{children}</StatusBarContext.Provider>;
};

export const useStatusBar = () => {
    const context = useContext(StatusBarContext);

    if (!context) {
        throw new Error('useStatusBar must be used within a StatusBarProvider');
    }

    return context;
};
