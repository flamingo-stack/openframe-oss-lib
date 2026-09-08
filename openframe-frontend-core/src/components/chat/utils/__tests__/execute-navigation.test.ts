import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  it('hands a same-tab click to the host navigate callback', () => {
    const navigate = vi.fn().mockReturnValue(true);
    const fallbackNavigate = vi.fn();
    const event = primaryClick();

    const handled = executeNavigation({
      event,
      runtime: runtimeWith({ navigate }),
      href: '/help-center/guides',
      fallbackNavigate,
    });

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ href: '/help-center/guides' }));
    expect(fallbackNavigate).not.toHaveBeenCalled();
  });

  it('falls back to the host router when navigate declines', () => {
    const fallbackNavigate = vi.fn();

    executeNavigation({
      event: primaryClick(),
      runtime: runtimeWith({ navigate: () => false }),
      href: '/help-center/guides',
      fallbackNavigate,
    });

    expect(fallbackNavigate).toHaveBeenCalledWith('/help-center/guides');
  });

  it('opens an absolute SAME-origin href in a new tab', () => {
    // Not a defect: `isCrossOriginUrl` is textual on purpose (SSR-deterministic,
    // see its tests), so "in-app links stay relative" is a real host obligation.
    // Pinned because hosts keep rediscovering it by absolutizing an in-app href
    // and getting a redundant new tab.
    const openExternal = vi.fn();
    const fallbackNavigate = vi.fn();

    executeNavigation({
      event: primaryClick(),
      runtime: runtimeWith({ openExternal }),
      href: `${ORIGIN}/help-center/guides`,
      fallbackNavigate,
    });

    expect(openExternal).toHaveBeenCalledWith(`${ORIGIN}/help-center/guides`);
    expect(fallbackNavigate).not.toHaveBeenCalled();
  });

  it('still strips an absolute SAME-origin href down to a path', () => {
    // The hub's soft-RSC-nav case: one app, several origins, absolute in-app
    // href routed same-tab. It must stay a soft nav, not a full page load.
    const fallbackNavigate = vi.fn();

    executeNavigation({
      event: primaryClick(),
      runtime: runtimeWith({ navigate: () => false, decideNewTab: () => false }),
      href: `${ORIGIN}/releases/v1?x=1#top`,
      fallbackNavigate,
    });

    expect(fallbackNavigate).toHaveBeenCalledWith('/releases/v1?x=1#top');
  });

  it('passes a cross-origin href to the router WHOLE', () => {
    // Regression: it used to arrive origin-stripped and 404 locally.
    const fallbackNavigate = vi.fn();

    executeNavigation({
      event: primaryClick(),
      runtime: runtimeWith({ navigate: () => false, decideNewTab: () => false }),
      href: 'https://www.flamingo.run/webinars/x',
      fallbackNavigate,
    });

    expect(fallbackNavigate).toHaveBeenCalledWith('https://www.flamingo.run/webinars/x');
  });

  it('routes a new-tab decision through openExternal', () => {
    const openExternal = vi.fn();
    const fallbackNavigate = vi.fn();

    executeNavigation({
      event: primaryClick(),
      runtime: runtimeWith({ openExternal, decideNewTab: () => true }),
      href: 'https://www.flamingo.run/blog/x',
      fallbackNavigate,
    });

    expect(openExternal).toHaveBeenCalledWith('https://www.flamingo.run/blog/x');
    expect(fallbackNavigate).not.toHaveBeenCalled();
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
    const fallbackNavigate = vi.fn();
    const event = primaryClick();

    expect(executeNavigation({ event, runtime: runtimeWith(), href: '', fallbackNavigate })).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(fallbackNavigate).not.toHaveBeenCalled();
  });
});
