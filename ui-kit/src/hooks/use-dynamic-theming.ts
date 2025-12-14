import { useState, useEffect } from 'react';

interface ThemeConfig {
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
    // Check for system preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
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