'use client';

import { useEffect, useState } from 'react';
import { useSettings } from '@/lib/settings-provider';

/**
 * `settings.particles` was written by the settings form and read by nothing, so
 * "Solid Color" had no effect. The name survives from the particle background
 * this replaced.
 *
 * Settings come from localStorage, which the server cannot see, so rendering
 * during SSR and removing on hydration would flash grain at users who chose
 * Solid Color. Hence the mount gate.
 */
const GrainField = () => {
    const { settings } = useSettings();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted || !settings.particles) return null;

    return <div className='grain-field' aria-hidden='true' />;
};

export default GrainField;
