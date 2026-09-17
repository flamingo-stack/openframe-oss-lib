import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PLATFORM_DOMAINS,
  byKey,
  getPlatformProductionUrl,
  getPlatformUrl,
  getDeploymentUrl,
  getRequestOrigin,
  isLocalUrl,
  resolveRedirectTarget,
  getPlatformByHostname,
  getAllPlatformBaseDomains,
  hostOf,
  expandWwwApex,
  toRegistrableBaseDomain,
  aliasHostsOf,
  ensureScheme,
  isNonCookieableHost,
  matchCookieDomain,
} from '@/platform-domains';

/**
 * Helper: run a fn with a stubbed `window.location.hostname` (prod, non-localhost,
 * non-vercel) so getAllPlatformBaseDomains exercises its production branch.
 */
function withProdWindow<T>(hostname: string, fn: () => T): T {
  vi.stubGlobal('window', { location: { hostname } });
  try {
    return fn();
  } finally {
    vi.unstubAllGlobals();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('platform-domains — forward resolution (defaults = byte-identical to the old cn.ts switch)', () => {
  it('returns each defaultUrl when no env override is set', () => {
    for (const entry of PLATFORM_DOMAINS) {
      expect(getPlatformProductionUrl(entry.key)).toBe(entry.defaultUrl);
    }
  });
  it('falls back to flamingo.run for an unknown key (old default case)', () => {
    expect(getPlatformProductionUrl('not-a-platform')).toBe('https://www.flamingo.run');
  });
});

describe('🔒 cross-subdomain cookie sharing (the SSO invariant — must never regress)', () => {
  // With NO NEXT_PUBLIC_*_URL overrides set (today's production reality), the defaults
  // alone MUST still produce the registrable base domains that scope the auth cookie
  // across every hub subdomain. This is exactly what pure-env-only would have broken.
  it('emits .flamingo.so / .flamingo.run / .openmsp.ai / .tmcg.miami / .openframe.ai from defaults', () => {
    const bases = withProdWindow('company-hub.flamingo.so', getAllPlatformBaseDomains);
    for (const must of ['.flamingo.so', '.flamingo.run', '.openmsp.ai', '.tmcg.miami', '.openframe.ai']) {
      expect(bases).toContain(must);
    }
  });
  it('shares one base domain across all *.flamingo.so hubs (cross-hub SSO)', () => {
    for (const hub of ['marketing-hub', 'company-hub', 'product-hub', 'revenue-hub', 'people-hub']) {
      const host = hostOf(getPlatformProductionUrl(hub));
      // `hostOf` returns null for an unparseable URL — that is a registry bug
      // worth naming, not a TypeError inside `toRegistrableBaseDomain`.
      if (host === null) throw new Error(`hostOf() could not parse the production URL for "${hub}"`);
      expect(toRegistrableBaseDomain(host)).toBe('flamingo.so');
    }
  });
  it('keeps flamingo.cx OUT of the cookie set (alias excluded) but IN the reverse map', () => {
    const bases = withProdWindow('www.flamingo.run', getAllPlatformBaseDomains);
    expect(bases).not.toContain('.flamingo.cx');
    expect(getPlatformByHostname('flamingo.cx')).toBe('flamingo-teaser');
  });
  it('returns [] for localhost and .vercel.app (host-only cookies)', () => {
    expect(withProdWindow('localhost', getAllPlatformBaseDomains)).toEqual([]);
    expect(withProdWindow('foo.vercel.app', getAllPlatformBaseDomains)).toEqual(['.vercel.app', 'vercel.app']);
  });
});

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
    expect(getPlatformByHostname(host)).toBe(expected);
  });
});

