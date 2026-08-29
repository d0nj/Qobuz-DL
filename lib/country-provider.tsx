'use client';

import React, { createContext, useMemo } from 'react';
import { usePersistedConfig, type PersistedConfigModule } from './persisted-config';

export type CountryContextValue = {
    country: string | undefined;
    setCountry: React.Dispatch<React.SetStateAction<string | undefined>>;
};

const COUNTRY_KEY = 'country';

const parseCountry = (raw: unknown): string | undefined | null => {
    if (raw === null || raw === undefined) return undefined;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const countryModule: PersistedConfigModule<string | undefined> = {
    storageKey: COUNTRY_KEY,
    defaultValue: undefined,
    parse: parseCountry,
    serialize: (value) => JSON.stringify(value ?? '')
};

const CountryContext = createContext<CountryContextValue | undefined>(undefined);

export const CountryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { value, setValue } = usePersistedConfig(countryModule);

    const contextValue = useMemo<CountryContextValue>(() => ({ country: value, setCountry: setValue }), [value, setValue]);

    return <CountryContext.Provider value={contextValue}>{children}</CountryContext.Provider>;
};

export const useCountry = () => {
    const context = React.useContext(CountryContext);

    if (!context) {
        throw new Error('useCountry must be used within a CountryProvider');
    }

    return context;
};
