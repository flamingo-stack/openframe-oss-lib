/**
 * Platform identity + brand SSOT (single source of truth).
 *
 * ONE module owns every per-platform STRING (display/short/long name, description,
 * slogan, icon name) and every per-platform COLOUR DECISION (the accent/secondary
 * "stem", the theme, the surface). Everything downstream DERIVES from here:
 * `platform-config.tsx`'s icon + colour maps, `PlatformBadge`, `getPlatformConfig`,
 * the hub's `AppConfig.brandColors`, the hub's manifest generator and `theme-color`.
 *
 * JSX-FREE + zero-dependency ON PURPOSE: it carries its own tsup entry and
 * `exports` subpath (`@flamingo-stack/openframe-frontend-core/utils/platform-identity`)
 * so hub SCRIPTS and `server-only` modules can import it without dragging React,
 * the icon components, or the utils barrel into their graph.
 *
 * TWO accepted by-construction copies of the colour decision remain, both LOCKED
 * by the hub's `platform-brand-parity` jest test:
 *   1. `platformHexColors` below (hand-typed hex mirror of each accent token).
 *   2. The `[data-app-type='…']` blocks in `src/styles/ods-colors.css`.
 */

import type { PlatformName } from '../types/platform';

// ── Strings ─────────────────────────────────────────────────────────────────

/** Human-readable platform names. THE naming source for lib-side presentation. */
export const platformDisplayNames = {
  openmsp: 'OpenMSP',
  openframe: 'OpenFrame',
  flamingo: 'Flamingo',
  'flamingo-teaser': 'Flamingo Teaser',
  'marketing-hub': 'Flamingo Marketing Hub',
  'product-hub': 'Flamingo Product Hub',
  'revenue-hub': 'Flamingo Revenue Hub',
  'people-hub': 'Flamingo People Hub',
  'company-hub': 'Flamingo Company Hub',
  tmcg: 'TMCG',
  mlg: 'Major League GitHub',
  universal: 'Universal',
};

/**
 * Short-name OVERRIDES only. A platform without a row falls back to its display
 * name, so this map never lists a name that equals `platformDisplayNames`.
 */
export const platformShortNames: Partial<Record<PlatformName, string>> = {
  mlg: 'MLG',
};

export const platformDescriptions = {
  openmsp:
    'Comprehensive directory and comparison platform for managed service providers (MSPs) and technology vendors. Reduce vendor costs and discover open-source alternatives.',
  openframe: 'AI-driven open-source security operations center (SOC) and endpoint detection platform for MSPs.',
  flamingo:
    'AI-driven open-source OS for MSPs. Swap bloated vendor tools for open ones. Automate the boring crap. Take your margin back.',
  'flamingo-teaser': 'Preview of Flamingo - the AI-driven open-source OS for MSPs.',
  tmcg: 'The Miami Cyber Gang - A cybersecurity community focused on education and collaboration.',
  mlg: 'Scouting report for US open-source talent. Rank GitHub contributors by programming language, city, state, region, and nearest Major League Soccer club.',
  universal: 'Cross-platform universal content.',
};

export const platformSlogans = {
  openmsp: 'Find Your Perfect MSP Partner',
  openframe: 'Open-Source Security Operations',
  flamingo: 'Open-Source OS for MSPs',
  'flamingo-teaser': 'Coming Soon: Open-Source OS for MSPs',
  tmcg: 'Miami Cyber Community',
  mlg: 'GitHub Scouting Report: Major League Edition',
  universal: 'Universal Platform',
};

export const platformIconNames = {
  openmsp: 'openmsp-logo',
  openframe: 'openframe-logo',
  flamingo: 'flamingo-logo',
  universal: 'globe',
  'flamingo-teaser': 'flamingo-logo',
  'marketing-hub': 'flamingo-logo',
  'product-hub': 'flamingo-logo',
  'revenue-hub': 'flamingo-logo',
  'people-hub': 'flamingo-logo',
  'company-hub': 'flamingo-logo',
  tmcg: 'tmcg-logo',
  mlg: 'mlg-logo',
};

export function getPlatformDisplayName(platformName: string): string {
  return platformDisplayNames[platformName as keyof typeof platformDisplayNames] || platformName;
}

/** Compact label (nav chips, manifest `short_name`, JSON-LD `alternateName`). */
export function getPlatformShortName(platformName: string): string {
  return platformShortNames[platformName as PlatformName] ?? getPlatformDisplayName(platformName);
}

