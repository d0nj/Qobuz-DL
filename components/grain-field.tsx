'use client';

import { useEffect, useState } from 'react';
import { useSettings } from '@/lib/settings-provider';

/**
 * Mount-gated because settings live in localStorage: the server cannot see
 * them, so rendering during SSR and removing on hydration would flash grain at
 * users who chose Solid Color.
 */
const GrainField = () => {
    const { settings } = useSettings();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted || !settings.particles) return null;

    return <div className='grain-field' aria-hidden='true' />;
};

export default GrainField;