describe('host primitives', () => {
  it('hostOf strips scheme + port, lowercases, null on garbage', () => {
    expect(hostOf('https://WWW.Openmsp.ai:8443/x')).toBe('www.openmsp.ai');
    expect(hostOf('not a url')).toBeNull();
    expect(hostOf(null)).toBeNull();
  });
  it('expandWwwApex handles www / apex / 3-label / 1-label', () => {
    expect(expandWwwApex('www.openmsp.ai')).toEqual(['www.openmsp.ai', 'openmsp.ai']);
    expect(expandWwwApex('openmsp.ai')).toEqual(['openmsp.ai', 'www.openmsp.ai']);
    expect(expandWwwApex('hub.openframe.ai')).toEqual(['hub.openframe.ai']);
    expect(expandWwwApex('localhost')).toEqual(['localhost']);
  });
  it('toRegistrableBaseDomain + aliasHostsOf', () => {
    expect(toRegistrableBaseDomain('marketing-hub.flamingo.so')).toBe('flamingo.so');
    expect(toRegistrableBaseDomain('localhost')).toBeUndefined();
    expect(aliasHostsOf('flamingo-teaser')).toEqual(['flamingo.cx', 'www.flamingo.cx']);
    expect(aliasHostsOf('openmsp')).toEqual([]);
  });
});

describe('env override path', () => {
  // ENV_OVERRIDES captures `process.env.NEXT_PUBLIC_*` at MODULE LOAD — required so the
  // values are build-inlined (literal keys) in the browser bundle. So an override must be
  // set BEFORE the module evaluates: stub env → resetModules → dynamic import.
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it('an override wins over the default (per-distinct-var, no cross-contamination)', async () => {
    vi.stubEnv('NEXT_PUBLIC_TMCG_URL', 'https://sentinel-tmcg.example');
    vi.resetModules();
    const mod = await import('@/platform-domains');
    expect(mod.getPlatformProductionUrl('tmcg')).toBe('https://sentinel-tmcg.example');
    // a non-sharing key is unaffected
    expect(mod.getPlatformProductionUrl('openmsp')).toBe('https://www.openmsp.ai');
  });
  it('the shared NEXT_PUBLIC_FLAMINGO_URL drives all three of its keys', async () => {
    vi.stubEnv('NEXT_PUBLIC_FLAMINGO_URL', 'https://sentinel-flamingo.example');
    vi.resetModules();
    const mod = await import('@/platform-domains');
    for (const k of ['flamingo', 'flamingo-teaser', 'universal']) {
      expect(mod.getPlatformProductionUrl(k)).toBe('https://sentinel-flamingo.example');
    }
  });
  it('normalizes a SCHEME-LESS override to https:// (Vercel stores bare hosts)', async () => {
    vi.stubEnv('NEXT_PUBLIC_OPENMSP_URL', 'www.openmsp.ai'); // no scheme, as in the shared-env store
    vi.stubEnv('NEXT_PUBLIC_OPENFRAME_URL', 'hub.openframe.ai');
    vi.resetModules();
    const mod = await import('@/platform-domains');
    expect(mod.getPlatformProductionUrl('openmsp')).toBe('https://www.openmsp.ai');
    expect(mod.getPlatformProductionUrl('openframe')).toBe('https://hub.openframe.ai');
  });
  it('a scheme-less override still parses for hostOf + cookie-base derivation', async () => {
    vi.stubEnv('NEXT_PUBLIC_OPENMSP_URL', 'www.openmsp.ai');
    vi.resetModules();
    const mod = await import('@/platform-domains');
    // the whole point: hostOf no longer returns null on the (normalized) override
    const host = mod.hostOf(mod.getPlatformProductionUrl('openmsp'));
    if (host === null) {
      throw new Error('hostOf() returned null for the scheme-less override — the regression this test pins');
    }
    expect(host).toBe('www.openmsp.ai');
    expect(mod.toRegistrableBaseDomain(host)).toBe('openmsp.ai');
  });
});

