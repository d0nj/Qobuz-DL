import { v4 as uuidv4 } from 'uuid';

export type Job = {
    readonly UUID: string;
    run: () => Promise<void>;
};

export type QueueListener = (snapshot: QueueSnapshot) => void;

export type QueueSnapshot = {
    running: string | null;
    pending: string[];
    size: number;
};

/**
 * Serial job queue. Progression is driven by promise completion, so there is no
 * interval to drift and no tick to miss.
 *
 * State is owned here, not in React: reading React state back out through
 * `setStatusBar(prev => (resolve(prev), prev))` is a side effect
 * inside a reducer that broke under StrictMode double-invocation.
 *
 * The queue is an instance, not a module global, so a second mount starts
 * empty instead of inheriting another tree's jobs.
 */
export class JobQueue {
    private pending: Job[] = [];
    private running: Job | null = null;
    private listeners = new Set<QueueListener>();

    /** Jobs currently queued, running job excluded. */
    get size(): number {
        return this.pending.length + (this.running ? 1 : 0);
    }

    get isRunning(): boolean {
        return this.running !== null;
    }

    subscribe(listener: QueueListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    snapshot(): QueueSnapshot {
        return {
            running: this.running?.UUID ?? null,
            pending: this.pending.map((job) => job.UUID),
            size: this.size
        };
    }

        /** Runs immediately when idle, otherwise once the current job settles. */
    enqueue(run: () => Promise<void>): Job {
        const job: Job = { UUID: uuidv4(), run };
        this.pending.push(job);
        this.emit();
        void this.drain();
        return job;
    }

    /** Remove a waiting job. Returns false if it already ran or was removed. */
    remove(UUID: string): boolean {
        const index = this.pending.findIndex((job) => job.UUID === UUID);
        if (index === -1) return false;
        this.pending.splice(index, 1);
        this.emit();
        return true;
    }

    clear(): void {
        this.pending = [];
        this.emit();
    }

    private async drain(): Promise<void> {
        if (this.running) return;
        const next = this.pending.shift();
        if (!next) {
            this.emit();
            return;
        }

        this.running = next;
        this.emit();

        try {
            await next.run();
        } catch {
            // A failed job must not wedge the queue; the next one still runs.
        } finally {
            this.running = null;
            this.emit();
            void this.drain();
        }
    }

    private emit(): void {
        const snapshot = this.snapshot();
        for (const listener of this.listeners) listener(snapshot);
    }
}

/** Runs `jobs` strictly one at a time and resolves when all have settled. */
export async function runSerialized(jobs: Array<() => Promise<void>>): Promise<void> {
    for (const job of jobs) await job();
}
