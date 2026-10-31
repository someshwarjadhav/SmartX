import type * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_THEME, THEMES, applyTheme, getTheme, rgb, type ThemeDef, type ThemeId } from '../config/themes';

const KEY = 'smartx-theme';
const LIGHT_KEY = 'smartx-last-light';
const DARK_KEY = 'smartx-last-dark';

interface ThemeCtx {
  theme: ThemeDef;
  themes: ThemeDef[];
  setTheme: (id: ThemeId) => void;
  toggleMode: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function readSaved(): ThemeDef {
  try {
    return getTheme(localStorage.getItem(KEY) ?? DEFAULT_THEME);
  } catch {
    return getTheme(DEFAULT_THEME);
  }
}

export function bootTheme(): void {
  applyTheme(readSaved());
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeDef>(readSaved);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(KEY, theme.id);
    } catch {
    }
  }, [theme]);

  const setTheme = useCallback((id: ThemeId) => setThemeState(getTheme(id)), []);

  const toggleMode = useCallback(() => {
    setThemeState((cur) => {
      const wantDark = cur.mode === 'light';
      try {
        localStorage.setItem(cur.mode === 'dark' ? DARK_KEY : LIGHT_KEY, cur.id);
        const back = localStorage.getItem(wantDark ? DARK_KEY : LIGHT_KEY);
        const target = getTheme(back ?? (wantDark ? 'midnight' : 'ocean'));
        if (target.mode === (wantDark ? 'dark' : 'light')) return target;
      } catch {
      }
      return getTheme(wantDark ? 'midnight' : 'ocean');
    });
  }, []);

  const value = useMemo(() => ({ theme, themes: THEMES, setTheme, toggleMode }), [theme, setTheme, toggleMode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme must be used inside ThemeProvider');
  return c;
}

export function useChartColors() {
  const { theme } = useTheme();
  const v = theme.vars;
  return useMemo(
    () => ({
      grid: rgb(v.line ?? '0 0 0', 0.7),
      tick: rgb(v.mute ?? '0 0 0'),
      panel: rgb(v.panel ?? '255 255 255'),
      ink: rgb(v.ink ?? '0 0 0'),
      brand: rgb(v.brand ?? '0 0 0'),
      cow: rgb(v.cow ?? '0 0 0'),
      buffalo: rgb(v.buffalo ?? '0 0 0'),
      mix: rgb(v.mix ?? '0 0 0'),
      ok: rgb(v.ok ?? '0 0 0'),
      danger: rgb(v.danger ?? '0 0 0'),
      warn: rgb(v.warn ?? '0 0 0'),
    }),
    [v],
  );
}
