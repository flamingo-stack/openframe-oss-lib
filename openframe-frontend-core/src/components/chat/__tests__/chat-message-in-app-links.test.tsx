/**
 * REGRESSION: an app-screen link in a chat answer must open IN the app.
 *
 * The hub writes the screens of the app the chat is embedded in as
 * ROOT-RELATIVE markdown links (`[Devices](/devices)`). A host-mode runtime
 * (the OpenFrame app) must open each one in the same tab through its own
 * `navigate` — a router push, no reload, no second tab.
 *
 * The same link written ABSOLUTE, even to the page's own origin, opens a new
 * tab: the new-tab rule is textual (`isCrossOriginUrl`), which is why the hub
 * writes these links relative. The contrast case pins that, so a change on
 * either side of the contract shows up here.
 *
 * This drives the real bubble, the real markdown engine and the real anchor
 * (`NavLinkAnchorViaRuntime`), with the runtime wired the way the OpenFrame
 * app wires it (`navigate` router-pushes a same-origin href; `decideNewTab`
 * is the lib rule with no target platform).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
import { ChatMessageEnhanced } from '../chat-message-enhanced';
import { NavLinkAnchorViaRuntime } from '../nav-link-anchor-via-runtime';
import { stripSameOriginToPath } from '../utils/chat-nav-resolution';
import { decideNewTab } from '../utils/decide-new-tab';
import { isCrossOriginUrl } from '../utils/is-cross-origin-url';

const routerPush = vi.fn<(path: string) => void>();

vi.mock('../../../embed-shims/next-navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ back: vi.fn(), prefetch: vi.fn(), push: routerPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/** jsdom's own origin — `location.origin` is undefined there, `location.href` is not. */
const ORIGIN = new URL(window.location.href).origin;

const ANSWER = [
  'Get the install command from [Devices → Add Device](/devices/new): pick the customer and the platform.',
  '',
  'Then go to [Devices](/devices) and check the **Status** column. For a searchable log of all activity, use [Logs](/logs-page).',
].join('\n');

const openExternal = vi.fn<(href: string) => void>();
const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);

const runtime = {
  endpoints: { chatStreamUrl: '/content/api/docs/chat' },
  navigation: {
    decideNewTab: ({ href }: { href: string }) =>
      decideNewTab({ currentSource: 'openframe', href, targetPlatform: null }),
    mode: 'host',
    navigate: ({ href }: { href: string }) => {
      if (isCrossOriginUrl(href)) return false;
      routerPush(stripSameOriginToPath(href));
      return true;
    },
    openExternal,
  },
  source: 'openframe',
} as unknown as ChatRuntime;

function renderAnswer(text: string) {
  return render(
    <ChatRuntimeContext.Provider value={runtime}>
      <ChatMessageEnhanced
        NavLinkAnchor={NavLinkAnchorViaRuntime}
        content={[{ text, type: 'text' }]}
        renderEntityCard={() => null}
        role="assistant"
      />
    </ChatRuntimeContext.Provider>,
  );
}

beforeEach(() => {
  routerPush.mockClear();
  openExternal.mockClear();
  windowOpen.mockClear();
});

describe('ChatMessageEnhanced — in-app screen links', () => {
  it('opens every root-relative screen link in the same tab through the host router', () => {
    renderAnswer(ANSWER);
    const anchors = screen.getAllByRole('link');

    expect(anchors.map(a => [a.textContent, a.getAttribute('href'), a.getAttribute('target')])).toEqual([
      ['Devices → Add Device', '/devices/new', null],
      ['Devices', '/devices', null],
      ['Logs', '/logs-page', null],
    ]);

    for (const anchor of anchors) fireEvent.click(anchor, { button: 0 });

    expect(routerPush.mock.calls.map(call => call[0])).toEqual(['/devices/new', '/devices', '/logs-page']);
    expect(openExternal).not.toHaveBeenCalled();
    expect(windowOpen).not.toHaveBeenCalled();
  });

  it('opens the same link written absolute in a new tab, even on the page origin', () => {
    renderAnswer(ANSWER.replace(/\]\(\//g, `](${ORIGIN}/`));
    const anchor = screen.getByRole('link', { name: 'Devices → Add Device' });

    expect(anchor.getAttribute('href')).toBe(`${ORIGIN}/devices/new`);
    expect(anchor.getAttribute('target')).toBe('_blank');

    fireEvent.click(anchor, { button: 0 });

    expect(openExternal).toHaveBeenCalledWith(`${ORIGIN}/devices/new`);
    expect(routerPush).not.toHaveBeenCalled();
  });
});
