'use client';

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { useDynamicTheming, type ThemeConfig } from '../../hooks/use-dynamic-theming';

interface DynamicThemeContextType {
  theme: ThemeConfig;
  isDark: boolean;
  updateTheme: (theme: Partial<ThemeConfig>) => void;
  toggleDark: () => void;
}

const DynamicThemeContext = createContext<DynamicThemeContextType | null>(null);

export function DynamicThemeProvider({ children }: { children: ReactNode }) {
  const themeState = useDynamicTheming();

  return <DynamicThemeContext.Provider value={themeState}>{children}</DynamicThemeContext.Provider>;
}

export function useDynamicTheme() {
  const context = useContext(DynamicThemeContext);
  if (!context) {
    throw new Error('useDynamicTheme must be used within a DynamicThemeProvider');
  }
  return context;
}
