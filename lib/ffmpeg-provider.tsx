'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { createFFmpeg, FFmpegType } from './ffmpeg-functions';

/**
 * `createFFmpeg` returns null when the CDN script did not load. The type says
 * so: a non-null type here would push the failure onto every consumer as a
 * runtime crash.
 */
const FFmpegContext = createContext<
    | {
          ffmpegState: FFmpegType | null;
          setFFmpeg: React.Dispatch<React.SetStateAction<FFmpegType | null>>;
      }
    | undefined
>(undefined);

export const FFmpegProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [ffmpegState, setFFmpeg] = useState<FFmpegType | null>(() =>
        typeof window !== 'undefined' ? createFFmpeg() : null
    );

    return <FFmpegContext.Provider value={{ ffmpegState, setFFmpeg }}>{children}</FFmpegContext.Provider>;
};

export const useFFmpeg = () => {
    const context = useContext(FFmpegContext);

    if (!context) {
        throw new Error('useFFmpeg must be used within a FFmpegProvider');
    }

    return context;
};
