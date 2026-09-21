import { useState, useEffect } from 'react';

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
}

const defaultTheme: ThemeConfig = {
  primaryColor: '#FFC008',
  secondaryColor: '#161616',
  accentColor: '#E5E5E5',
  backgroundColor: '#FAFAFA',
  textColor: '#161616',
};

export function useDynamicTheming() {
  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check for system preference. The initial read and the change listener are
    // the same operation against the same external source, so they share one
    // callback — `matchMedia` is not readable during SSR, which is why this
    // cannot be a lazy `useState` initialiser.
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncFromMediaQuery = () => setIsDark(mediaQuery.matches);
    syncFromMediaQuery();

    mediaQuery.addEventListener('change', syncFromMediaQuery);
    return () => mediaQuery.removeEventListener('change', syncFromMediaQuery);
  }, []);

  const updateTheme = (newTheme: Partial<ThemeConfig>) => {
    setTheme(prev => ({ ...prev, ...newTheme }));
  };

  const toggleDark = () => {
    setIsDark(prev => !prev);
  };

  return {
    theme,
    isDark,
    updateTheme,
    toggleDark,
  };
}
