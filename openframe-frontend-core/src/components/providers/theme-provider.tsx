"use client";

import * as React from "react";
import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
} from "next-themes";
import type { ThemeProviderProps as NextThemesProviderProps } from "next-themes/dist/types";

/**
 * ODS theme system — thin wrapper over `next-themes`.
 *
 * We deliberately do NOT hand-roll a provider/no-flash script: `next-themes`
 * is already a dependency, is battle-tested in Next.js (App & Pages router),
 * injects its own pre-paint anti-flash script, handles SSR + localStorage +
 * cross-tab sync, and also works in plain React (Vite/Tauri).
 *
 * Product model (locked): a MANUAL light/dark switch, default DARK,
 * persisted to localStorage. No "system" mode (`enableSystem={false}`).
 *
 * Drives styling by setting `data-theme="light|dark"` on <html>;
 * `src/styles/ods-colors.css` swaps the `--ods-*` primitives accordingly.
 *
 * Public API exposed by this module:
 *   • `<ThemeProvider>` — preconfigured next-themes provider.
 *   • `useTheme()`      — raw next-themes hook (advanced cases).
 *   • `useThemeToggle()`— headless convenience hook for building toggle UI
 *                         in consumer apps (no styled component on purpose;
 *                         apps own their button visuals via the lib's
 *                         existing `<Button>`).
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "ods-theme";
export const THEME_ATTRIBUTE = "data-theme";
export const DEFAULT_THEME: Theme = "dark";

export type ThemeProviderProps = Partial<NextThemesProviderProps>;

/**
 * Pre-configured provider. Wrap the app once (Next.js: in the root layout;
 * apps must keep `suppressHydrationWarning` on <html> — already the case).
 * No `<ThemeScript>` needed — next-themes handles the no-flash script.
 *
 * All next-themes props are overridable, but the ODS defaults below encode
 * the product decision.
 */
export function ThemeProvider({ children, ...overrides }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute={THEME_ATTRIBUTE}
      defaultTheme={DEFAULT_THEME}
      enableSystem={false}
      themes={["light", "dark"]}
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange={false}
      {...overrides}
    >
      {children}
    </NextThemesProvider>
  );
}

/**
 * Re-export of next-themes' `useTheme` (no custom logic on top).
 * Returns `{ theme, setTheme, resolvedTheme, themes, ... }`.
 */
export const useTheme = useNextTheme;

/* ------------------------------------------------------------------ */
/* useThemeToggle — headless convenience for building toggle UIs      */
/* ------------------------------------------------------------------ */

export interface UseThemeToggleResult {
  /** Becomes `true` after the client has hydrated and resolved the stored
   *  preference. Until then, `theme`/`isDark`/`isLight` reflect the SSR
   *  default (`DEFAULT_THEME`) — handy for rendering a stable placeholder. */
  mounted: boolean;
  /** Resolved active theme (`"dark"` until mounted, then real value). */
  theme: Theme;
  isDark: boolean;
  isLight: boolean;
  /** Flip dark↔light and persist. */
  toggle: () => void;
  /** Set explicitly to `"light"` or `"dark"` and persist. */
  setTheme: (theme: Theme) => void;
}

/**
 * Headless toggle helper. Build any button you like:
 *
 *   const { isDark, toggle, mounted } = useThemeToggle()
 *   <Button size="icon" variant="transparent" onClick={toggle} aria-label="…">
 *     {mounted && (isDark ? <Sun01Icon /> : <MoonIcon />)}
 *   </Button>
 *
 * The mount gate avoids hydration mismatch (next-themes only knows the
 * persisted preference on the client after mount).
 */
export function useThemeToggle(): UseThemeToggleResult {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const active: Theme = mounted
    ? resolvedTheme === "light" || theme === "light"
      ? "light"
      : "dark"
    : DEFAULT_THEME;

  const setOdsTheme = React.useCallback(
    (next: Theme) => setTheme(next),
    [setTheme],
  );

  const toggle = React.useCallback(
    () => setTheme(active === "dark" ? "light" : "dark"),
    [active, setTheme],
  );

  return {
    mounted,
    theme: active,
    isDark: active === "dark",
    isLight: active === "light",
    toggle,
    setTheme: setOdsTheme,
  };
}
