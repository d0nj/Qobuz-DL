'use client';
import React, { useEffect, useState } from 'react';
import StatusBar from './status-bar';
import { cn } from '@/lib/utils';

const StatusBarContainer = () => {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return null;
    return (
        <div
            className={cn(
                'px-4 pb-4 pt-6 overflow-hidden mx-auto w-full flex min-h-[156px] justify-center border-t border-border bg-background pointer-events-none'
            )}
        >
            <div className='container relative flex'>
                <StatusBar />
            </div>
        </div>
    );
};

export default StatusBarContainer;
