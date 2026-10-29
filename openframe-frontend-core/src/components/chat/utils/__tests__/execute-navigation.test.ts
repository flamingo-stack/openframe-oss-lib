import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatRuntime } from '../../../../contexts/chat-runtime-context';
import { stripSameOriginToPath } from '../chat-nav-resolution';
import { decideNewTab } from '../decide-new-tab';
import { executeNavigation } from '../execute-navigation';

/**
 * The click path had no tests, which is why every host bug it produced was
 * answered with another defensive layer instead of a case here. These pin the
 * two decisions a click makes — WHICH TAB, and WHO PERFORMS IT.
 */

/** jsdom's own origin — the strip is a comparison against it, so it must be real. */
const ORIGIN = new URL(window.location.href).origin;

function runtimeWith(navigation: Partial<ChatRuntime['navigation']> = {}): ChatRuntime {
  return {
    endpoints: { chatStreamUrl: `${ORIGIN}/chat` },
    navigation: { mode: 'host', ...navigation },
    source: 'openframe',
  } as ChatRuntime;
}

function primaryClick() {
  return { preventDefault: vi.fn(), button: 0 };
}

beforeEach(() => {
  window.history.replaceState(null, '', '/dashboard');
});

describe('stripSameOriginToPath', () => {
  it('reduces a same-origin absolute URL to a router-pushable path', () => {
    expect(stripSameOriginToPath(`${ORIGIN}/help-center/guides?slug=a#top`)).toBe('/help-center/guides?slug=a#top');
  });

  it('strips a CROSS-origin URL too — the caller owns that decision', () => {
    // Deliberate: the hub is one app across several origins and relies on this to
    // keep an absolute in-app href on the host it is running (preview, localhost).
    // The "is this foreign?" question belongs to `runNavigation`, tested below.
    expect(stripSameOriginToPath('https://www.flamingo.run/webinars/x')).toBe('/webinars/x');
  });

  it('passes relative hrefs through untouched', () => {
    expect(stripSameOriginToPath('/devices/details?id=1')).toBe('/devices/details?id=1');
  });
});

describe('decideNewTab', () => {
  it('keeps a relative href in the same tab', () => {
    expect(decideNewTab({ href: '/help-center/guides', currentSource: 'openframe' })).toBe(false);
  });

  it('sends a cross-origin href to a new tab', () => {
    expect(decideNewTab({ href: 'https://www.flamingo.run/blog/x', currentSource: 'openframe' })).toBe(true);
  });

  it('lets a matching targetPlatform beat the origin compare — same tab, cross-origin', () => {
    // The trap openframe hit: the RAG tags every row `openframe`, so a hub URL
    // matched `source` and went same-tab. Pinned because it is surprising, and
    // because hosts that do NOT host that content must pass `targetPlatform: null`.
    expect(
      decideNewTab({
        href: 'https://www.flamingo.run/webinars/x',
        targetPlatform: 'openframe',
        currentSource: 'openframe',
      }),
    ).toBe(false);
  });

  it('forces a new tab in embed mode regardless of origin', () => {
    expect(decideNewTab({ href: '/anything', currentSource: 'openframe', runtimeMode: 'embed' })).toBe(true);
  });
});

describe('executeNavigation', () => {
  // The browser's own navigation, for a target no host navigation takes. jsdom's `location` cannot be spied on in
  // place, so it is swapped for one that reads the same and records `assign`.
  let assign: ReturnType<typeof vi.fn>;
  let realLocation: Location;
  beforeEach(() => {
    realLocation = window.location;
    assign = vi.fn();
    const { href, origin, pathname, search, hash } = realLocation;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href, origin, pathname, search, hash, assign },
    });
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  });

  it('hands a same-tab click to the host navigate callback', () => {
    const navigate = vi.fn().mockReturnValue(true);
    const event = primaryClick();

    const handled = executeNavigation({ event, runtime: runtimeWith({ navigate }), href: '/help-center/guides' });

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ href: '/help-center/guides' }));
    expect(assign).not.toHaveBeenCalled();
  });

  it('lets the browser open a target the host does not take', () => {
    executeNavigation({
      event: primaryClick(),
      runtime: runtimeWith({ navigate: () => false }),
      href: '/help-center/guides',
    });

    expect(assign).toHaveBeenCalledWith('/help-center/guides');
  });

  it('opens an absolute SAME-origin href in a new tab', () => {
    // Not a defect: `isCrossOriginUrl` is textual on purpose (SSR-deterministic,
    // see its tests), so "in-app links stay relative" is a real host obligation.
    // Pinned because hosts keep rediscovering it by absolutizing an in-app href
    // and getting a redundant new tab.
    const openExternal = vi.fn();

    executeNavigation({
      event: primaryClick(),
      runtime: runtimeWith({ openExternal }),
      href: `${ORIGIN}/help-center/guides`,
    });

    expect(openExternal).toHaveBeenCalledWith(`${ORIGIN}/help-center/guides`);
    expect(assign).not.toHaveBeenCalled();
  });

  it('still strips an absolute SAME-origin href down to a path', () => {
    // The hub's case: one app, several origins, absolute in-app href routed same-tab.
    executeNavigation({
      event: primaryClick(),
      runtime: runtimeWith({ navigate: () => false, decideNewTab: () => false }),
      href: `${ORIGIN}/releases/v1?x=1#top`,
    });

    expect(assign).toHaveBeenCalledWith('/releases/v1?x=1#top');
  });

  it('opens a cross-origin href WHOLE', () => {
    // Regression: it used to arrive origin-stripped and 404 locally.
    executeNavigation({
      event: primaryClick(),
      runtime: runtimeWith({ navigate: () => false, decideNewTab: () => false }),
      href: 'https://www.flamingo.run/webinars/x',
    });

    expect(assign).toHaveBeenCalledWith('https://www.flamingo.run/webinars/x');
  });

  it('routes a new-tab decision through openExternal', () => {
    const openExternal = vi.fn();

    executeNavigation({
      event: primaryClick(),
      runtime: runtimeWith({ openExternal, decideNewTab: () => true }),
      href: 'https://www.flamingo.run/blog/x',
    });

    expect(openExternal).toHaveBeenCalledWith('https://www.flamingo.run/blog/x');
    expect(assign).not.toHaveBeenCalled();
  });

  it('leaves modifier clicks to the browser', () => {
    const navigate = vi.fn();
    const event = { preventDefault: vi.fn(), button: 0, metaKey: true };

    const handled = executeNavigation({ event, runtime: runtimeWith({ navigate }), href: '/x' });

    expect(handled).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports an empty href as handled without navigating anywhere', () => {
    const navigate = vi.fn();
    const event = primaryClick();

    expect(executeNavigation({ event, runtime: runtimeWith({ navigate }), href: '' })).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