describe('getPlatformUrl — the one platform-URL resolver', () => {
  it('is the registry URL in a production build, with no trailing slash', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(getPlatformUrl('flamingo')).toBe('https://www.flamingo.run');
    expect(getPlatformUrl('openframe')).toBe(getPlatformProductionUrl('openframe').replace(/\/+$/, ''));
  });

  it("never reads Vercel's first-listed domain", () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'flamingo.cx');
    expect(getPlatformUrl('flamingo')).toBe('https://www.flamingo.run');
  });

  it('is the local dev URL outside a production build, unless production is asked for', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_DEV_URL', '');
    expect(getPlatformUrl('openmsp')).toBe('http://localhost:3000');
    expect(getPlatformUrl('openmsp', { environment: 'production' })).toBe('https://www.openmsp.ai');
    vi.stubEnv('NEXT_PUBLIC_DEV_URL', 'https://my-tunnel.example/');
    expect(getPlatformUrl('openmsp')).toBe('https://my-tunnel.example');
  });
});

describe('getDeploymentUrl — the one app-origin resolver', () => {
  // Server-side cases: jsdom defines `window`, which is the browser branch.
  const onServer = () => vi.stubGlobal('window', undefined);

  it("is a Vercel preview's own immutable URL", () => {
    onServer();
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_URL', 'flamingo-abc123-flamingocx.vercel.app');
    expect(getDeploymentUrl({ platform: 'flamingo' })).toBe('https://flamingo-abc123-flamingocx.vercel.app');
  });

  it("is the platform's registry URL in production, whatever Vercel's first domain is", () => {
    onServer();
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'flamingo.cx');
    expect(getDeploymentUrl({ platform: 'flamingo' })).toBe('https://www.flamingo.run');
  });

  it('uses a runtime-configured app URL (a self-hosted install) over every default', () => {
    onServer();
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(getDeploymentUrl({ platform: 'openframe-dashboard', configuredUrl: 'frame.acme-msp.example/' })).toBe(
      'https://frame.acme-msp.example',
    );
    expect(getDeploymentUrl({ platform: 'openframe-dashboard', configuredUrl: '  ' })).toBe(
      getPlatformUrl('openframe-dashboard', { environment: 'production' }),
    );
  });

  it('is localhost on the running port in development', () => {
    onServer();
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_DEV_URL', '');
    vi.stubEnv('PORT', '4000');
    expect(getDeploymentUrl({ platform: 'openframe-dashboard' })).toBe('http://localhost:4000');
  });

  it("is the page's origin in the browser", () => {
    vi.stubGlobal('window', { location: { origin: 'https://tenant.openframe.ai' } });
    expect(getDeploymentUrl({ platform: 'openframe-dashboard', configuredUrl: 'https://ignored.example' })).toBe(
      'https://tenant.openframe.ai',
    );
  });
});

