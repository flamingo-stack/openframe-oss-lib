"use client";

import * as React from "react"
import { createContext, useContext } from 'react';
import { useDynamicTheming } from '../../hooks/use-dynamic-theming';

interface DynamicThemeContextType {
  theme: any;
  isDark: boolean;
  updateTheme: (theme: any) => void;
  toggleDark: () => void;
}

const DynamicThemeContext = createContext<DynamicThemeContextType | null>(null);

export function DynamicThemeProvider({ children }: { children: React.ReactNode }) {
  const themeState = useDynamicTheming();

  return (
    <DynamicThemeContext.Provider value={themeState}>
      {children}
    </DynamicThemeContext.Provider>
  );
}

export function useDynamicTheme() {
  const context = useContext(DynamicThemeContext);
  if (!context) {
    throw new Error('useDynamicTheme must be used within a DynamicThemeProvider');
  }
  return context;
}