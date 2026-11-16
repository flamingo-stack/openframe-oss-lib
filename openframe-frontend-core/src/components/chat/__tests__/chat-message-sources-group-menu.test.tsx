/**
 * A table's source chip ("Onboarding Guides (2 records)") opens its rows in the shared `DropdownMenu`, portalled out of
 * the thread: drawn inside the thread, the list faded with the thread's end and sat under the composer dock, so its last
 * rows could not be picked.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../../chat-protocol/chat-message';
import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
import { ChatMessageSources } from '../chat-message-sources';

const runtime: ChatRuntime = {
  endpoints: {
    chatStreamUrl: '/api/docs/chat',
    commandsUrl: '/api/docs/commands',
    buildListUrl: () => null,
    attachmentUploadUrl: '/api/storage/generate-upload-url',
    attachmentViewUrlPrefix: '/api/storage/view/chat-attachments/',
    identityUrl: '/api/chat/identity',
  },
  navigation: { mode: 'host' },
};

const ANSWER: ChatMessage = {
  id: 'm-2',
  role: 'assistant',
  parts: [
    {
      type: 'source-url',
      sourceId: 'record://onboarding_guide/g-1',
      url: 'https://example.test/g-1',
      title: 'Install on Windows',
    },
    {
      type: 'source-url',
      sourceId: 'record://onboarding_guide/g-2',
      url: 'https://example.test/g-2',
      title: 'Install on macOS',
    },
    { type: 'text', text: 'Install the agent.' },
  ],
};

function renderAnswer() {
  return render(
    <ChatRuntimeContext.Provider value={runtime}>
      <div data-testid="thread">
        <ChatMessageSources message={ANSWER} onDiscuss={() => {}} />
      </div>
    </ChatRuntimeContext.Provider>,
  );
}

/** Radix opens a menu on the pointer going down (jsdom's click carries no pointer). */
function openMenu(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
}

describe('ChatMessageSources - a table`s chip', () => {
  it('opens its rows in a portalled menu, each row a link with its Ask', async () => {
    renderAnswer();
    const chip = screen.getByRole('button', { name: /Onboarding Guides/ });
    expect(chip).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    openMenu(chip);
    const menu = await screen.findByRole('menu');
    // Portalled: the menu is not inside the thread it was opened from.
    expect(within(screen.getByTestId('thread')).queryByRole('menu')).toBeNull();
    // `hidden`: jsdom lays nothing out, so Radix reads the chip as scrolled out of the thread (`hideWhenDetached`)
    // and hides the rows from the accessibility tree; a browser shows them.
    const items = within(menu).getAllByRole('menuitem', { hidden: true });
    const links = items.filter(item => item.tagName === 'A');
    expect(links.map(link => link.textContent)).toEqual([
      expect.stringContaining('Windows'),
      expect.stringContaining('macOS'),
    ]);
    expect(links.map(link => link.getAttribute('href'))).toEqual([
      'https://example.test/g-1',
      'https://example.test/g-2',
    ]);
    expect(within(menu).getAllByTestId('source-group-row')).toHaveLength(2);
    expect(items.filter(item => item.getAttribute('aria-label')?.startsWith('Ask Mingo:'))).toHaveLength(2);
    // The rows' icons keep the chip's 14px, over the menu item's own 16px.
    expect(links[0].className).toContain('[&_svg]:size-3.5');
    expect(links[0].className).not.toContain('[&_svg]:size-4');
  });

  it('closes on Escape', async () => {
    renderAnswer();
    openMenu(screen.getByRole('button', { name: /Onboarding Guides/ }));
    const menu = await screen.findByRole('menu');
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
