import { LucideIcon } from 'lucide-react';

/**
 * Lives in `lib/` so importing queue logic does not transitively pull in the
 * renderer's dependencies — Radix, motion/react and next/image.
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
    /**
     * Set once a job finishes, before the queue drains and the bar retreats.
     * Without it the last frame a user sees is a bar vanishing mid-fill.
     */
    complete?: boolean;
};

export const initialStatusBar: StatusBarProps = {
    title: '',
    open: false,
    openPreference: true,
    progress: 0,
    description: '',
    processing: false,
    onCancel: () => {},
    complete: false
};
