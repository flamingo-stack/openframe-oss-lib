/**
 * A record's chip and its card offer the SAME actions (`recordMenuGroups`): Ask Mingo, Open Details with its new-tab
 * button, and Open in ClickUp for a task. Driven through the real chat message, the real card loader and the real
 * menu, so a row missing on either side fails here.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
import { ChatMessageEnhanced } from '../chat-message-enhanced';
import type { ChatRef } from '../chat-ref.types';
import { recordMenuGroups, renderChatInlineEntityCard } from '../entity-cards/dispatch';
import { RecordActionsProvider, RecordChipActions, useRecordChipMenu } from '../record-actions';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const makeRuntime = (opensTabs?: boolean) =>
  ({
    endpoints: { chatStreamUrl: '/chat', buildListUrl: (type: string, ids: string[]) => `/api/${type}?ids=${ids}` },
    navigation: {
      mode: 'host',
      navigate: vi.fn().mockReturnValue(true),
      ...(opensTabs === undefined ? {} : { opensTabs }),
    },
    source: 'flamingo',
    composeContentUrl: ({ id }: { id?: string | null }) => ({ href: `/roadmap#${id}` }),
  }) as unknown as ChatRuntime;

const runtime = makeRuntime();

function NavLinkAnchor({ href, children }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={href}>{children}</a>;
}

function inChat(node: React.ReactNode, onDiscuss: (ref: ChatRef) => void, chatRuntime: ChatRuntime = runtime) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChatRuntimeContext.Provider value={chatRuntime}>
        <RecordActionsProvider value={{ onDiscuss }}>{node}</RecordActionsProvider>
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>
  );
}

/** Opens a "⋯" menu by its button's name and returns the rows' names. */
async function menuRows(name: string | RegExp): Promise<string[]> {
  const trigger = await screen.findByRole('button', { name });
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
  const menu = await screen.findByRole('menu');
  // A row that runs something is a menu item; a row that opens a page is its link (its ↗ button is not a row).
  return [...menu.querySelectorAll('[role="menuitem"], a')]
    .filter(row => row.getAttribute('aria-label') !== 'Open in new tab')
    .map(row => row.textContent?.trim() ?? '');
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ items: [{ id: '86ad3qvv5', title: 'Patch policies', status: 'working' }] })),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("recordMenuGroups: one list of a record's actions", () => {
  const rows = (ref: Pick<ChatRef, 'type' | 'id' | 'url'>, newTab = true) =>
    recordMenuGroups(ref, { discuss: { label: 'Ask Mingo', icon: null, run: () => {} }, newTab })?.[0]?.items ?? [];

  it('a roadmap item: Ask, its page with the new-tab button, and the task in ClickUp', () => {
    const items = rows({ type: 'roadmap_item', id: '86ad3qvv5', url: '/roadmap#86ad3qvv5' });
    expect(items.map(item => item.label)).toEqual(['Ask Mingo', 'Open Details', 'Open in ClickUp']);
    expect(items[1]).toMatchObject({ href: '/roadmap#86ad3qvv5', iconAction: { 'aria-label': 'Open in new tab' } });
    expect(items[2]).toMatchObject({ href: expect.stringContaining('86ad3qvv5'), openInNewTab: true });
  });

  it('an internal task opens in ClickUp itself: one ClickUp row, not two', () => {
    const items = rows({ type: 'internal_task', id: 'abc', url: 'https://app.clickup.com/t/abc' });
    expect(items.map(item => item.label)).toEqual(['Ask Mingo', 'Open in ClickUp']);
  });

  it('a ticket reads in its own terms, and a window with no tabs gets no new-tab button', () => {
    const items = rows({ type: 'hubspot_ticket', id: '9', url: '/tickets/9' }, false);
    expect(items.map(item => item.label)).toEqual(['Ask Mingo', 'Open Ticket Details']);
    expect(items[1]).not.toHaveProperty('iconAction');
  });
});

describe('a chip offers what its card offers', () => {
  it("the lib's chip: the card's rows, and Ask asks about the record", async () => {
    const onDiscuss = vi.fn();
    render(
      inChat(
        <ChatMessageEnhanced
          role="assistant"
          content={[{ type: 'text', text: 'See [Patch policies](record://roadmap_item/86ad3qvv5).' }]}
          renderEntityCard={() => null}
          NavLinkAnchor={NavLinkAnchor}
        />,
        onDiscuss,
      ),
    );
    expect(await menuRows('Actions for Patch policies')).toEqual(['Ask Mingo', 'Open Details', 'Open in ClickUp']);
    fireEvent.click(screen.getByRole('menuitem', { name: /Ask Mingo/ }));
    expect(onDiscuss).toHaveBeenCalledWith(expect.objectContaining({ type: 'roadmap_item', id: '86ad3qvv5' }));
  });

  it("the record's card: the same rows", async () => {
    render(
      inChat(
        renderChatInlineEntityCard(
          { type: 'roadmap_item', id: '86ad3qvv5', title: '', url: null },
          {
            onDiscuss: vi.fn(),
          },
        ),
        vi.fn(),
      ),
    );
    expect(await menuRows('Roadmap actions')).toEqual(['Ask Mingo', 'Open Details', 'Open in ClickUp']);
  });

  it("a host's chip reads the same menu for the record its link names", async () => {
    const onDiscuss = vi.fn();
    function HostChip({ label }: { label: string }) {
      const menuGroups = useRecordChipMenu({ href: '/devices/m-1' });
      const chip = <a href="/devices/m-1">{label}</a>;
      return menuGroups ? (
        <RecordChipActions menuGroups={menuGroups} label={label}>
          {chip}
        </RecordChipActions>
      ) : (
        chip
      );
    }
    render(
      inChat(
        <ChatMessageEnhanced
          role="assistant"
          content={[{ type: 'text', text: 'Restart [MacBook](record://device/m-1).' }]}
          renderEntityCard={() => null}
          renderRecordChip={({ label }) => <HostChip label={label} />}
          NavLinkAnchor={NavLinkAnchor}
        />,
        onDiscuss,
      ),
    );
    expect(await menuRows('Actions for MacBook')).toEqual(['Ask Mingo', 'Open Details']);
    fireEvent.click(screen.getByRole('menuitem', { name: /Ask Mingo/ }));
    expect(onDiscuss).toHaveBeenCalledWith(expect.objectContaining({ type: 'device', id: 'm-1', title: 'MacBook' }));
  });

  it('a window that opens no tabs: neither the card nor the chip offers a new tab', async () => {
    const noTabs = makeRuntime(false);
    const { unmount } = render(
      inChat(
        <ChatMessageEnhanced
          role="assistant"
          content={[{ type: 'text', text: 'See [Patch policies](record://roadmap_item/86ad3qvv5).' }]}
          renderEntityCard={() => null}
          NavLinkAnchor={NavLinkAnchor}
        />,
        vi.fn(),
        noTabs,
      ),
    );
    expect(await menuRows('Actions for Patch policies')).toEqual(['Ask Mingo', 'Open Details', 'Open in ClickUp']);
    expect(screen.queryByRole('link', { name: 'Open in new tab' })).toBeNull();
    unmount();
    render(
      inChat(
        renderChatInlineEntityCard(
          { type: 'roadmap_item', id: '86ad3qvv5', title: '', url: null },
          { onDiscuss: vi.fn() },
        ),
        vi.fn(),
        noTabs,
      ),
    );
    expect(await menuRows('Roadmap actions')).toEqual(['Ask Mingo', 'Open Details', 'Open in ClickUp']);
    expect(screen.queryByRole('link', { name: 'Open in new tab' })).toBeNull();
  });
});
