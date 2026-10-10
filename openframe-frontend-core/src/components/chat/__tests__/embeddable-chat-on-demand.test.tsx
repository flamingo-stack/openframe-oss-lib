import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const heard: Array<{ type: string; detail: unknown }> = [];
let panelMounts = 0;

vi.mock('../../../contexts/chat-runtime-context', () => ({
  useRequiredChatRuntime: () => ({ source: 'flamingo' }),
}));

// The panel, reduced to what the shell relies on: it listens for the open events once mounted.
let panelBaseRoute: string | undefined;
vi.mock('../embeddable-chat', () => ({
  EmbeddableChat: ({ baseRoute }: { baseRoute?: string }) => {
    panelBaseRoute = baseRoute;
    useEffect(() => {
      panelMounts += 1;
      const onOpen = (event: Event) => heard.push({ type: event.type, detail: (event as CustomEvent).detail });
      window.addEventListener('ask-ai:open', onOpen);
      window.addEventListener('ask-ai:open-with-ref', onOpen);
      return () => {
        window.removeEventListener('ask-ai:open', onOpen);
        window.removeEventListener('ask-ai:open-with-ref', onOpen);
      };
    }, []);
    return <div data-testid="panel" />;
  },
}));

import { EmbeddableChatOnDemand } from '../embeddable-chat-on-demand';

const open = (type: string, detail: unknown) =>
  act(async () => {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  });

describe('EmbeddableChatOnDemand', () => {
  beforeEach(() => {
    heard.length = 0;
    panelMounts = 0;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('draws nothing and loads no panel until the chat is asked for', () => {
    render(<EmbeddableChatOnDemand />);
    expect(screen.queryByTestId('panel')).toBeNull();
    expect(panelMounts).toBe(0);
  });

  it('loads the panel on the first open and hands it that open, question included', async () => {
    render(<EmbeddableChatOnDemand />);
    await open('ask-ai:open', { source: 'flamingo', prompt: 'What does it cost?' });
    expect(await screen.findByTestId('panel')).toBeTruthy();
    await expect.poll(() => heard.length).toBe(1);
    expect(heard[0]).toEqual({ type: 'ask-ai:open', detail: { source: 'flamingo', prompt: 'What does it cost?' } });
  });

  it('does the same for an open that carries a record', async () => {
    render(<EmbeddableChatOnDemand />);
    const detail = { source: 'flamingo', ref: { type: 'faq', id: '7', title: 'Pricing', url: null } };
    await open('ask-ai:open-with-ref', detail);
    await screen.findByTestId('panel');
    await expect.poll(() => heard.length).toBe(1);
    expect(heard[0]).toEqual({ type: 'ask-ai:open-with-ref', detail });
  });

  it('ignores an open addressed to another chat', async () => {
    render(<EmbeddableChatOnDemand />);
    await open('ask-ai:open', { source: 'openmsp' });
    expect(screen.queryByTestId('panel')).toBeNull();
  });

  it('hands over each later open once: the panel hears it itself', async () => {
    render(<EmbeddableChatOnDemand />);
    await open('ask-ai:open', { source: 'flamingo' });
    await screen.findByTestId('panel');
    await expect.poll(() => heard.length).toBe(1);
    await open('ask-ai:open', { source: 'flamingo', prompt: 'Again' });
    expect(heard).toHaveLength(2);
    expect(panelMounts).toBe(1);
  });

  it('mounts the panel at once for a host that asks for it open', async () => {
    render(<EmbeddableChatOnDemand defaultOpen />);
    expect(await screen.findByTestId('panel')).toBeTruthy();
    expect(heard).toHaveLength(0);
  });

  it("loads a host's deferred props with the panel, once, and merges them over the direct ones", async () => {
    const panelProps = vi.fn(async () => ({ baseRoute: '/docs' }));
    render(<EmbeddableChatOnDemand baseRoute="/knowledge-base" panelProps={panelProps} />);
    expect(panelProps).not.toHaveBeenCalled();
    await open('ask-ai:open', { source: 'flamingo' });
    await screen.findByTestId('panel');
    expect(panelProps).toHaveBeenCalledTimes(1);
    expect(panelBaseRoute).toBe('/docs');
  });
});
