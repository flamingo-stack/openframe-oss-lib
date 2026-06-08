/**
 * Platform-Domain SSOT (single source of truth) + derivations.
 *
 * ONE registry maps each platform → its canonical production URL (`defaultUrl`,
 * the load-bearing source) with an optional per-deploy `NEXT_PUBLIC_*_URL`
 * OVERRIDE. Everything else — the reverse host→platform resolver, the cookie
 * base-domain set (the cross-subdomain SSO mechanism), www/apex expansion, the
 * URL→host parse, preview detection — derives from this one table.
 *
 * EDGE-SAFE + PURE: no React/clsx/tailwind, no `server-only`, no `node:`
 * builtins, no `'use client'`. So it is legal in the Edge middleware
 * (`proxy.ts`), in `'use client'` providers, AND in `server-only` modules
 * (e.g. cookie-domain-server.ts) simultaneously. The ONLY non-pure export is
 * `getAllPlatformBaseDomains`, which reads `typeof window`/`process.env` to
 * preserve byte-identical cookie behavior.
 */

import type { PlatformName } from './types/platform'

export type PlatformDomainKey = PlatformName | 'openframe-dashboard'

export interface PlatformDomainEntry {
  /** Platform key (matches `PlatformName`, plus the forward-only `openframe-dashboard`). */
  key: PlatformDomainKey
  /** Canonical production URL — the LOAD-BEARING source of truth (today's hardcoded fallbacks). */
  defaultUrl: string
  /** `NEXT_PUBLIC_*_URL` per-deploy OVERRIDE. The `defaultUrl` covers it when unset. */
  envVar: string
  /** Legacy/secondary hosts that REVERSE-map to this key (no env var exists — NOT canonical). */
  aliasHostnames?: string[]
  /** Forward-only: no DB row, excluded from the reverse index + cookie set (e.g. the product-CTA dashboard). */
  pseudo?: boolean
}

export const PLATFORM_DOMAINS: readonly PlatformDomainEntry[] = [
  { key: 'marketing-hub', defaultUrl: 'https://marketing-hub.flamingo.so', envVar: 'NEXT_PUBLIC_MARKETING_HUB_URL' },
  { key: 'company-hub',   defaultUrl: 'https://company-hub.flamingo.so',   envVar: 'NEXT_PUBLIC_COMPANY_HUB_URL' },
  { key: 'product-hub',   defaultUrl: 'https://product-hub.flamingo.so',   envVar: 'NEXT_PUBLIC_PRODUCT_HUB_URL' },
  { key: 'revenue-hub',   defaultUrl: 'https://revenue-hub.flamingo.so',   envVar: 'NEXT_PUBLIC_REVENUE_HUB_URL' },
  { key: 'people-hub',    defaultUrl: 'https://people-hub.flamingo.so',    envVar: 'NEXT_PUBLIC_PEOPLE_HUB_URL' },
  { key: 'openmsp',       defaultUrl: 'https://www.openmsp.ai',            envVar: 'NEXT_PUBLIC_OPENMSP_URL' },
  // ORDERING INVARIANT (first-wins, load-bearing): `flamingo` MUST precede `flamingo-teaser` + `universal`.
  // All three resolve to www.flamingo.run; the reverse index is first-wins → flamingo claims the shared host,
  // teaser keeps only its unique flamingo.cx aliases, universal contributes no unique host.
  // ⚠️ DO NOT REORDER — enforced by the module-load self-check at the bottom of this file.
  { key: 'flamingo',         defaultUrl: 'https://www.flamingo.run',  envVar: 'NEXT_PUBLIC_FLAMINGO_URL' },
  { key: 'tmcg',             defaultUrl: 'https://www.tmcg.miami',    envVar: 'NEXT_PUBLIC_TMCG_URL' },
  { key: 'flamingo-teaser',  defaultUrl: 'https://www.flamingo.run',  envVar: 'NEXT_PUBLIC_FLAMINGO_URL', aliasHostnames: ['flamingo.cx', 'www.flamingo.cx'] },
  { key: 'openframe',        defaultUrl: 'https://openframe.ai',      envVar: 'NEXT_PUBLIC_OPENFRAME_URL', aliasHostnames: ['openframe.ai', 'www.openframe.ai', 'hub.openframe.ai'] },
  { key: 'openframe-dashboard', defaultUrl: 'https://openframe.ai',   envVar: 'NEXT_PUBLIC_OPENFRAME_DASHBOARD_URL', pseudo: true },
  { key: 'universal',        defaultUrl: 'https://www.flamingo.run',  envVar: 'NEXT_PUBLIC_FLAMINGO_URL' },
]