export function getPlatformDescription(platformName: string): string {
  return platformDescriptions[platformName as keyof typeof platformDescriptions] || platformName;
}

export function getPlatformSlogan(platformName: string): string {
  return platformSlogans[platformName as keyof typeof platformSlogans] || platformName;
}

export function getDefaultIconForPlatform(platformName: string): string {
  return platformIconNames[platformName as keyof typeof platformIconNames] || platformIconNames.universal;
}

// ── Colour stems ────────────────────────────────────────────────────────────

/**
 * The six brand/attention colours (plus the neutral) a platform may adopt, named
 * by STEM rather than by token so the token spelling has exactly one home below.
 */
export type OdsColorStem =
  | 'flamingo-pink'
  | 'flamingo-cyan'
  | 'open-yellow'
  | 'success'
  | 'warning'
  | 'error'
  | 'text-secondary';

/** Stem → ODS token name (without the `--ods-` prefix). THE token spelling. */
export const ODS_STEM_TOKENS: Record<OdsColorStem, string> = {
  'flamingo-pink': 'flamingo-pink-base',
  'flamingo-cyan': 'flamingo-cyan-base',
  'open-yellow': 'open-yellow-base',
  success: 'attention-green-success',
  warning: 'attention-yellow-warning',
  error: 'attention-red-error',
  'text-secondary': 'system-greys-grey',
};

/**
 * Stem → Tailwind class strings. STATIC LITERALS on purpose: the Tailwind
 * scanner reads source text, so a template-built class would be purged.
 * This is the ONLY place a stem-to-class literal exists.
 */
export const ODS_STEM_CLASSES: Record<OdsColorStem, { text: string; bg: string; bgSoft: string; borderSoft: string }> =
  {
    'flamingo-pink': {
      text: 'text-ods-flamingo-pink',
      bg: 'bg-ods-flamingo-pink',
      bgSoft: 'bg-ods-flamingo-pink/10',
      borderSoft: 'border-ods-flamingo-pink/30',
    },
    'flamingo-cyan': {
      text: 'text-ods-flamingo-cyan',
      bg: 'bg-ods-flamingo-cyan',
      bgSoft: 'bg-ods-flamingo-cyan/10',
      borderSoft: 'border-ods-flamingo-cyan/30',
    },
    'open-yellow': {
      text: 'text-ods-open-yellow',
      bg: 'bg-ods-open-yellow',
      bgSoft: 'bg-ods-open-yellow/10',
      borderSoft: 'border-ods-open-yellow/30',
    },
    success: {
      text: 'text-ods-success',
      bg: 'bg-ods-success',
      bgSoft: 'bg-ods-success/10',
      borderSoft: 'border-ods-success/30',
    },
    warning: {
      text: 'text-ods-warning',
      bg: 'bg-ods-warning',
      bgSoft: 'bg-ods-warning/10',
      borderSoft: 'border-ods-warning/30',
    },
    error: {
      text: 'text-ods-error',
      bg: 'bg-ods-error',
      bgSoft: 'bg-ods-error/10',
      borderSoft: 'border-ods-error/30',
    },
    'text-secondary': {
      text: 'text-ods-text-secondary',
      bg: 'bg-ods-text-secondary',
      bgSoft: 'bg-ods-text-secondary/10',
      borderSoft: 'border-ods-text-secondary/30',
    },
  };

// ── Theme + surface ─────────────────────────────────────────────────────────

/**
 * Every platform ships the dark theme today (the hub's flamingo config says so
 * explicitly, and every `[data-app-type]` block inherits the dark `:root`).
 * ONE constant instead of a per-platform field: reintroduce the field only when
 * a platform actually differs.
 */
export const PLATFORM_THEME = 'dark' as const;

/** The dark surface's tokens, consumed by config `brandColors` and the manifest. */
export const PLATFORM_SURFACE = {
  background: 'system-greys-background',
  text: 'system-greys-white',
} as const;

export const getPlatformBackgroundVarName = (): string => `--ods-${PLATFORM_SURFACE.background}`;
export const getPlatformTextVarName = (): string => `--ods-${PLATFORM_SURFACE.text}`;

// ── Brand record ────────────────────────────────────────────────────────────

export interface PlatformBrand {
  /** Primary brand colour (`--color-accent-primary` in the platform's CSS block). */
  accentStem: OdsColorStem;
  /** Link colour (`--color-link`). Equals `accentStem` for most platforms. */
  secondaryStem: OdsColorStem;
}

/**
 * THE accent/link table. Every row is verified against that platform's
 * `[data-app-type='…']` block in `ods-colors.css` by the hub's parity test.
 */
