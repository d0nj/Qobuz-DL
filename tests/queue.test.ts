import { describe, expect, it, vi } from 'vitest';
import { JobQueue, runSerialized } from '@/lib/status-bar/queue';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => {
    let resolve!: () => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

describe('JobQueue ordering', () => {
    it('runs a job immediately when idle', async () => {
        const queue = new JobQueue();
        const ran = vi.fn();
        queue.enqueue(async () => ran());
        await settle();
        expect(ran).toHaveBeenCalledTimes(1);
    });

    it('runs jobs strictly one at a time', async () => {
        const queue = new JobQueue();
        const events: string[] = [];
        const first = deferred();
        const second = deferred();

        queue.enqueue(async () => {
            events.push('a:start');
            await first.promise;
            events.push('a:end');
        });
        queue.enqueue(async () => {
            events.push('b:start');
            await second.promise;
            events.push('b:end');
        });

        await settle();
        expect(events).toEqual(['a:start']);

        first.resolve();
        await settle();
        expect(events).toEqual(['a:start', 'a:end', 'b:start']);

        second.resolve();
        await settle();
        expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
    });

    it('drains several queued jobs in FIFO order', async () => {
        const queue = new JobQueue();
        const order: number[] = [];
        for (let i = 0; i < 5; i++) queue.enqueue(async () => order.push(i));
        await settle();
        for (let i = 0; i < 10; i++) await settle();
        expect(order).toEqual([0, 1, 2, 3, 4]);
    });

    it('keeps a throwing job from wedging the queue', async () => {
        const queue = new JobQueue();
        const ran = vi.fn();
        queue.enqueue(async () => {
            throw new Error('boom');
        });
        queue.enqueue(async () => ran());
        for (let i = 0; i < 5; i++) await settle();
        expect(ran).toHaveBeenCalledTimes(1);
    });

    it('keeps a rejecting job from producing an unhandled rejection', async () => {
        const queue = new JobQueue();
        queue.enqueue(() => Promise.reject(new Error('boom')));
        for (let i = 0; i < 5; i++) await settle();
        expect(queue.size).toBe(0);
    });

    it('runs every job exactly once across many enqueues', async () => {
        const queue = new JobQueue();
        const counts = new Map<number, number>();
        for (let i = 0; i < 100; i++) {
            queue.enqueue(async () => counts.set(i, (counts.get(i) ?? 0) + 1));
        }
        for (let i = 0; i < 250; i++) await settle();
        expect(counts.size).toBe(100);
        expect([...counts.values()].every((n) => n === 1)).toBe(true);
    });

    it('handles a job enqueued from inside a running job', async () => {
        const queue = new JobQueue();
        const order: string[] = [];
        const gate = deferred();
        queue.enqueue(async () => {
            order.push('outer');
            queue.enqueue(async () => order.push('inner'));
            await gate.promise;
        });
        await settle();
        gate.resolve();
        for (let i = 0; i < 5; i++) await settle();
        expect(order).toEqual(['outer', 'inner']);
    });
});

describe('JobQueue removal', () => {
    it('removes a waiting job so it never runs', async () => {
        const queue = new JobQueue();
        const ran = vi.fn();
        const gate = deferred();
        const victim = queue.enqueue(() => gate.promise);
        queue.enqueue(async () => ran());

        expect(queue.remove(victim.UUID)).toBe(false);
        for (let i = 0; i < 5; i++) await settle();
        expect(ran).not.toHaveBeenCalled();
    });

    it('removes a queued job and reports success', async () => {
        const queue = new JobQueue();
        const gate = deferred();
        queue.enqueue(() => gate.promise);
        const victim = queue.enqueue(async () => {});
        expect(queue.remove(victim.UUID)).toBe(true);
        expect(victim.UUID).not.toBe(undefined);
    });

    it('is safe to remove twice', () => {
        const queue = new JobQueue();
        const gate = deferred();
        queue.enqueue(() => gate.promise);
        const job = queue.enqueue(async () => {});
        expect(queue.remove(job.UUID)).toBe(true);
        expect(queue.remove(job.UUID)).toBe(false);
    });

    it('is safe to remove an unknown id', () => {
        const queue = new JobQueue();
        expect(queue.remove('nope')).toBe(false);
    });

    it('clears all waiting jobs', async () => {
        const queue = new JobQueue();
        const gate = deferred();
        queue.enqueue(() => gate.promise);
        for (let i = 0; i < 5; i++) queue.enqueue(async () => {});
        queue.clear();
        expect(queue.size).toBe(1);
    });
});

describe('JobQueue state', () => {
    it('is per-instance, so a second queue starts empty', () => {
        const a = new JobQueue();
        const b = new JobQueue();
        a.enqueue(async () => {});
        expect(a.size).toBeGreaterThan(0);
        expect(b.size).toBe(0);
    });

    it('reports running and pending separately', async () => {
        const queue = new JobQueue();
        const gate = deferred();
        const first = queue.enqueue(() => gate.promise);
        queue.enqueue(async () => {});
        await settle();

        expect(queue.snapshot().running).toBe(first.UUID);
        expect(queue.snapshot().pending).toHaveLength(1);
        gate.resolve();
    });

    it('notifies subscribers on change and stops after unsubscribe', async () => {
        const queue = new JobQueue();
        const listener = vi.fn();
        const unsubscribe = queue.subscribe(listener);
        queue.enqueue(async () => {});
        await settle();
        expect(listener).toHaveBeenCalled();

        const callsBefore = listener.mock.calls.length;
        unsubscribe();
        queue.enqueue(async () => {});
        await settle();
        expect(listener.mock.calls.length).toBe(callsBefore);
    });

    it('reports empty when nothing is queued', () => {
        const queue = new JobQueue();
        expect(queue.size).toBe(0);
        expect(queue.isRunning).toBe(false);
        expect(queue.snapshot()).toEqual({ running: null, pending: [], size: 0 });
    });
});

describe('runSerialized', () => {
    it('runs tasks one at a time in order', async () => {
        const order: number[] = [];
        await runSerialized([
            async () => {
                await settle();
                order.push(1);
            },
            async () => {
                await settle();
                order.push(2);
            }
        ]);
        expect(order).toEqual([1, 2]);
    });

    it('resolves for an empty list', async () => {
        await expect(runSerialized([])).resolves.toBeUndefined();
    });
});
