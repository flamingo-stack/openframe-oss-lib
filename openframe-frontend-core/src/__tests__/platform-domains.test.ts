import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PLATFORM_DOMAINS,
  byKey,
  getPlatformProductionUrl,
  getPlatformByHostname,
  getAllPlatformBaseDomains,
  hostOf,
  expandWwwApex,
  toRegistrableBaseDomain,
  aliasHostsOf,
} from '@/platform-domains'

/**
 * Helper: run a fn with a stubbed `window.location.hostname` (prod, non-localhost,
 * non-vercel) so getAllPlatformBaseDomains exercises its production branch.
 */
function withProdWindow<T>(hostname: string, fn: () => T): T {
  vi.stubGlobal('window', { location: { hostname } })
  try {
    return fn()
  } finally {
    vi.unstubAllGlobals()
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('platform-domains — forward resolution (defaults = byte-identical to the old cn.ts switch)', () => {
  it('returns each defaultUrl when no env override is set', () => {
    for (const entry of PLATFORM_DOMAINS) {
      expect(getPlatformProductionUrl(entry.key)).toBe(entry.defaultUrl)
    }
  })
  it('falls back to flamingo.run for an unknown key (old default case)', () => {
    expect(getPlatformProductionUrl('not-a-platform')).toBe('https://www.flamingo.run')
  })
})

describe('🔒 cross-subdomain cookie sharing (the SSO invariant — must never regress)', () => {
  // With NO NEXT_PUBLIC_*_URL overrides set (today's production reality), the defaults
  // alone MUST still produce the registrable base domains that scope the auth cookie
  // across every hub subdomain. This is exactly what pure-env-only would have broken.
  it('emits .flamingo.so / .flamingo.run / .openmsp.ai / .tmcg.miami / .openframe.ai from defaults', () => {
    const bases = withProdWindow('company-hub.flamingo.so', getAllPlatformBaseDomains)
    for (const must of ['.flamingo.so', '.flamingo.run', '.openmsp.ai', '.tmcg.miami', '.openframe.ai']) {
      expect(bases).toContain(must)
    }
  })
  it('shares one base domain across all *.flamingo.so hubs (cross-hub SSO)', () => {
    for (const hub of ['marketing-hub', 'company-hub', 'product-hub', 'revenue-hub', 'people-hub']) {
      expect(toRegistrableBaseDomain(hostOf(getPlatformProductionUrl(hub))!)).toBe('flamingo.so')
    }
  })
  it('keeps flamingo.cx OUT of the cookie set (alias excluded) but IN the reverse map', () => {
    const bases = withProdWindow('www.flamingo.run', getAllPlatformBaseDomains)
    expect(bases).not.toContain('.flamingo.cx')
    expect(getPlatformByHostname('flamingo.cx')).toBe('flamingo-teaser')
  })
  it('returns [] for localhost and .vercel.app (host-only cookies)', () => {
    expect(withProdWindow('localhost', getAllPlatformBaseDomains)).toEqual([])
    expect(withProdWindow('foo.vercel.app', getAllPlatformBaseDomains)).toEqual(['.vercel.app', 'vercel.app'])
  })
})

describe('reverse resolver (first-wins ordering + aliases)', () => {
  it.each([
    ['www.flamingo.run', 'flamingo'],
    ['flamingo.run', 'flamingo'],
    ['flamingo.cx', 'flamingo-teaser'],
    ['www.flamingo.cx', 'flamingo-teaser'],
    ['openframe.ai', 'openframe'],
    ['www.openframe.ai', 'openframe'],
    ['hub.openframe.ai', 'openframe'], // additive fix — was null in the old PLATFORM_DOMAIN_MAP
    ['marketing-hub.flamingo.so', 'marketing-hub'],
    ['WWW.OPENMSP.AI', 'openmsp'], // case-insensitive
    ['evil.com', null],
  ])('%s → %s', (host, expected) => {
    expect(getPlatformByHostname(host)).toBe(expected)
  })
})

describe('host primitives', () => {
  it('hostOf strips scheme + port, lowercases, null on garbage', () => {
    expect(hostOf('https://WWW.Openmsp.ai:8443/x')).toBe('www.openmsp.ai')
    expect(hostOf('not a url')).toBeNull()
    expect(hostOf(null)).toBeNull()
  })
  it('expandWwwApex handles www / apex / 3-label / 1-label', () => {
    expect(expandWwwApex('www.openmsp.ai')).toEqual(['www.openmsp.ai', 'openmsp.ai'])
    expect(expandWwwApex('openmsp.ai')).toEqual(['openmsp.ai', 'www.openmsp.ai'])
    expect(expandWwwApex('hub.openframe.ai')).toEqual(['hub.openframe.ai'])
    expect(expandWwwApex('localhost')).toEqual(['localhost'])
  })
  it('toRegistrableBaseDomain + aliasHostsOf', () => {
    expect(toRegistrableBaseDomain('marketing-hub.flamingo.so')).toBe('flamingo.so')
    expect(toRegistrableBaseDomain('localhost')).toBeUndefined()
    expect(aliasHostsOf('flamingo-teaser')).toEqual(['flamingo.cx', 'www.flamingo.cx'])
    expect(aliasHostsOf('openmsp')).toEqual([])
  })
})

describe('env override path', () => {
  // ENV_OVERRIDES captures `process.env.NEXT_PUBLIC_*` at MODULE LOAD — required so the
  // values are build-inlined (literal keys) in the browser bundle. So an override must be
  // set BEFORE the module evaluates: stub env → resetModules → dynamic import.
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })
  it('an override wins over the default (per-distinct-var, no cross-contamination)', async () => {
    vi.stubEnv('NEXT_PUBLIC_TMCG_URL', 'https://sentinel-tmcg.example')
    vi.resetModules()
    const mod = await import('@/platform-domains')
    expect(mod.getPlatformProductionUrl('tmcg')).toBe('https://sentinel-tmcg.example')
    // a non-sharing key is unaffected
    expect(mod.getPlatformProductionUrl('openmsp')).toBe('https://www.openmsp.ai')
  })
  it('the shared NEXT_PUBLIC_FLAMINGO_URL drives all three of its keys', async () => {
    vi.stubEnv('NEXT_PUBLIC_FLAMINGO_URL', 'https://sentinel-flamingo.example')
    vi.resetModules()
    const mod = await import('@/platform-domains')
    for (const k of ['flamingo', 'flamingo-teaser', 'universal']) {
      expect(mod.getPlatformProductionUrl(k)).toBe('https://sentinel-flamingo.example')
    }
  })
})

describe('registry integrity', () => {
  it('byKey resolves every key and openframe-dashboard is pseudo', () => {
    expect(byKey('openframe-dashboard')?.pseudo).toBe(true)
    expect(byKey('not-a-platform')).toBeUndefined()
  })
})
