import React, { createContext, useCallback, useContext, useState } from 'react';
import { getThemeMode, storeThemeMode } from '../lib/themeEngine';

interface Value { mode: 'light' | 'dark'; dark: boolean; toggle: () => void }
const Ctx = createContext<Value>({ mode: 'light', dark: false, toggle: () => {} });

/** Light or dark. Switching re-creates the whole screen tree (the key below) so every colour is worked out again in the new mode. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>(getThemeMode());
  const toggle = useCallback(() => {
    const next = mode === 'dark' ? 'light' : 'dark';
    storeThemeMode(next);
    setMode(next);
  }, [mode]);
  return (
    <Ctx.Provider value={{ mode, dark: mode === 'dark', toggle }}>
      <React.Fragment key={mode}>{children}</React.Fragment>
    </Ctx.Provider>
  );
}

export const useThemeMode = () => useContext(Ctx);
