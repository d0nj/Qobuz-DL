import { LucideIcon } from 'lucide-react';

/**
 * Queue and status-bar types.
 *
 * These live in `lib/` rather than in the component that renders them. When
 * they were declared in `components/status-bar/status-bar.tsx`, four files
 * under `lib/` imported from `components/`, which meant importing queue logic
 * dragged in Radix, motion/react and next/image.
 */
export type QueueProps = {
    title: string;
    icon?: LucideIcon | null;
    UUID: string;
    remove?: () => void;
};

export type StatusBarProps = {
    open: boolean;
    openPreference: boolean;
    title: string;
    description: string;
    progress: number;
    processing: boolean;
    queue?: QueueProps[];
    onCancel?: () => void;
};

export const initialStatusBar: StatusBarProps = {
    title: '',
    open: false,
    openPreference: true,
    progress: 0,
    description: '',
    processing: false,
    onCancel: () => {}
};
