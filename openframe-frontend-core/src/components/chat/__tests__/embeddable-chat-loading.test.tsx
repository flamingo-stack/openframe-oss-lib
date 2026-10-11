import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const heard: Array<{ type: string; detail: unknown }> = [];

// The chat, reduced to what its loading relies on: once mounted it listens for
// the open events, then asks for the open that was sent before it was listening.
vi.mock('../embeddable-chat', async () => {
  const { forwardRef, useEffect } = await import('react');
  const { chatListensForAskAiOpens } = await import('../utils/ask-ai-events');
  return {
    EmbeddableChat: forwardRef<unknown, { baseRoute?: string }>(function Chat({ baseRoute }, _ref) {
      useEffect(() => {
        const onOpen = (event: Event) => heard.push({ type: event.type, detail: (event as CustomEvent).detail });
        window.addEventListener('ask-ai:open', onOpen);
        window.addEventListener('ask-ai:open-with-ref', onOpen);
        return () => {
          window.removeEventListener('ask-ai:open', onOpen);
          window.removeEventListener('ask-ai:open-with-ref', onOpen);
        };
      }, []);
      useEffect(() => chatListensForAskAiOpens(), []);
      return <div data-testid="chat">{baseRoute}</div>;
    }),
  };
});

import { EmbeddableChat } from '../index';
import { holdAskAiOpens } from '../utils/ask-ai-events';

describe('EmbeddableChat, loaded on its own', () => {
  beforeEach(() => {
    heard.length = 0;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('is the one chat: the barrel draws the chat itself, with the props it was given', async () => {
    render(<EmbeddableChat baseRoute="/knowledge-base" />);
    expect((await screen.findByTestId('chat')).textContent).toBe('/knowledge-base');
  });

  it('delivers an open that was sent before the chat had loaded', async () => {
    const detail = { source: 'flamingo', prompt: 'How do I start?' };
    // No chat is listening: the open is held, then delivered to the next chat that mounts.
    holdAskAiOpens();
    act(() => {
      window.dispatchEvent(new CustomEvent('ask-ai:open', { detail }));
    });
    expect(heard).toEqual([]);
    render(<EmbeddableChat />);
    await screen.findByTestId('chat');
    expect(heard).toEqual([{ type: 'ask-ai:open', detail }]);
  });

  it('hears an open sent once it is listening exactly once', async () => {
    render(<EmbeddableChat />);
    await screen.findByTestId('chat');
    const detail = { source: 'flamingo' };
    act(() => {
      window.dispatchEvent(new CustomEvent('ask-ai:open-with-ref', { detail }));
    });
    expect(heard).toEqual([{ type: 'ask-ai:open-with-ref', detail }]);
  });
});