// ── Compile-time key guards (anchor the table on PlatformName, both directions) ──
// (1) Removal/typo guard: every table key must be a valid PlatformDomainKey.
const _tableSatisfies = PLATFORM_DOMAINS satisfies readonly PlatformDomainEntry[]
void _tableSatisfies
// (2) Addition guard: a NEW PlatformName member that lacks a table row fails the build.
type _MissingKey = Exclude<PlatformName, (typeof PLATFORM_DOMAINS)[number]['key']>
const _exhaustive: [_MissingKey] extends [never] ? true : false = true
void _exhaustive

// ── Env overrides (the ONLY place env URLs enter — literal-key inlined + compile-time-guarded) ──
// `process.env.NEXT_PUBLIC_X` is build-inlined ONLY with a LITERAL key, so the env-var name is the
// irreducible two-copy (the registry `envVar` column + the literal access below). The `satisfies` makes
// `tsc`/`next build` FAIL if this map is missing a registry env var OR carries a stale one (bidirectional).
type EnvVarKey = (typeof PLATFORM_DOMAINS)[number]['envVar']
const ENV_OVERRIDES = {
  NEXT_PUBLIC_MARKETING_HUB_URL: process.env.NEXT_PUBLIC_MARKETING_HUB_URL,
  NEXT_PUBLIC_COMPANY_HUB_URL: process.env.NEXT_PUBLIC_COMPANY_HUB_URL,
  NEXT_PUBLIC_PRODUCT_HUB_URL: process.env.NEXT_PUBLIC_PRODUCT_HUB_URL,
  NEXT_PUBLIC_REVENUE_HUB_URL: process.env.NEXT_PUBLIC_REVENUE_HUB_URL,
  NEXT_PUBLIC_PEOPLE_HUB_URL: process.env.NEXT_PUBLIC_PEOPLE_HUB_URL,
  NEXT_PUBLIC_OPENMSP_URL: process.env.NEXT_PUBLIC_OPENMSP_URL,
  NEXT_PUBLIC_FLAMINGO_URL: process.env.NEXT_PUBLIC_FLAMINGO_URL,
  NEXT_PUBLIC_TMCG_URL: process.env.NEXT_PUBLIC_TMCG_URL,
  NEXT_PUBLIC_OPENFRAME_URL: process.env.NEXT_PUBLIC_OPENFRAME_URL,
  NEXT_PUBLIC_OPENFRAME_DASHBOARD_URL: process.env.NEXT_PUBLIC_OPENFRAME_DASHBOARD_URL,
} satisfies Record<EnvVarKey, string | undefined>

/** The registry entry for a key (undefined for an unknown key). */
export function byKey(key: string): PlatformDomainEntry | undefined {
  return PLATFORM_DOMAINS.find((e) => e.key === key)
}

/** Read a platform's `NEXT_PUBLIC_*_URL` override (or null). */
function envOverrideFor(key: string): string | null {
  const envVar = byKey(key)?.envVar
  if (!envVar) return null
  return (ENV_OVERRIDES as Record<string, string | undefined>)[envVar] || null
}

/**
 * Canonical production URL for a platform: env override wins, else the `defaultUrl`.
 * NEVER throws / undefined — the default guarantees a host (this is what keeps the
 * cookie base-domains, the reverse map, and CSP intact even with every override unset).
 * Byte-identical to the old cn.ts switch (incl. the unknown-key flamingo.run fallback).
 */
export function getPlatformProductionUrl(platform: string): string {
  return (
    envOverrideFor(platform) ??
    byKey(platform)?.defaultUrl ??
    envOverrideFor('flamingo') ??
    'https://www.flamingo.run'
  )
}

// ── Single-owner host primitives ──

/** Canonical URL→host parser: `.hostname` (PORT-STRIPPED, lowercased), null on parse failure. */
export function hostOf(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return null
  }
}

/** Expand a host into its `www.`/apex pair. 3+-label and single-label hosts return `[host]`. */
export function expandWwwApex(host: string): string[] {
  if (host.startsWith('www.')) return [host, host.slice(4)]
  if (host.split('.').length === 2) return [host, `www.${host}`]
  return [host]
}

/** Registrable base domain (`parts.slice(-2).join('.')`), dotless; undefined for <2-label. */
export function toRegistrableBaseDomain(host: string): string | undefined {
  const parts = host.split('.')
  if (parts.length >= 2) return parts.slice(-2).join('.')
  return undefined
}

/** An entry's alias hosts (single-owner reader). */
export function aliasHostsOf(key: string): string[] {
  return byKey(key)?.aliasHostnames ?? []
}

