'use client';

import { useEffect, useState } from 'react';
import { useSettings } from '@/lib/settings-provider';

/**
 * The film-grain layer, gated on the background setting.
 *
 * `settings.particles` was written by the settings form and read by nothing, so
 * choosing "Solid Color" had no effect. The name survives from the particle
 * background this replaced; the field it now controls is grain.
 *
 * Settings arrive from localStorage, which the server cannot see. Rendering
 * during SSR and removing on hydration would flash the grain at users who chose
 * Solid Color, so the layer waits for mount and the (invisible) difference is
 * absorbed by the entrance animation rather than shown as a pop.
 */
const GrainField = () => {
    const { settings } = useSettings();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted || !settings.particles) return null;

    return <div className='grain-field' aria-hidden='true' />;
};

export default GrainField;
