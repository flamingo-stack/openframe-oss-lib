/**
 * ODS Color Token Utility Functions
 *
 * Provides runtime utilities for working with ODS color tokens
 */

import type { PlatformName } from '../types/platform';
import { pickReadableTextColor } from './color-analysis';
import { clamp } from './common';
import { colorTokens as odsTokens } from './ods-color-tokens-stub';
import {
  PLATFORM_THEME,
  getPlatformAccentColor as identityAccentColor,
  getPlatformDisplayName,
} from './platform-identity';

/** The token map, viewed as a flat key→value lookup. Nested groups (`text`)
 *  are not addressable by a flat key, so `lookupToken` returns only string
 *  leaves — previously an `any` index could hand a caller the nested OBJECT,
 *  which then stringified to "[object Object]" in `applyColorToken`. */
const TOKEN_MAP: Readonly<Record<string, unknown>> = odsTokens;

function lookupToken(tokenKey: string): string | undefined {
  const value = TOKEN_MAP[tokenKey];
  return typeof value === 'string' ? value : undefined;
}

// THE platform union is `PlatformName` (12 platforms). This alias is kept so
// existing importers of `Platform` from this module keep compiling.
export type Platform = PlatformName;
export type ColorCategory = 'open' | 'flamingo' | 'system' | 'attention';
export type ColorVariant = 'base' | 'hover' | 'active' | 'focus' | 'disabled';

/**
 * Gets the raw ODS token value for a specific color
 */
export function getODSToken(
  category: ColorCategory,
  color: string,
  variant: ColorVariant = 'base',
): string | undefined {
  const tokenKey = `${category}-${color}-${variant}`;
  return lookupToken(tokenKey);
}

// The accent colour is owned by the platform-identity leaf (all 12 platforms,
// derived from the brand record); re-exported here for existing importers.
export { getPlatformAccentColor } from './platform-identity';

/**
 * Gets the current platform from environment or DOM
 */
export function getCurrentPlatform(): PlatformName {
  // Server-side: use environment variable
  if (typeof window === 'undefined') {
    return (process.env.NEXT_PUBLIC_APP_TYPE as PlatformName) || 'openmsp';
  }

  // Client-side: check DOM attribute first, fallback to environment
  const domPlatform = document.documentElement.getAttribute('data-app-type');
  if (domPlatform) {
    return domPlatform as PlatformName;
  }

  return (process.env.NEXT_PUBLIC_APP_TYPE as PlatformName) || 'openmsp';
}

/**
 * Switches the platform theme by updating CSS custom properties
 */
export function switchPlatformTheme(platform: Platform): void {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  root.setAttribute('data-app-type', platform);

  // Note: Cannot modify process.env at runtime in production
  // This would only work in development/test environments

  // Dispatch custom event for components to react to platform changes
  window.dispatchEvent(
    new CustomEvent('platformThemeChanged', {
      detail: { platform },
    }),
  );
}

/**
 * Gets a semantic color value for the current platform
 */
export function getSemanticColor(semanticName: string, platform?: Platform): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const currentPlatform = platform || getCurrentPlatform();

  // Switch platform temporarily to get the color
  const originalPlatform = getCurrentPlatform();
  if (currentPlatform !== originalPlatform) {
    switchPlatformTheme(currentPlatform);
  }

  const testElement = document.createElement('div');
  document.body.appendChild(testElement);

  const computedStyle = getComputedStyle(testElement);
  const colorValue = computedStyle.getPropertyValue(`--color-${semanticName}`);

  document.body.removeChild(testElement);

  // Restore original platform
  if (currentPlatform !== originalPlatform) {
    switchPlatformTheme(originalPlatform);
  }

  return colorValue.trim() || undefined;
}

/**
 * Converts an ODS token to its corresponding Tailwind class
 */
export function tokenToTailwindClass(tokenKey: string, type: 'bg' | 'text' | 'border' = 'bg'): string | undefined {
  // Map common tokens to Tailwind classes
  const tokenMappings: Record<string, string> = {
    // Accent colors
    'accent-primary': 'accent',
    'accent-hover': 'accent-hover',
    'accent-active': 'accent-active',

    // Background colors
    bg: 'bg',
    'bg-card': 'card',
    'bg-hover': 'bg-hover',
    'bg-active': 'bg-active',

    // Text colors
    'text-primary': 'text-primary',
    'text-secondary': 'text-secondary',
    'text-muted': 'text-muted',
    'text-disabled': 'text-disabled',
    'text-on-accent': 'text-on-accent',
    'text-on-dark': 'text-on-dark',

    // Border colors
    'border-default': 'border',
    'border-hover': 'border-hover',
    'border-focus': 'border-focus',

    // Status colors
    success: 'success',
    error: 'error',
    warning: 'warning',
    info: 'info',
  };

  const mappedToken = tokenMappings[tokenKey];
  if (!mappedToken) return undefined;

  return `${type}-ods-${mappedToken}`;
}

/**
 * Gets all available ODS tokens for a category
 */
