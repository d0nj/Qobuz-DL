'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn } from '@/lib/utils';

/**
 * The one element whose whole job is continuity: it reports bytes arriving over
 * minutes, so it needs a real transition with a duration.
 *
 * Two directions, two durations. Filling is a measurement settling, so it eases
 * slowly; a jump backwards is the next job starting, not progress reversing, so
 * it snaps. Duration is a custom property so `prefers-reduced-motion` can zero
 * it without a JS media query.
 */
const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>>(
    ({ className, value, ...props }, ref) => {
        const current = value || 0;
        const previous = React.useRef(current);
        const resetting = current < previous.current;

        React.useEffect(() => {
            previous.current = current;
        }, [current]);

        return (
            <ProgressPrimitive.Root ref={ref} className={cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/20', className)} {...props}>
                <ProgressPrimitive.Indicator
                    className='h-full w-full flex-1 bg-primary'
                    data-resetting={resetting ? '' : undefined}
                    style={{
                        transform: `translateX(-${100 - current}%)`,
                        transition: `transform var(--progress-fill-duration, 420ms) cubic-bezier(0.16, 1, 0.3, 1)`
                    }}
                />
            </ProgressPrimitive.Root>
        );
    }
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