export const PLATFORM_BRAND: Record<PlatformName, PlatformBrand> = {
  openframe: { accentStem: 'open-yellow', secondaryStem: 'flamingo-cyan' },
  openmsp: { accentStem: 'open-yellow', secondaryStem: 'open-yellow' },
  flamingo: { accentStem: 'flamingo-pink', secondaryStem: 'flamingo-pink' },
  'flamingo-teaser': { accentStem: 'flamingo-pink', secondaryStem: 'flamingo-pink' },
  tmcg: { accentStem: 'flamingo-pink', secondaryStem: 'flamingo-pink' },
  'marketing-hub': { accentStem: 'flamingo-pink', secondaryStem: 'flamingo-pink' },
  'product-hub': { accentStem: 'success', secondaryStem: 'success' },
  'revenue-hub': { accentStem: 'warning', secondaryStem: 'warning' },
  'people-hub': { accentStem: 'flamingo-cyan', secondaryStem: 'flamingo-cyan' },
  'company-hub': { accentStem: 'error', secondaryStem: 'error' },
  mlg: { accentStem: 'flamingo-pink', secondaryStem: 'flamingo-cyan' },
  universal: { accentStem: 'text-secondary', secondaryStem: 'text-secondary' },
};

/** The brand row for a platform, falling back to `universal` for anything unknown. */
export function getPlatformBrand(platformName: string): PlatformBrand {
  return PLATFORM_BRAND[platformName as PlatformName] ?? PLATFORM_BRAND.universal;
}

export function platformAccentToken(platformName: string): string {
  return ODS_STEM_TOKENS[getPlatformBrand(platformName).accentStem];
}

export function platformSecondaryToken(platformName: string): string {
  return ODS_STEM_TOKENS[getPlatformBrand(platformName).secondaryStem];
}

/** `--ods-…` CSS variable NAME for a platform's accent (input to `resolveOdsColor`). */
export function platformAccentVarName(platformName: string): string {
  return `--ods-${platformAccentToken(platformName)}`;
}

export function platformSecondaryVarName(platformName: string): string {
  return `--ods-${platformSecondaryToken(platformName)}`;
}

/** `var(--ods-…)` VALUE for a platform's accent (config `brandColors` data). */
export function getPlatformAccentColor(platformName: string): string {
  return `var(${platformAccentVarName(platformName)})`;
}

export function getPlatformSecondaryColor(platformName: string): string {
  return `var(${platformSecondaryVarName(platformName)})`;
}

/** Tailwind classes for a platform, DERIVED from its stems. */
export function getPlatformBrandClasses(platformName: string): {
  accentText: string;
  accentBg: string;
  accentBgSoft: string;
  accentBorderSoft: string;
  secondaryText: string;
} {
  const brand = getPlatformBrand(platformName);
  const accent = ODS_STEM_CLASSES[brand.accentStem];
  const secondary = ODS_STEM_CLASSES[brand.secondaryStem];
  return {
    accentText: accent.text,
    accentBg: accent.bg,
    accentBgSoft: accent.bgSoft,
    accentBorderSoft: accent.borderSoft,
    secondaryText: secondary.text,
  };
}

/** Platform background classes, DERIVED (was a hand-typed hex map). */
export const platformColors: Record<PlatformName, string> = Object.fromEntries(
  (Object.keys(PLATFORM_BRAND) as PlatformName[]).map(p => [p, getPlatformBrandClasses(p).accentBg])
) as Record<PlatformName, string>;

export function getPlatformColor(platformName: string) {
  return platformColors[platformName as PlatformName] || platformColors.universal;
}

/**
 * Hand-typed hex mirror of each platform's accent token (the DB `default_color`
 * and other JS-value consumers). Accepted copy #1 — the hub's parity test asserts
 * every row equals `resolveOdsColor(platformAccentVarName(platform))`.
 */
export const platformHexColors: Record<PlatformName, string> = {
  openmsp: '#ffc008',
  openframe: '#ffc008',
  flamingo: '#f357bb',
  universal: '#888888',
  'flamingo-teaser': '#f357bb',
  'marketing-hub': '#f357bb',
  'product-hub': '#5ea62e',
  'revenue-hub': '#e1b32f',
  'people-hub': '#5efaf0',
  'company-hub': '#f36666',
  tmcg: '#f357bb',
  mlg: '#f357bb',
};

export function getDefaultColorForPlatform(platformName: string): string {
  return platformHexColors[platformName as PlatformName] || platformHexColors.universal;
}
