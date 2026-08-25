// Stub implementation for useDynamicThemeContext

export interface DynamicThemeContext {
  theme: string;
  setTheme: (theme: string) => void;
  isDark: boolean;
  /** Opaque host-supplied theme state — the stub returns an empty object and
   *  nothing in this lib reads inside it. */
  themeState: Record<string, unknown>;
  applyContextualColor: (color: string) => string;
  animateAccentColor: (color: string) => void;
  generateThemeGradient: (baseColor: string) => string;
  getOptimalTextColor: (backgroundColor: string) => string;
  transitionToPlatform: (platform: string) => void;
}

export function useDynamicThemeContext(): DynamicThemeContext {
  return {
    theme: 'light',
    setTheme: () => {},
    isDark: false,
    themeState: {},
    applyContextualColor: (color: string) => color,
    animateAccentColor: () => {},
    generateThemeGradient: (baseColor: string) => baseColor,
    getOptimalTextColor: () => '#000000',
    transitionToPlatform: () => {},
  };
}
