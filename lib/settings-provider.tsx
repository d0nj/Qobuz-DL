'use client';

import React, { createContext, useMemo } from 'react';
import { usePersistedConfig, type PersistedConfigModule } from './persisted-config';
import { defaultSettings, parseSettings, type SettingsProps } from './settings-schema';

/**
 * Thin instantiation of the persisted-config module.
 *
 * Everything non-obvious — validation, the localStorage rhythm, the
 * hydration race, cross-tab sync — lives in `persisted-config` and
 * `settings-schema`. This file is only the wiring: a key, a default, and a
 * validator.
 */
export type { SettingsProps };
export { defaultSettings, nameVariables } from './settings-schema';

const SETTINGS_KEY = 'settings';

const settingsModule: PersistedConfigModule<SettingsProps> = {
    storageKey: SETTINGS_KEY,
    defaultValue: defaultSettings,
    parse: parseSettings,
    serialize: (value) => JSON.stringify(value)
};

type SettingsContextValue = {
    settings: SettingsProps;
    setSettings: React.Dispatch<React.SetStateAction<SettingsProps>>;
    resetSettings: () => void;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { value, setValue, reset } = usePersistedConfig(settingsModule);

    const contextValue = useMemo<SettingsContextValue>(
        () => ({ settings: value, setSettings: setValue, resetSettings: reset }),
        [value, setValue, reset]
    );

    return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
    const context = React.useContext(SettingsContext);

    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }

    return context;
};
