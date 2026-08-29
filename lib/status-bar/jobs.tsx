import { QueueProps, StatusBarProps } from './types';
import { LucideIcon } from 'lucide-react';
import { JobQueue } from './queue';

/**
 * The active queue, registered by StatusBarProvider.
 *
 * `download` is called from several places that receive the status-bar
 * setter as a prop, not the queue. Threading the queue through all of them
 * would widen an interface this work is meant to narrow, so the provider
 * registers the instance here instead. The fallback keeps the module usable
 * before the provider mounts and in tests that never mount React.
 */
let activeQueue: JobQueue | null = null;

export function setActiveQueue(queue: JobQueue | null): void {
    activeQueue = queue;
}

export function getActiveQueue(): JobQueue {
    activeQueue ??= new JobQueue();
    return activeQueue;
}

export type CreateJobArgs = {
    queue: JobQueue;
    setStatusBar: React.Dispatch<React.SetStateAction<StatusBarProps>>;
    title: string;
    icon: LucideIcon;
    run: () => Promise<void>;
};

/**
 * Queues one job and mirrors its lifecycle into the status bar.
 *
 * Ordering and concurrency belong to the queue; this only translates queue
 * state into what the UI reads.
 */
export function createJob({ queue, setStatusBar, title, icon, run }: CreateJobArgs): void {
    const isQueued = queue.isRunning;

    const job = queue.enqueue(async () => {
        setStatusBar((prev) => ({ ...prev, processing: true, open: prev.openPreference, progress: 0, complete: false }));
        try {
            await run();
        } finally {
            setStatusBar((prev) => ({
                ...prev,
                processing: false,
                progress: 0,
                onCancel: () => {},
                queue: prev.queue?.filter((item) => item.UUID !== job.UUID)
            }));
        }
    });

    if (isQueued) {
        const entry: QueueProps = {
            title,
            UUID: job.UUID,
            icon,
            remove: () => {
                if (queue.remove(job.UUID)) {
                    setStatusBar((prev) => ({ ...prev, queue: prev.queue?.filter((item) => item.UUID !== job.UUID) }));
                }
            }
        };
        setStatusBar((prev) => ({ ...prev, queue: [...(prev.queue ?? []), entry] }));
    }
}