export function getTokensByCategory(category: ColorCategory): Record<string, string> {
  const tokens: Record<string, string> = {};

  Object.entries(odsTokens).forEach(([key, value]) => {
    if (key.startsWith(`${category}-`)) {
      tokens[key] = value as string;
    }
  });

  return tokens;
}

/**
 * Validates if a color token exists in the ODS system
 */
export function isValidODSToken(tokenKey: string): boolean {
  return tokenKey in odsTokens;
}

/**
 * Gets the platform configuration for theming
 */
export function getPlatformConfig(platform?: Platform) {
  const currentPlatform = platform || getCurrentPlatform();
  // STATED CHANGE: `isDarkTheme` is now `PLATFORM_THEME` (dark for every
  // platform, which is what every `[data-app-type]` block actually inherits).
  // It used to read `platform !== 'flamingo'`, which was stale.
  const isDarkTheme = PLATFORM_THEME === 'dark';

  return {
    platform: currentPlatform,
    accentColor: identityAccentColor(currentPlatform),
    isDarkTheme,
    isLightTheme: !isDarkTheme,
    brandName: getPlatformDisplayName(currentPlatform),
  };
}

/**
 * Applies a color token as a CSS custom property
 */
export function applyColorToken(element: HTMLElement, property: string, tokenKey: string): void {
  const tokenValue = lookupToken(tokenKey);
  if (tokenValue) {
    element.style.setProperty(`--${property}`, tokenValue);
  }
}

/**
 * Creates a color interpolation between two ODS tokens
 */
export function interpolateColors(startToken: string, endToken: string, progress: number): string {
  const startColor = lookupToken(startToken);
  const endColor = lookupToken(endToken);

  if (!startColor || !endColor) {
    return startColor || endColor || '#000000';
  }

  // Was a pair of local `hexToRgb`/`rgbToHex` copies that shadowed the exported
  // ones below. They were not just duplicates — the local `rgbToHex` used the
  // `(1 << 24)` trick, which produces garbage for a channel outside 0-255, while
  // the exported one clamps and pads. Black-on-unparseable is kept because that
  // is what the local `hexToRgb` did; the exported one returns null.
  const BLACK = { r: 0, g: 0, b: 0 };
  const start = hexToRgb(startColor) ?? BLACK;
  const end = hexToRgb(endColor) ?? BLACK;

  const interpolated = {
    r: start.r + (end.r - start.r) * progress,
    g: start.g + (end.g - start.g) * progress,
    b: start.b + (end.b - start.b) * progress,
  };

  return rgbToHex(interpolated.r, interpolated.g, interpolated.b);
}

/**
 * Hook for React components to use platform-aware colors
 */
export function usePlatformColors(platform?: Platform) {
  const currentPlatform = platform || getCurrentPlatform();
  const config = getPlatformConfig(currentPlatform);

  return {
    platform: currentPlatform,
    accentColor: config.accentColor,
    isDarkTheme: config.isDarkTheme,
    isLightTheme: config.isLightTheme,
    brandName: config.brandName,
    getToken: (category: ColorCategory, color: string, variant?: ColorVariant) => getODSToken(category, color, variant),
    switchTheme: (newPlatform: Platform) => switchPlatformTheme(newPlatform),
    getSemanticColor: (semanticName: string) => getSemanticColor(semanticName, currentPlatform),
  };
}

/**
 * Picks a near-black or near-white text color with adequate contrast on `hex`.
 * Thin wrapper over `pickReadableTextColor` (color-analysis.ts) — ONE
 * light-or-dark decision formula (WCAG relative luminance) for the whole lib.
 */
export function getReadableTextColor(hex: string): string {
  return pickReadableTextColor(hex) === 'dark' ? '#212121' : '#fafafa';
}

// Hex <-> RGB <-> HSL. Hex is #rrggbb lowercase; hexToRgb returns null on invalid.

export const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!HEX_PATTERN.test(hex)) return null;
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Ticket-status interaction states. The design-system presets derive their
// hover/active fills by darkening each RGB channel a fixed step (10 → hover,
// 20 → active). Applying the same rule to user-picked custom colors keeps their
// interaction states consistent with the presets without hardcoding a variant
// per color. Channels floor at 0 via rgbToHex's clamp.
const HOVER_DARKEN_STEP = 10;
const ACTIVE_DARKEN_STEP = 20;

function darkenByStep(hex: string, step: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb.r - step, rgb.g - step, rgb.b - step);
}

export function deriveHoverColor(hex: string): string {
  return darkenByStep(hex, HOVER_DARKEN_STEP);
}

export function deriveActiveColor(hex: string): string {
  return darkenByStep(hex, ACTIVE_DARKEN_STEP);
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const hn = ((h % 360) + 360) % 360;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hue2rgb = (t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  const hk = hn / 360;
  return {
    r: Math.round(hue2rgb(hk + 1 / 3) * 255),
    g: Math.round(hue2rgb(hk) * 255),
    b: Math.round(hue2rgb(hk - 1 / 3) * 255),
  };
}