/** All hosts an entry contributes to the reverse index (resolved host + optional aliases). */
function hostsForEntry(entry: PlatformDomainEntry, opts: { includeAliases: boolean }): string[] {
  const resolved = hostOf(getPlatformProductionUrl(entry.key))
  const hosts = resolved ? expandWwwApex(resolved) : []
  if (opts.includeAliases) hosts.push(...aliasHostsOf(entry.key))
  return hosts
}

/**
 * Reverse resolver: hostname → platform key (first-wins over registry order, non-pseudo only).
 * Guarantees openframe.ai / www.openframe.ai / hub.openframe.ai → openframe in every env.
 * Replaces the hub `PLATFORM_DOMAIN_MAP`.
 */
export function getPlatformByHostname(hostname: string): PlatformDomainKey | null {
  const host = hostname.toLowerCase()
  for (const entry of PLATFORM_DOMAINS) {
    if (entry.pseudo) continue
    if (hostsForEntry(entry, { includeAliases: true }).includes(host)) return entry.key
  }
  return null
}

// ── Preview detection (two distinct predicates — env-form vs host-form) ──

/** Env-form preview predicate (Vercel `VERCEL_ENV`). */
export function isPreviewEnv(): boolean {
  return process.env.VERCEL_ENV === 'preview'
}

/** Host-form preview predicate (a `*.vercel.app` host). Dot-bounded suffix so a
 *  malicious `foo.vercel.app.evil.com` is NOT treated as preview. */
export function isPreviewHost(hostname: string): boolean {
  return hostname.endsWith('.vercel.app')
}

/**
 * ALL unique cookie base domains (the cross-subdomain SSO mechanism).
 *
 * NON-PURE (the sole such export): reads `typeof window` + `process.env` to
 * preserve byte-identical cookie behavior. Keeps the original three branches:
 *   1. localhost / private IP → [] (host-only cookies)
 *   2. Vercel preview (env OR host) → ['.vercel.app','vercel.app']
 *   3. production → for each non-pseudo platform, registrable base of its resolved
 *      host, emitted as both `.base` and bare `base`.
 *
 * Because `getPlatformProductionUrl` always yields a host (override OR default),
 * `.flamingo.so` / `.flamingo.run` / `.openmsp.ai` / `.tmcg.miami` / `.openframe.ai`
 * are ALWAYS present → cross-hub SSO is byte-identical to today.
 */
export function getAllPlatformBaseDomains(): string[] {
  if (typeof window === 'undefined') return []

  const hostname = window.location.hostname

  // Case 1: localhost / private IP — no domains
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('127.')) {
    return []
  }

  // Case 2: Vercel preview — vercel.app domain
  const previewEnv =
    process.env.VERCEL_ENV === 'preview' ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview' ||
    isPreviewHost(hostname)
  if (previewEnv) {
    return ['.vercel.app', 'vercel.app']
  }

  // Case 3: production — registrable base of every non-pseudo platform's resolved host
  const baseDomains = new Set<string>()
  for (const entry of PLATFORM_DOMAINS) {
    if (entry.pseudo) continue
    const host = hostOf(getPlatformProductionUrl(entry.key))
    if (!host) continue
    const base = toRegistrableBaseDomain(host)
    if (base) {
      baseDomains.add(`.${base}`)
      baseDomains.add(base)
    }
  }
  return Array.from(baseDomains)
}

// ── Module-load ordering self-check (NON-fatal — this module is imported by cn.ts → ~everything,
// so a hard throw would be a total outage if the assertion were ever over-strict). A reorder that
// moves flamingo-teaser/universal before flamingo (e.g. an IDE alphabetize) surfaces loudly in the
// build + prod logs instead of silently cross-tabbing flamingo links to the wrong owner. The
// authoritative guard is the reverse-map vitest (src/__tests__/platform-domains.test.ts). ⚠️ keep
// `flamingo` before `flamingo-teaser`/`universal` in PLATFORM_DOMAINS.
if (
  getPlatformByHostname('www.flamingo.run') !== 'flamingo' ||
  getPlatformByHostname('flamingo.cx') !== 'flamingo-teaser' ||
  getPlatformByHostname('hub.openframe.ai') !== 'openframe'
) {
  // eslint-disable-next-line no-console
  console.error(
    '[platform-domains] ⚠️ PLATFORM_DOMAINS ordering invariant violated — `flamingo` must precede ' +
      '`flamingo-teaser`/`universal`, and the openframe aliases must be intact. Do not reorder the table.',
  )
}
