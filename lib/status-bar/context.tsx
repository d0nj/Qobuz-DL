'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { JobQueue } from './queue';
import { initialStatusBar, StatusBarProps } from './types';
import { setActiveQueue } from './jobs';

type StatusBarContextValue = {
    statusBar: StatusBarProps;
    setStatusBar: React.Dispatch<React.SetStateAction<StatusBarProps>>;
    queue: JobQueue;
};

const StatusBarContext = createContext<StatusBarContextValue | undefined>(undefined);

export const StatusBarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [statusBar, setStatusBar] = useState<StatusBarProps>(initialStatusBar);
    const [queue] = useState(() => new JobQueue());

    useEffect(() => {
        setActiveQueue(queue);

        // Clear the bar once everything has drained.
        const unsubscribe = queue.subscribe((snapshot) => {
            if (snapshot.size > 0) return;
            setStatusBar((prev) =>
                prev.processing ? { ...prev, open: false, title: '', description: '', progress: 0, processing: false } : prev
            );
        });

        return () => {
            unsubscribe();
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
