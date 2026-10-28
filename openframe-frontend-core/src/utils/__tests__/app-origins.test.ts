import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  absoluteHttpUrl,
  isAppOriginUrl,
  readAppOrigins,
  SERVER_APP_ORIGINS,
  subscribeAppOrigins,
  type AppOrigins,
} from '../app-origins';
import { setEmbedAuthAdapter } from '../embed-authed-fetch';

/** jsdom's page is `http://localhost:3000/`. */

/**
 * `isAppOriginUrl` is the line untrusted markdown's media may not cross (see
 * `rehypeStripUnsafe`). Unlike `needsBearerAssetFetch` it does not care how the
 * host authenticates: it answers whether the URL is the app's at all.
 */
describe('isAppOriginUrl (where untrusted markdown may load media from)', () => {
  afterEach(() => {
    setEmbedAuthAdapter(null);
  });

  it('accepts relative and same-origin URLs', () => {
    expect(isAppOriginUrl('/api/knowledge-base/images/1')).toBe(true);
    expect(isAppOriginUrl('pic.png')).toBe(true);
    expect(isAppOriginUrl('http://localhost:3000/content/api/x.png')).toBe(true);
  });

  it('rejects a third-party origin, including the spellings that resolve to one', () => {
    expect(isAppOriginUrl('https://attacker.example/log?d=secret')).toBe(false);
    expect(isAppOriginUrl('//attacker.example/x.png')).toBe(false);
    expect(isAppOriginUrl('/\\attacker.example/x.png')).toBe(false);
    expect(isAppOriginUrl('/\t/attacker.example/x.png')).toBe(false);
    expect(isAppOriginUrl('http://localhost:3001/x.png')).toBe(false);
  });

  it('rejects data:, javascript: and blob: URLs', () => {
    expect(isAppOriginUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(isAppOriginUrl('javascript:alert(1)')).toBe(false);
    expect(isAppOriginUrl('blob:http://localhost:3000/abc')).toBe(false);
  });

  it('accepts the gateway the adapter sanctions, in cookie mode too', () => {
    setEmbedAuthAdapter({ getHeaders: () => ({}), allowedOrigins: ['https://gateway.example'] });
    expect(isAppOriginUrl('https://gateway.example/api/knowledge-base/images/1')).toBe(true);
    expect(isAppOriginUrl('https://cdn.example.com/pic.png')).toBe(false);
  });
});

/**
 * The native shells serve the page from a local pseudo-origin and reach the tenant through a gateway the host lists in
 * `allowedOrigins` (OpenFrame's chat runtime provider does, in bearer mode). Decided against an explicit snapshot,
 * the way the markdown engine passes one, since jsdom's own page cannot be moved to another scheme.
 */
describe('isAppOriginUrl inside the native shells', () => {
  const GATEWAY = 'https://acme.openframe.ai';
  const SHELLS: Record<string, AppOrigins> = {
    'iOS / Android (Capacitor)': {
      pageUrl: 'capacitor://localhost/knowledge-base/details/?id=1',
      allowedOrigins: [GATEWAY],
    },
    'macOS / Linux (Tauri)': { pageUrl: 'tauri://localhost/tickets/', allowedOrigins: [GATEWAY] },
    'Windows (Tauri)': { pageUrl: 'http://tauri.localhost/tickets/', allowedOrigins: [GATEWAY] },
  };

  for (const [shell, origins] of Object.entries(SHELLS)) {
    it(`${shell}: the bundle and the gateway are the app, nothing else is`, () => {
      expect(isAppOriginUrl('/assets/logo.svg', origins)).toBe(true);
      expect(isAppOriginUrl('img/logo.svg', origins)).toBe(true);
      expect(isAppOriginUrl(`${GATEWAY}/knowledge-base/images/1`, origins)).toBe(true);
      expect(isAppOriginUrl('https://attacker.example/x.png', origins)).toBe(false);
      expect(isAppOriginUrl('//attacker.example/x.png', origins)).toBe(false);
      expect(isAppOriginUrl('https://acme.openframe.ai.attacker.example/x.png', origins)).toBe(false);
      expect(isAppOriginUrl('http://acme.openframe.ai/x.png', origins)).toBe(false);
    });
  }

  it('Capacitor: another pseudo-host on the same scheme is not the app', () => {
    expect(isAppOriginUrl('capacitor://attacker/x.png', SHELLS['iOS / Android (Capacitor)'])).toBe(false);
  });
});

describe('isAppOriginUrl on the server', () => {
  it('only a relative URL is the app\u2019s: there is no page to compare an absolute one with', () => {
    expect(isAppOriginUrl('/kb/1.png', SERVER_APP_ORIGINS)).toBe(true);
    expect(isAppOriginUrl('http://localhost:3000/kb/1.png', SERVER_APP_ORIGINS)).toBe(false);
    expect(isAppOriginUrl('http://app.invalid/x.png', SERVER_APP_ORIGINS)).toBe(true);
  });
});

describe('isAppOriginUrl edge spellings (jsdom page http://localhost:3000)', () => {
  it('treats host case and a default port as the same origin, scheme and port changes as another', () => {
    expect(isAppOriginUrl('http://LOCALHOST:3000/x.png')).toBe(true);
    expect(isAppOriginUrl('https://localhost:3000/x.png')).toBe(false);
    expect(isAppOriginUrl('http://localhost/x.png')).toBe(false);
    expect(isAppOriginUrl('http://localhost.:3000/x.png')).toBe(false);
    expect(isAppOriginUrl('http://localhost:3000@attacker.example/x.png')).toBe(false);
    expect(isAppOriginUrl('http://[::1]:3000/x.png')).toBe(false);
    expect(isAppOriginUrl('  /x.png  ')).toBe(true);
  });
});

describe('readAppOrigins / subscribeAppOrigins', () => {
  afterEach(() => {
    setEmbedAuthAdapter(null);
  });

  it('returns the same snapshot until the origins change, and reports the change', () => {
    const first = readAppOrigins();
    expect(readAppOrigins()).toBe(first);
    const listener = vi.fn();
    const unsubscribe = subscribeAppOrigins(listener);
    setEmbedAuthAdapter({ allowedOrigins: ['https://gateway.example'] });
    expect(listener).toHaveBeenCalledTimes(1);
    const second = readAppOrigins();
    expect(second).not.toBe(first);
    expect(second.allowedOrigins).toEqual(['https://gateway.example']);
    expect(readAppOrigins()).toBe(second);
    unsubscribe();
    setEmbedAuthAdapter(null);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('readAppOrigins keeps its snapshot across in-page navigation', () => {
  it('returns the same object when only the path, query or hash changes', () => {
    // The test setup mocks `window.location` as a plain object, so the URL is moved by hand.
    const before = readAppOrigins();
    window.location.href = 'http://localhost:3000/tickets/dialog/?id=1&mingoDialog=abc#x';
    try {
      expect(readAppOrigins()).toBe(before);
      window.location.href = 'http://localhost:3001/';
      expect(readAppOrigins()).not.toBe(before);
    } finally {
      window.location.href = 'http://localhost:3000/';
    }
  });
});

describe('absoluteHttpUrl', () => {
  it('resolves against the page and refuses what is not http(s)', () => {
    expect(absoluteHttpUrl('/x.png')).toBe('http://localhost:3000/x.png');
    expect(absoluteHttpUrl('//attacker.example/x.png')).toBe('http://attacker.example/x.png');
    expect(absoluteHttpUrl('javascript:alert(1)')).toBeNull();
    expect(absoluteHttpUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(absoluteHttpUrl('/x.png', SERVER_APP_ORIGINS)).toBe('http://app.invalid/x.png');
  });
});

/**
 * A bundler can inline a module into more than one chunk, each with its own scope (see the adapter registry). A
 * listener subscribed through one copy must still hear a registration made through another.
 */
describe('subscribeAppOrigins across copies of the modules', () => {
  afterEach(() => {
    setEmbedAuthAdapter(null);
  });

  it('tells a listener in another copy, and that copy reads the new origins', async () => {
    vi.resetModules();
    const copy = await import('../app-origins');
    expect(copy.subscribeAppOrigins).not.toBe(subscribeAppOrigins);
    const listener = vi.fn();
    const unsubscribe = copy.subscribeAppOrigins(listener);
    setEmbedAuthAdapter({ allowedOrigins: ['https://gateway.example'] });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(copy.readAppOrigins().allowedOrigins).toEqual(['https://gateway.example']);
    unsubscribe();
  });
});