describe('getRequestOrigin / isLocalUrl / resolveRedirectTarget', () => {
  const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });

  it('reads the host the request arrived on, https unless local, ignoring x-forwarded-host, else the app origin', () => {
    expect(getRequestOrigin(headers({ host: 'www.flamingo.run' }), { platform: 'flamingo' })).toBe(
      'https://www.flamingo.run',
    );
    expect(getRequestOrigin(headers({ host: 'localhost:3000' }), { platform: 'flamingo' })).toBe(
      'http://localhost:3000',
    );
    expect(getRequestOrigin(headers({ host: '[::1]:3000' }), { platform: 'flamingo' })).toBe('http://[::1]:3000');
    expect(
      getRequestOrigin(headers({ host: 'x.vercel.app', 'x-forwarded-proto': 'https' }), { platform: 'flamingo' }),
    ).toBe('https://x.vercel.app');
    expect(
      getRequestOrigin(headers({ host: 'www.flamingo.run', 'x-forwarded-host': 'evil.example' }), {
        platform: 'flamingo',
      }),
    ).toBe('https://www.flamingo.run');
    vi.stubGlobal('window', undefined);
    vi.stubEnv('NEXT_PUBLIC_DEV_URL', 'http://localhost:4000');
    expect(getRequestOrigin(headers({}), { platform: 'flamingo' })).toBe('http://localhost:4000');
  });

  it.each([
    ['http://localhost:3000', true],
    ['http://127.0.0.1:3000/x', true],
    ['http://0.0.0.0', true],
    ['http://[::1]:3000', true],
    ['https://www.flamingo.run', false],
    ['https://localhost.example.com', false],
    ['http://127.evil.example', false],
    ['not a url', false],
  ])('isLocalUrl(%s) → %s', (url, local) => expect(isLocalUrl(url)).toBe(local));

  it('resolves same-origin paths and passes explicit absolute URLs through', () => {
    const origin = 'https://flamingo-abc123-flamingocx.vercel.app';
    expect(resolveRedirectTarget(origin, '/admin/x?y=1').href).toBe(`${origin}/admin/x?y=1`);
    expect(resolveRedirectTarget(origin, 'auth/callback-client').href).toBe(`${origin}/auth/callback-client`);
    expect(resolveRedirectTarget(origin, 'https://www.flamingo.run/blog').href).toBe('https://www.flamingo.run/blog');
  });

  it.each(['//evil.example/path', '/\\evil.example/path', '\\\\evil.example', '\\/evil.example'])(
    'refuses %s, which would leave the origin',
    target => {
      expect(() => resolveRedirectTarget('https://www.flamingo.run', target)).toThrow('is not a same-origin path');
    },
  );
});

describe('registry integrity', () => {
  it('byKey resolves every key and openframe-dashboard is pseudo', () => {
    expect(byKey('openframe-dashboard')?.pseudo).toBe(true);
    expect(byKey('not-a-platform')).toBeUndefined();
  });
});

describe('ensureScheme', () => {
  it("adds https:// to a bare host, leaves a scheme'd URL untouched", () => {
    expect(ensureScheme('www.openmsp.ai')).toBe('https://www.openmsp.ai');
    expect(ensureScheme('https://www.openmsp.ai')).toBe('https://www.openmsp.ai');
    expect(ensureScheme('http://localhost:3000')).toBe('http://localhost:3000');
  });
  it('normalizes a protocol-relative //host (NOT https:////host → empty-host drop)', () => {
    expect(ensureScheme('//hub.openframe.ai')).toBe('https://hub.openframe.ai');
    expect(hostOf(ensureScheme('//hub.openframe.ai'))).toBe('hub.openframe.ai');
  });
});

describe('cookie-domain guard + match (shared SSOT primitives)', () => {
  it('isNonCookieableHost flags localhost / private IPs / *.vercel.app, not real hosts', () => {
    for (const h of ['localhost', '127.0.0.1', '127.5.5.5', '192.168.1.2', '10.0.0.1', 'x.vercel.app']) {
      expect(isNonCookieableHost(h)).toBe(true);
    }
    for (const h of ['www.openmsp.ai', 'marketing-hub.flamingo.so', 'hub.openframe.ai']) {
      expect(isNonCookieableHost(h)).toBe(false);
    }
  });
  it('matchCookieDomain returns the dotted base for a contained host (incl. apex), else undefined', () => {
    const bases = ['.flamingo.so', '.openmsp.ai'];
    expect(matchCookieDomain('marketing-hub.flamingo.so', bases)).toBe('.flamingo.so');
    expect(matchCookieDomain('flamingo.so', bases)).toBe('.flamingo.so');
    expect(matchCookieDomain('app.openmsp.ai', bases)).toBe('.openmsp.ai');
    expect(matchCookieDomain('evil.com', bases)).toBeUndefined();
  });
  it('matchCookieDomain accepts dotless bases and still returns the dotted form', () => {
    expect(matchCookieDomain('foo.tmcg.miami', ['tmcg.miami'])).toBe('.tmcg.miami');
  });
});
